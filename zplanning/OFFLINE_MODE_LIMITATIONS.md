# Offline mode limitations — known issues, no fix applied

## Context
While fixing the POS client being cleared after order creation, we found that the "Crear Pedido (Offline)" page does not actually work offline. This document records what's broken and what fixing it would cost, for a later decision. **No code changes were made for any of the items below.**

Already shipped separately (unrelated to these): `applyPOSSettings()` is now called from `resetForm()` in `src/components/forms/OrderForm.vue:251`, so the POS client, auto-paid date, current-date defaults and forced pickup survive each order creation. That fix covers both `CreateOrder.vue` and `CreateOfflineOrder.vue` since both call the same exposed `resetForm()`.

## Issue 1 — Form hangs on "Cargando…" forever when any fetch fails
`src/components/forms/OrderForm.vue:334-341`

```js
onMounted(async () => {
  fetching.value = true;
  await Promise.all([ productStore.fetchAll(), userStore.fetchAll(),
                      bakerySettingsStore.fetchById('default'),
                      systemSettingsStore.fetchSettings() ]);
  fetching.value = false;   // line 342 — never reached on rejection
```

No `try`/`catch`, no `finally`. All four stores set `error` then **rethrow** (`src/stores/base/resourceStore.js:154,181`; `src/stores/systemSettingsStore.js:104-106`), and offline they reject with `'No response from server'` (`src/services/base/resourceService.js:391-392`). The rejection escapes the hook, so `fetching` stays `true` and the template renders `Cargando…` (`OrderForm.vue:737`) with the `<form v-else>` (line 741) never mounting.

Impact: navigating to the order form after losing signal — with the SPA already loaded — shows a permanent spinner. The connectivity banner and the queued-orders list still render, so it looks half-alive.

Fix cost: ~5 lines (`try`/`catch`/`finally`). Note this alone only renders an *empty* form — see Issue 2.

## Issue 2 — No cached data, so the form is unusable even if it renders
No store persists anything; `createResourceStore` (`src/stores/base/resourceStore.js:6`) has no cache and no `isLoaded` short-circuit, so every mount refetches. With empty stores:
- `userStore.items` → `[]` (`OrderForm.vue:766`) — no client selectable
- `productStore.items` → `[]` (`OrderItemsManager.vue:12,172,180`) — nothing to sell
- `bakerySettingsStore.items` → `[]`, so `features` returns `{}` (`OrderForm.vue:387-390`) and every POS computed (`src/stores/bakerySettingsStore.js:29-57`) is null/false — **POS auto-select silently off**
- every `systemSettingsStore` getter → `[]` (`systemSettingsStore.js:24-60`) — no payment methods, no fulfillment types

Fix cost: medium. `createResourceStore` is a single chokepoint — write payloads to `localStorage` on success, fall back to cached items on a network error instead of rethrowing. `@vueuse/core` ^12 is already installed (`package.json:16`) and ships `useStorage`, currently unused. Precedent for the serialization pattern: `CreateOfflineOrder.vue:50-70` (`bakery_offline_orders`).

## Issue 3 — True cold start can't load the app at all
No PWA: no `vite-plugin-pwa` or workbox in `package.json`, `vite.config.js:10-21` has only `vue()` and `svgLoader()`, and `public/` has no `manifest.json` or `sw.js`. Nothing caches the app shell, and the route is lazily code-split (`src/router/index.js:153`), so the chunk must be fetched at navigation time.

Additionally the router guard (`src/router/index.js:393-395`) calls `authStore.checkAuth()`, which force-refreshes the token and POSTs `/auth/login` (`src/stores/authentication.js:356-378`). Offline that rejects and `next()` is never called — navigation stalls before `OrderForm` mounts.

Impact: reloading the tab with no signal gives a blank page. "Offline mode" today only means *"stay on the already-loaded page and queue orders to localStorage"*.

Fix cost: large. Service worker + shell precaching, plus reworking the auth guard to accept cached Firebase credentials when the backend is unreachable.

## Suggested order, if picked up later
1. Issue 1 (5 lines) — stops the confusing infinite spinner.
2. Issue 2 — makes the offline page genuinely usable mid-session; this is the realistic cashier scenario.
3. Issue 3 — only if cashiers actually reload the page with no connection.
