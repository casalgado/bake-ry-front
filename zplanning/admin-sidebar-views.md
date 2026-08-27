# Admin Sidebar — Views Reference

One section per link in `src/components/layouts/AdminSidebar.vue`, in sidebar order.
Each section lists the route, the component behind it, what the view does, what it
reads (stores / data sources) and what it writes (mutations it triggers).

Two links are conditional:

- **Crear Offline** appears only when `settings.features.order.offlineMode === true`.
- **Inventario** appears only when `settingsStore.isInventoryEnabled`; the route also
  carries `meta.requiresFeature: 'inventory'`, so it is unreachable by URL while off.
- The **Entrega** section is hidden when `settingsStore.shouldHideDeliveryOptions`.
- **Negocios** appears only for `system_admin`.

---

## Pedidos

### Pedidos
- **Route:** `/dashboard/orders` → `views/orders/ShowOrders.vue`
- **Does:** Main order table for the selected period. Uses `useDataTable` with realtime
  subscription, inline toggles (paid, fulfillment type), a totals summary, and row
  actions: edit, delete, duplicate, payment, history, print, export.
- **Reads:** `orderStore` (orders filtered by `preparationDate` within
  `periodStore.periodRange`), `bakerySettingsStore` (`fetchById('default')`, `b2b_clients`
  to tag each order B2B/B2C), `systemSettingsStore`, `periodStore`.
- **Writes:** `orderStore.create` / `update` (via `OrderForm` dialog and duplicate flow),
  `orderStore.remove`, plus toggle patches on individual orders.

### Crear Pedido
- **Route:** `/dashboard/orders/create` → `views/orders/CreateOrder.vue`
- **Does:** Thin wrapper around `OrderForm`. On success it resets the form and scrolls to
  the top so the next order can be typed immediately (POS-style).
- **Reads:** `orderStore.loading` / `error`. All catalogue and client data is loaded
  inside `OrderForm`.
- **Writes:** `orderStore.create`.

### Crear Offline (conditional)
- **Route:** `/dashboard/orders/create-offline` → `views/orders/CreateOfflineOrder.vue`
- **Does:** Same `OrderForm`, but watches `navigator.onLine`. Offline, orders are queued
  in `localStorage`; online, they are sent straight through. Shows the pending queue with
  per-order delete, clear-all, and a manual sync button, all behind `ConfirmDialog`.
- **Reads:** `localStorage['bakery_offline_orders']`, browser `online`/`offline` events,
  `orderStore.loading` / `error`.
- **Writes:** `localStorage` queue (add / remove / clear) and `orderStore.create` on
  submit or sync.

### Por Cobrar
- **Route:** `/dashboard/orders/unpaid` → `views/orders/ShowUnpaidOrders.vue`
- **Does:** Table of unpaid, non-complimentary orders with B2B/B2C totals. It temporarily
  forces `periodStore` to the current year so every open balance is in the realtime
  subscription, and restores the previous period on unmount.
- **Reads:** `orderStore` (`isPaid: false`, `isComplimentary: false`),
  `bakerySettingsStore` (`b2b_clients`), `systemSettingsStore`, `periodStore`.
- **Writes:** `orderStore.update` (edit dialog), `orderStore.remove`, payment toggles.

---

## Analisis

### Venta
- **Route:** `/dashboard/salesReport` → `views/orders/ShowSalesReport.vue`
- **Does:** Sales report for the selected period. Picks the granularity automatically
  (monthly if several months, otherwise complete weeks, otherwise daily) and renders a
  summary table (order count, delivery income, B2B/B2C split, discounts, total revenue),
  a per-period table, and payment-method breakdowns. Date field is switchable between
  `dueDate` and `paymentDate`.
- **Reads:** `orderStore` (report data for the period), `periodStore`,
  `bakerySettingsStore` (`b2b_clients`, report feature settings), `systemSettingsStore`.
- **Writes:** Nothing. Read-only report.

### Fechas de Pago
- **Route:** `/dashboard/paymentDates` → `views/orders/ShowPaymentDates.vue`
- **Does:** Flattens orders into individual **payment entries** by date — one row per
  partial payment plus a `saldo` row for the remaining balance. Supports both the current
  `partialPayments[]` array and the legacy `partialPaymentDate` / `partialPaymentAmount`
  fields. Complimentary orders are skipped. Offers export to payment report / products.
- **Reads:** `orderStore.fetchAll` with an `orDateRange` filter over `paymentDate` and
  `partialPaymentDate`, `periodStore`, `bakerySettingsStore` (`b2b_clients`).
- **Writes:** Nothing. Read-only, plus file exports.

### Reportes
- **Route:** `/dashboard/reports` → `views/reports/ReportsPage.vue`
- **Does:** Static index of report cards (Venta, Fechas de Pago, Rentabilidad, Ventas por
  Producto, Comportamiento Clientes). Detects whether it is mounted under `/accounting`
  and links to the matching route names for that dashboard.
- **Reads:** `route.path` only. No stores.
- **Writes:** Nothing.

---

## Producción

