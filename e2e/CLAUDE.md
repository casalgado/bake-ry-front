# e2e (Playwright)

Browser tests against the local Vite server and the Firebase emulators. Each suite logs in to its own bakery, so suites never share data. Read this before writing or changing a test.

| Suite | Bakery | Admin |
|---|---|---|
| `users.e2e.js` | `e2e-users` (empty, inventory off) | `USERS_ADMIN` in `helpers.js` |
| `products.e2e.js` | `e2e-users` (shares it with users; unique names keep them apart) | `USERS_ADMIN` |
| orders (`orders-api.js`) | `e2e-orders` (not yours; do not touch it or `seedE2E.js`) | `ORDERS_ADMIN` in `orders-api.js` |
| `smoke.e2e.js`, inventory | `es-alimento-dev` (`seed:setup` data) | `es.alimento@gmail.com` |

Run `npm run seed:e2e` in the backend (`functions/`) before the users or orders suites.

## Running

- `npm run e2e:run [-- inventory | core]` runs the suites unattended, one spec file per process, so memory is freed between files. `core` is users, products, orders and smoke; no argument runs both. Each file prints a timestamped `RESULT` line, its JSON lands in `e2e/last-run/<file>.json`, and a summary table prints at the end. `/e2e-run [inventory | core]` does the same and reports back.
- A full run in one go exhausts memory (the emulators grow too, and their failures look like test failures: `ECONNRESET`, `EPIPE`, 90 s timeouts). Run `inventory` and `core` separately: restart the emulators and run `seed:setup` before `inventory`, then restart and run `seed:e2e` before `core`.
- Recording defaults: video off, screenshot and trace only on failure (full runs exhaust memory otherwise). `--video=on` brings video back for one run.
- `npm run e2e` runs headless. `npm run e2e:ui` is the interactive runner. `npm run e2e:report` opens the last HTML report (video, screenshots, trace).
- `SLOWMO=400 npm run e2e:headed` watches the browser. `slowMo` is a `launchOptions` setting read from the `SLOWMO` env var in `playwright.config.js`; there is no CLI flag. At high values (1000) long tests exceed the 30s test timeout because every action costs that long.
- Vite (5173), the Auth emulator (9099), Firestore (8080) and the functions emulator must already be up. `webServer` only reuses a running Vite.
- Test files end in `.e2e.js` so Vitest does not collect them. Do not rename them to `.spec.js`.
- Ask the user before running tests.

## Inventory suite (`inventory.*.e2e.js`)

- Own config and command: `npm run e2e:inventory` (`playwright.inventory.config.js`: `workers: 1`, 90 s timeout, its own `e2e/results-inventory` and `e2e/report-inventory`, so it can run next to the orders suite). Plain `npm run e2e` ignores these files. `SLOWMO=300` works headless.
- Helpers: `inventory-api.js` (arrange through the API: `inv.ingredient/product/order/run/purchase/count*`, `inv.staff(role)`, `firestore()` for emulator-only writes) and `inventory-ui.js` (`test` fixtures `inv`, `fs`, and a `page` that fails on a page error or Firestore `permission-denied`; `openStock`, `pick`, `docLine`, order-form helpers). Both own their date and list helpers: the orders suite changes its own.
- The bakery (`es-alimento-dev`, `npm run seed:setup`) is shared and mutable. Every test mints its own uniquely named items and asserts exact numbers on those. Seeded items are read, or asserted by delta only. Each order gets its own day in 2040 (`uniqueDay`/`openOnDay`), so kitchen and order lists hold only its rows. Orders a test makes are soft-deleted afterwards.
- Bakery-wide state: there is one open count at a time (count tests clear any open count before and after, and drop one you started by hand); the module-switch test turns inventory off for everyone and restores it in `finally`; Repetir reads runs of the last 14 days. This is why the suite is one worker, and `inventory.zz-integrity` runs last by name.
- Pickers (Ingreso, Producción): the catalog loads after the page, so `pick` waits for the real option (otherwise "Crear …" matches) and then presses Escape: an open list collapses on the next mousedown and moves the button the click was aimed at.
- The order form decides a line's default source at the moment it is added: wait for the `/stocks` response before adding lines (`openForm` in the order-form spec).
- The functions emulator resets idle sockets (`ECONNRESET`): API reads and deletes retry, writes do not.

## Rules that prevent false results

1. **Wait for the create to finish.** After submitting a create form, wait for the redirect before navigating. A `goto` right after the click can cancel the request and the user is never created (`createUser` does this; pass `stay: true` only for rejection tests).
2. **An absence check needs a loaded table.** `toHaveCount(0)` passes instantly on a table that has not loaded. Use `expectNotListed`, which waits for the page's own data endpoint and for "No hay datos disponibles para mostrar."
3. **Wait on the table's real endpoint.** Staff and B2B tables load from `/settings/default/staff` and `/settings/default/b2b_clients`, not from `settings/default` (that request also fires and resolves first). Users load from `/users`. New list pages must be added to `LIST_API` in `helpers.js`.
4. **Assert the thing itself, not a side effect.** "Not on /dashboard" does not prove a login was rejected: a demoted account logs in and is bounced to home by the router guard. Assert the login error alert (`expectLoginRejected`).
5. **Never `networkidle`.** The app keeps connections open and it never settles. Wait for a URL or visible text.
6. **A passing `test.fail()` is a signal, not a nuisance.** "Expected to fail, but passed" means either the bug is fixed or the assertion is too weak. Check the data (Firestore emulator REST at `localhost:8080`, header `Authorization: Bearer owner`) before deciding which.
7. **Verify state, not just UI.** When a result is surprising, read Firestore or the Auth emulator instead of theorizing.

