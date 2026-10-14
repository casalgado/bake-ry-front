# Deploy steps (written 2026-10-14, uncommitted)

Two repos, two deploys. Backend first, frontend second.

- Backend: `C:\Users\casal\documents\web\back\bake-ry` (Firebase project `bake-ry`)
- Frontend: `C:\Users\casal\documents\web\front\bake-ry-front` (hosting target `bake-ry`)

`firebase deploy` ships the **working tree**, not a git commit. Push or no push, whatever is
on disk is what goes out. So check `git status` in both repos before deploying.

## 0. Read this first: how much is actually going out

Git can't tell what production runs now. Neither repo records a "last deployed" marker.
Relative to `origin/main`:

- Frontend: **42 commits ahead**, back to 2026-09-04 (the whole inventory module among them).
- Backend: **4 commits ahead**, all dated 2026-10-12 (see section 2).

If production was last deployed from before those, ALL of it goes out together, not just the
last two days. Today and yesterday alone are frontend-only (section 1). Write down the date of
your last real deploy and compare.

## 1. What today's and yesterday's commits change for deploy

Frontend commits since 2026-10-13: `6824b3e`, `b798e81`, `00681d5`, `bd595af`, `d27912a`,
`d8d3ca7`. Backend commits since then: none.

- **Deploy config:** unchanged. `firebase.json`, `.firebaserc`, `vite.config`, the `deploy`
  script and the hosting target are the same.
- **New env vars:** none. No new `import.meta.env.*` anywhere in the diff.
- **New backend endpoints needed by these six:** none.
- **package.json (front):** only dev tooling (`@playwright/test`, `e2e*` scripts, the jest
  version for eslint). Nothing that affects the build output.
- **UI refactors** (`ui-formhost`, `ui-gutter`, product/category forms on `ui-*`, `UiPills`,
  `UiYesNo`, `ui-btn-field`): frontend only.
- **Integral feature** (`d8d3ca7`): frontend only. The flag is stored at
  `features.products.offersWholeGrain`. The backend already passes unknown `features` keys
  through (production already stores `features.products.useProductCost`). Default is off, so
  there is no migration.

## 2. Backend (do this first)

What the 4 unpushed commits (2026-10-12) bring, deploy-wise:

- `firestore.rules`: clients can no longer write `orders` (`allow write: if false`; reads stay).
  The frontend has no client-side Firestore writes (checked: no `setDoc/addDoc/updateDoc/
  deleteDoc/writeBatch` in `src/`), so this is safe for the app. It must be deployed
  separately from functions.
- New dependencies in `functions/package.json`: `@xmldom/xmldom`, `node-forge`, `xml-crypto`
  (DIAN e-invoicing). The lockfile has them.
- Stock/inventory changes (count close in chunks, order verify/reconcile, `shippedAt`), recipe
  fixes, e-invoice builder and `einvoicing` bakery settings. New routes in
  `productionRunRoutes.js` and `stockRoutes.js`, extra role handling in `userAccess.js`.
- `firestore.indexes.json`: unchanged.

Uncommitted in the backend (does not matter for the deploy, FYI): `seed:e2e` script in
`functions/package.json`, untracked `seedE2E.js`, and two `.md` notes.

Steps, from `C:\Users\casal\documents\web\back\bake-ry`:

1. `git status` / confirm you are on the code you mean to ship.
2. `cd functions && npm install` (node 20 is the target runtime; local node is 24, which is
   fine for installing).
3. Functions: `npm run deploy` (`firebase deploy --only functions`). The predeploy hook runs
   `check:filenames`; fix any filename-case error it reports.
4. Rules: from the repo root, `firebase deploy --only firestore:rules`.
5. Optional sanity: `firebase functions:log` for startup errors right after deploy.

## 3. Frontend

**Danger: the emulator flag is baked into the build.** `.env.local` has
`VITE_USE_AUTH_EMULATOR=true`. Vite loads `.env.local` for `vite build` too, and the code
(`src/config/firebase.js`, `src/services/api.js`, `src/stores/authentication.js`) switches to
`localhost:9099` and `localhost:5001` on that flag, with no check for dev mode. A plain
`npm run deploy` could ship a production site pointing at your own machine.

Do one of these, then verify:

- Build with the flag overridden for that one command (shell env beats `.env.local`):
  `VITE_USE_AUTH_EMULATOR=false npm run deploy` (PowerShell:
  `$env:VITE_USE_AUTH_EMULATOR='false'; npm run deploy`).
- Or move your local `.env.local` aside for the build and put it back.
- Verify before hosting goes live: build with `npm run build`, then search `dist/assets/*.js`
  for `localhost:5001` and `localhost:9099`. Neither should appear (heuristic: I expect the
  dead branch to be removed from a production build, but I have not run it). Then
  `firebase deploy --only hosting:bake-ry`.
- Do not write `VITE_USE_AUTH_EMULATOR=false` into any env file: `src/test/setup.js` blocks
  the test run on purpose if it isn't `true`.

Steps, from `C:\Users\casal\documents\web\front\bake-ry-front`:

1. `git status` (the only leftover is the staged `mad-td.md`, unrelated).
2. Build and deploy as above (`npm run deploy` = `vite build && firebase deploy --only hosting:bake-ry`).
3. Hard refresh (Ctrl+Shift+R) on production; the service worker / cache may serve the old bundle.

## 4. After deploying

1. System-admin screen -> pick `es-alimento` and `diana_lee` -> Características Adicionales ->
   turn on **Opciones Integrales** -> Guardar. These are the only 2 of 15 production
   businesses using integral options (24 and 2 products). Until then a dimension that already
   has integral options still shows its toggle, but a new dimension would not. Businesses can
   also flip it themselves in their own settings.
2. Confirm it persisted: reload, and save once from the business settings page; it must stay on.
3. Smoke test on production:
   - Log in; orders list loads (the new rules still allow reads).
   - Create a product: Inventario (if on) -> Variaciones Sí/No -> Precios; with Sí, choose a
     type, remove it, confirm; the section must stay open.
   - Category form: Variaciones head, Sí shows the manager.
   - Edit dialog and create page keep the 48rem width, Sí/No do not change the width.
   - If inventory is enabled for the business: counts list, production, a stock move.

## 5. Rollback

- Hosting: Firebase console -> Hosting -> release history -> roll back to the previous
  release (or `firebase hosting:rollback`).
- Functions / rules: check out the previous commit and redeploy the same command. Rules are
  versioned in the console too.
- The integral flag needs no rollback: delete nothing, absent/false reads as off.