### Por Producto
- **Route:** `/dashboard/orders/production/single` → `views/orders/ShowProductionSingleItems.vue`
- **Does:** Flattens every order into individual line items for the period, sorted by
  collection order, product name, then variation/combination. Shows order comments per
  item, lets staff mark items produced and assign a production batch (`T` column), both
  individually and in bulk via the batch dialog.
- **Reads:** `orderStore.items` (period-filtered, realtime), `periodStore`,
  `categoryOrder` from `utils/helpers`.
- **Writes:** `orderStore.patchAll` — item `status` (produced) and `productionBatch`.

### Agrupado
- **Route:** `/dashboard/orders/production/grouped` → `views/orders/ShowProductionGroupedItems.vue`
- **Does:** Same data as above but grouped by product + variation/combination, with total
  quantity per group and a `producido/total` status (`0`, `1`, or `3/5`). Marking a group
  produced fans out over its underlying items.
- **Reads:** Same as *Por Producto*.
- **Writes:** `orderStore.patchAll` over each group's original items.

---

## Inventario (conditional)

### Existencias
- **Route:** `/dashboard/inventory` → `views/inventory/ShowStock.vue`
- **Does:** Lists every item under stock control (ingredients and products) with current
  stock, unit, and last movement date. Two actions: view the movement history modal, or
  make a manual adjustment (signed quantity plus a required reason). Negative stock is
  displayed, never blocked — a count corrects it.
- **Reads:** `stockStore.fetchAll()` on mount; display values are precomputed in a
  `tableData` computed because this `DataTable` has no custom render hook.
- **Writes:** `stockStore.adjust(itemKey, { qty, reason })`, which creates a movement.

---

## Entrega (hidden when delivery options are off)

### Entrega
- **Route:** `/dashboard/orders/delivery` → `views/orders/ShowDelivery.vue`
- **Does:** Day-scoped delivery worksheet (forces `periodStore` to `day`). Table of
  orders due that day with driver, address, bag count and delivery fee, plus toggles for
  delivered / delivery paid. Bulk dialogs set delivery price (5000–8000), bag count,
  assigned driver, or edit the address.
- **Reads:** `orderStore` filtered by `dueDate` for the day (realtime),
  `bakerySettingsStore.staff` filtered to `delivery_assistant` for the driver list,
  `periodStore`.
- **Writes:** `orderStore.patchAll` (driver, bags, delivery cost, paid/delivered flags),
  `orderStore.update` (address and full edit via `OrderForm`).

### Resumen
- **Route:** `/dashboard/orders/delivery/summary` → `views/orders/ShowDeliverySummary.vue`
- **Does:** Groups delivery orders by driver and splits each into early week
  (Mon–Wed) and late week (Thu–Sat). Per driver: total deliveries, total amount, paid vs
  unpaid count and unpaid amount, plus a global summary. Expanding a driver shows their
  order table. Supports a `singleDriverMode` prop for reuse in the driver dashboard.
  Marking payments has an undo path.
- **Reads:** `orderStore.items` (`fulfillmentType === 'delivery'`), `periodStore`,
  `bakerySettingsStore` for driver names.
- **Writes:** `orderStore.patchAll` — `isDeliveryPaid` and its undo.

### Calendario
- **Route:** `/dashboard/orders/delivery-calendar` → `views/orders/ShowDeliveryCalendar.vue`
- **Does:** Same delivery data as *Entrega*, rendered through `DataCalendar` over a
  month instead of a table over a day. Same action set: delivery price, bag count,
  driver assignment, address edit, full order edit.
- **Reads:** `orderStore` filtered by `dueDate` over the month (realtime),
  `bakerySettingsStore.staff` for drivers, `periodStore` (forced to `month`).
- **Writes:** `orderStore.patchAll` and `orderStore.update`, as in *Entrega*.

---

## Usuarios

### Clientes
- **Route:** `/dashboard/users` → `views/bakeryUsers/ShowBakeryUsers.vue`
- **Does:** Client table (excludes `category === 'PER'`), sorted by name, with columns for
  name, email, address, birthday, category with invoice grace period, phone and national
  ID. Actions: edit in a dialog, delete with confirm, view change history.
- **Reads:** `bakeryUserStore.fetchAll` (sorted by name), `bakeryUserStore.getHistory`.
- **Writes:** `bakeryUserStore.update`, `bakeryUserStore.remove`.

### Crear Cliente
- **Route:** `/dashboard/users/create-client` → `views/bakeryUsers/CreateClient.vue`
- **Does:** Wrapper around `BakeryUserForm` limited to `['client', 'company']`. Redirects
  to `/dashboard/users` on success.
- **Reads:** `bakeryUserStore.loading` / `error`.
- **Writes:** `bakeryUserStore.create`.

### Clientes Activos
- **Route:** `/dashboard/users/active` → `views/bakeryUsers/ShowActiveBakeryUsers.vue`
- **Does:** Derives an "active clients" list from orders in the period: groups orders by
  `userId`, takes the most recent order for contact details and counts orders per client.
  Refetches when the period changes.
- **Reads:** `orderStore.fetchAll` filtered by `dueDate` over `periodStore.periodRange`.
- **Writes:** Nothing. Read-only.