## Locators

- Prefer role, label and text. The radio "pills" in `BakeryUserForm` are `sr-only` inputs: click the visible `<label>` text, exact match.
- The navbar has its own "Iniciar sesión" button, so submit login with `button[type=submit]`.
- Sidebar links are `<a>` inside `main > nav`. The header also contains a nav (the "MAD" link), so scope with `getByRole('main').getByRole('navigation')`. Assert the exact list of links so a newly leaked entry fails.
- The DataTable search box is hidden until the magnifier is clicked. The magnifier locator must be `:visible`; a hidden mobile-nav button matches first otherwise.
- Table search only covers the columns each page passes as `searchable-columns`; the DataTable default is `name` (plus a few order fields). The staff and B2B tables match on name only, so never search them by email or phone.
- Table rows are `getByRole('row')`. Click a row to select it, then use the toolbar button ("Editar", "Eliminar"). Delete on staff opens a ConfirmDialog; delete on clients uses `window.confirm` (`page.once('dialog', ...)`).
- Add a `data-testid` only when role, label and text cannot reach the element. Do not edit old Tailwind views for testability.

## Data and auth

- Every test creates its own user with `uniqueUser()` (timestamp plus counter in email and name). No teardown: the emulators are disposable and a failing test must not cascade. Soft-deleted emails stay taken, so never reuse an email.
- Names are stored capitalised by the backend (`E2E` becomes `E2e`). Search is case-insensitive; exact-case matches are not.
- The backend derives staff passwords internally and never returns them. Do not copy that rule into tests: call `setPassword(request, email)`, which sets a known password through the Auth emulator REST API, then log in with `STAFF_PASSWORD`.
- Extra sessions: `loginAs(browser, credentials)` opens a fresh context. It sets `baseURL` itself because fixture `use` options do not reach manually created contexts.
- The staff list is the `settings/default/staff` subcollection plus every root `users` doc of that bakery that is not `system_admin`. Bakery admins therefore show in `/dashboard/staff` without a staff doc.
- Creating staff redirects to `/dashboard/staff`; creating clients redirects to `/dashboard/users`.

## Products and collections (`products.e2e.js`)

- Names are stored lowercase but the tables display them capitalised: use `ignoreCase` on text checks. Source of truth for stored values is `storedByName(request, 'products' | 'productCollections', name)` (Firestore emulator REST); use it for tax, prices, combinations and `isActive`.
- The IMP (%) column renders the raw number (`19`, not `19.0%`: the column's `format` is ignored by the table). `taxCell(row)` is the cell before Activo.
- Edit dialogs: the `getByRole('dialog')` locator is never "visible" (its root has no box), so `toBeHidden()` on it passes instantly. `saveEdit` waits for the PUT response instead.
- Open the products edit dialog only after both the products and the collections GET have returned (`selectRow` does). Otherwise the Categoría select is blank and its `required` blocks the save with no error shown.
- The variation UI is reached by structure: `.base-card` filtered by its h5 heading for a dimension, `.group-header` filtered by option name for the price inputs (sale, then cost). The No/Sí toggles are found as the sibling of their label text (`setToggle`).
- The emulator gets slower as the bakery fills (lists 2 to 6 s, creates up to 20 s), and tests never clean up. The suite sets a 180 s test timeout and a 30 s expect timeout; reset the emulators and re-run `seed:e2e` when it drags.
- Collection delete is a hard delete and is refused (400) while an active product uses it; product delete is soft.

## Known backend bugs (tests marked `test.fail()`)

When one is fixed, its test starts reporting "Expected to fail, but passed": remove the `test.fail()` line.

- Collection rename does not update `collectionName` on its products (`products.e2e.js`).

The next two are in the backend `bakeryUserService.update` (`users.e2e.js`):

- Staff changed to Persona keeps a working Auth account (only claims change), so the old login still works.
- Empresa changed to Persona never deletes its `b2b_clients` doc, so it stays in the B2B list (the stale doc is visible in Firestore).

## Scope

- Role-access tests check the frontend router guard only. `/export-orders` and `/print-delivery` have `requiresAuth` but no `allowedRoles`, so any role can open them. Backend 403s are not covered.
- Field validation (empty name, bad email, staff without email) belongs in Vitest (`src/components/forms/__tests__/BakeryUserForm.test.js`), not here. Only the duplicate-email case needs the real backend.
