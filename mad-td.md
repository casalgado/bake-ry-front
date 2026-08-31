Meter los domicilios en los reportes de venta que se sacan en la pestaña de reportes. 

- para los reportes de clientes

meter cuantos clientes en el periodo, y hacerlo diferente, mas facil de leer. Lo de nuevos, una sola fila y cada semana / mes la lista de clientes nuevos de ese periodod

el de persistencia, meterlo en buckets, cada uno sorted alphabetically or $$$, 

y que tenga insights, por ejemplo, tendencias o algo asi. o clientes que no han pedido el ultimo periodo pero si los 3 o 4 anteriores, o clientes que han pedido en todos los periodos, cosas asi. Y arriba que sea mas claro, algo mas general, como numero de clientes totales y cosas asi. 


nuevos que no pidieron mas
nuevos que han pedido cada periodo


make sure settingsStore call sites all use same pattern.


inventory backend gaps (from audit 2026-08-26):
- firestore.indexes.json has no explicit single-field index on stockMovements.refs.orderId. getOrderMovements queries on it directly (no orderBy), so it works off Firestore's automatic single-field indexing today, but the plan (1B.5) asked for it explicit.
- ingredientService.create doesn't call syncIngredientStockDoc — only update does. So creating an ingredient already set to stockBehavior 'stocked' leaves it without a stocks doc until the first edit.
- GET /stocks/:itemKey/movements has no date range params, only limit/startAfter. StockMovementsModal used to show two date pickers that filtered client side over an already truncated fetch (limit 200), so a range beyond those 200 came back silently empty. Pickers removed 2026-08-27; modal now shows the last 200 with no filter and no "hay más" indicator. Add from/to on the endpoint, then bring the pickers back using formatDateForInput + addDays from utils/dateUtils (never toISOString().slice(0,10), that is UTC and shifts the day in COT).

open from the same audit, not done:
- ShowStock.vue doesn't use the useDataTable composable while ShowIngredients.vue was just converted to it. Two patterns for the same kind of screen.
- ShowStock empty state says "activa el control en un producto o en un ingrediente" but no stockBehavior toggle exists in IngredientForm or the product form yet. Dead end until phase C.
- system_admin returns early in the router guard, before the requiresFeature check, so it reaches /dashboard/inventory even with the module off.
- systemAdminStore spreads existing inventory features to avoid wiping warehouses/orderDefault, but accounting has no spread. Breaks the day accounting gains a second field.
- formatDateDisplay shows day + month only, no time, so same day movements are indistinguishable in the ledger.
- new labels in ShowStock and StockMovementsModal have no for/id, and the modal close button (&times;) has no aria-label.
- Number(x.toFixed(3)) duplicated in ShowStock (x2) and StockMovementsModal.
- unused surface shipped with the module: getOrderMovements (service + store), the startAfter param, isAccountingEnabled, and the warehouses/orderDefault defaults in BakerySettings.


En la tabla te productos, los precios deberian mostrarse venta / costo como en el form.


money formatting is in three dialects (found 2026-08-27):
- formatMoney (utils/helpers.js:126) is en-US / USD, 0 decimals. This is the one we want everywhere by default: comma thousands separators. Used in ~8 files, and the new inventory views use it too.
- ShowOrderHistory.vue:60, ShowUserHistory.vue:23 and IncomeStatement.vue:147 each define their own local formatCurrency with es-CO (dot thousands). For IncomeStatement that is on purpose, Colombian accountants expect it. For the other two it is probably just copy paste and should go back to formatMoney.
- so the fix is NOT "make everything es-CO". It is: keep formatMoney as the default, give it an opt in for the accounting format (something like formatMoney(v, { accounting: true })), move IncomeStatement onto that, and delete the two other local copies.
- currency is hardcoded USD in formatMoney even though the app is COP. Decide if currency is per bakery (a settings field) or just fixed, then set it once.
- bug: SimpleTable.vue:38 calls formatMoney(value, currency), but the second arg is destructured as { slim = false }. Passing a currency string silently yields slim undefined and the argument is dropped. That table has never actually supported a currency.

no quantity formatter exists. getUnitTypeLabel (helpers.js:235) maps weight/volume/count to Spanish labels for form dropdowns, that is not the same thing. Inventory needs formatQty (number only, max 3 decimals, unit rendered as its own span next to it, not glued into the string).