### Clientes B2B
- **Route:** `/dashboard/b2b-clients` → `views/bakerySettings/ShowB2BClients.vue`
- **Does:** Table of the B2B client list held in bakery settings (name, email, phone,
  address). Edit opens `BakeryUserForm` after refetching the full user; delete confirms
  first. Refreshes from settings after every mutation.
- **Reads:** `bakerySettingsStore.fetchById('default')` → `b2b_clients`,
  `bakeryUserStore.fetchById`.
- **Writes:** `bakeryUserStore.update`, `bakeryUserStore.remove`.

### Equipo
- **Route:** `/dashboard/staff` → `views/bakerySettings/ShowStaff.vue`
- **Does:** Staff table with role labels in Spanish (Gerente, Supervisor, Asistente
  Domicilio, etc.), sorted with a hardcoded priority for a couple of names then
  alphabetically. Actions: edit, send a password reset email, delete — edit and delete are
  hidden for `bakery_admin` and `system_admin` rows. Uses `ConfirmDialog` and toasts.
- **Reads:** `bakerySettingsStore` (`staff` list), `bakeryUserStore`,
  `systemSettingsStore`.
- **Writes:** `bakeryUserStore.update`, `bakeryUserStore.remove`, and Firebase
  `sendPasswordResetEmail` (sends mail — not a store write).

### Agrandar Equipo
- **Route:** `/dashboard/users/create-staff` → `views/bakeryUsers/CreateStaffMember.vue`
- **Does:** Wrapper around `BakeryUserForm` with `formUserType="staff"` and types
  `['staff', 'delivery', 'production', 'accounting']`. Redirects to `/dashboard/staff` on
  success.
- **Reads:** `bakeryUserStore.loading` / `error`.
- **Writes:** `bakeryUserStore.create`.

---

## Productos

### Categorias
- **Route:** `/dashboard/product-collections` → `views/products/ShowProductCollections.vue`
- **Does:** Simple name/description table of product collections, with edit dialog
  (`ProductCollectionForm`) and delete behind a confirm.
- **Reads:** `productCollectionStore.fetchAll()` on mount.
- **Writes:** `productCollectionStore.update`, `productCollectionStore.remove`.

### Productos
- **Route:** `/dashboard/products` → `views/products/ShowProducts.vue`
- **Does:** Product table with client-side search and collection filter, sorted by
  collection. Rows expand to show variations; the price column shows cost / sale price and
  computed margin per variation. Edit opens `ProductForm`; delete confirms first.
- **Reads:** `productStore.fetchAll()` and `productCollectionStore.fetchAll()` on mount.
- **Writes:** `productStore.update`, `productStore.remove`.

### Importar/Exportar
- **Route:** `/dashboard/products/import-export` → `views/products/ProductImportExport.vue`
- **Does:** Export the product catalogue to `xlsx` or `csv`; import a spreadsheet by file
  picker or drag-and-drop. The file is parsed, diffed against current products, and a
  change/error preview is shown before anything is applied. Feedback goes through toasts.
- **Reads:** `productStore.items` (fetched on mount if empty); helpers in
  `utils/productImportExport` (`parseProductsFile`, `computeProductChanges`).
- **Writes:** `applyProductUpdates` — bulk product updates, only after the user confirms
  the preview. Also writes the exported file to disk.

---

## Mi Cuenta

### Configuración
- **Route:** `/dashboard/settings` → `views/bakerySettings/ShowBakerySettings.vue`
- **Does:** The big settings page. Covers feature flags (`BakeryFeaturesForm`, auto-saved
  with a 2s debounce), branding and legal/contact identity (`BakeryBrandingForm`), staff
  and B2B client lists, saved payment cards via `PayUService` (`CreditCardForm`), and
  subscription state (retry payment, cancel, reactivate) read from JWT claims and the API.
- **Reads:** `bakerySettingsStore`, `bakeryStore.currentBakery`, `bakeryUserStore`,
  `systemSettingsStore`, `authStore.getBakeryId`, Firebase auth claims, PayU service.
- **Writes:** `settingsStore.patch('default', { features })` for feature flags,
  `settingsStore.patch('default', { branding })` plus
  `bakeryStore.patchBakery(bakeryId, { email, address, phone, legalName, nationalId })`
  for identity, and card/subscription operations through `PayUService`.

### Negocios (system_admin only)
- **Route:** `/system-admin/bakeries` → `views/SystemAdmin/BakeryManagementView.vue`
- **Does:** Lets a system admin pick any business from a dropdown and edit its feature
  flags through `BakeryFeaturesForm` in `systemAdminMode` — including the opt-in modules
  `inventoryEnabled` and `accountingEnabled`. Form changes are held as a local preview and
  only persisted on an explicit save; switching businesses discards the preview.
- **Reads:** `systemAdminStore.fetchAllBakeriesWithSettings()` and
  `systemSettingsStore.fetchSettings()` on mount (`complimentary` is filtered out of the
  configurable payment methods).
- **Writes:** `systemAdminStore.updateBakerySettings(bakeryId, formData)`.
