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


add a reemplazar button besides the x, replace an ingredient, keep the number. 
search should include categories 
a clear recipe button
a friendly way to add the current combinations recipes to this work table. 

no quantity formatter exists. getUnitTypeLabel (helpers.js:235) maps weight/volume/count to Spanish labels for form dropdowns, that is not the same thing. Inventory needs formatQty (number only, max 3 decimals, unit rendered as its own span next to it, not glued into the string).

add a denormalization fix strategy to read/check/report? or fix? that all denormalization numbers are ok. 
Propose a denormalization.md file that keeps track of how data is stored and denormalized in the app. 


recipe cost model rebuilt on the backend (2026-09-03, back repo functions/docs/recipe-costing.md):

what changed: recipe component rows are pure structure now — { type, id, combinationId, quantity, unit, notes }. they no longer carry `name` or `costPerUnit`, and recipe GET no longer hydrates per-line cost. `recipe.totalCost` is gone. cost is computed on demand server-side (computeRecipeCost) and cached only on the owner: product.costPrice / combination.costPrice / ingredient.costPerUnit, refreshed by one propagation walk. two new endpoints exist, unused by the FE. this is the backend half of B3 — frontend still to do.

- RecipeBookView.vue (route recipe-book) is the main break. line.name and line.costPerUnit come back undefined, so ingredient-line labels blank out and lineCost / recipeCost / profit / marginPct / unpricedCount collapse to 0. fix: join each line to ingredientStore.items / productStore.items by { type, id, combinationId } to recover the name + current cost (ingredient costPerUnit, or product/combination costPrice) for display and the live total. stores are already fetched in onMounted and kindOf() already keys off line.id, so half the plumbing exists. componentRow() should stop stamping name/costPerUnit onto bench rows; save() only needs to send { type, id, combinationId, quantity, unit, notes } (backend ignores extras but cleaner). recipeChips (dissolving a sub-recipe onto the bench) needs the same join for its chip labels.

- ShowRecipes.vue (legacy table, route recipes, still always-on): the ingredients column renders `${ing.name} - ${qty} ${unit}` and ing.name is now undefined → " - 5 g". look the name up from ingredientStore, or drop the column. B3 deletes this view anyway.

- RecipeForm.vue / CreateRecipe.vue: builds lines with `ingredientId` (not `id`), name, costPerUnit, never sends `type`. already misaligned with typed components from the earlier phase, likely already broken for product components. B3 removes it — priority is to not build on it.

- RecipeSelector.vue + IngredientSelector.vue + ProductVariationEditor.vue read `i.name` off recipe lines. ProductVariationEditor is imported nowhere (dead), which makes the other two dead too. delete in B3.

- costPriceSource round-trip risk. backend sets combination.costPriceSource = 'recipe' when a recipe is linked, and propagation only writes costPrice on caches whose source is 'recipe' — a combination flipped back to 'manual' silently stops tracking its recipe. the product form rebuilds every combination through models/Combination.js on save. verify that round-trip preserves costPriceSource for combinations the user didn't touch, and that VariationCombinationManager doesn't blind-write 'manual'. when a user types a manual cost into a combination that has a recipe, the FE should set that combination's source to 'manual' on purpose; there's no UI to set it back to 'recipe' yet (that's B3's product↔recipe assignment editor).

- new endpoint, unused: GET /bakeries/:bakeryId/ingredients/:id/cost-impact?newCost=X → [{ path, changes: { costPrice|costPerUnit: { from, to, combinationId? } } }], i.e. every recipe/product/ingredient cost that would move if this ingredient's cost changed, and by how much, without applying it. this is B3's "impact preview" (inventory-next-steps B3 / inventory-ux-plan). no what-if dialog pattern exists in the app yet — useUndoSnapshot is the only reusable primitive. natural home: the cost field in the rebuilt IngredientForm.vue, or inline edit in ShowIngredients.vue / RecipeBookView's despensa pane. add to IngredientService via customRequest('get', ...).

- new endpoint, unused: POST /bakeries/:bakeryId/recipes/reconcile-costs body { owner: { type: 'product'|'ingredient', id, combinationId? } } → recomputes one owner's cached cost from its recipe and corrects it if it drifted; returns { changed, corrections }. admin only. natural home: a "recalcular costo" button on the product/combination cost cell (ShowProducts column, RecipeBookView combo cards) or ingredient row. after it runs, realtime won't repaint nested arrays / combination costPrice (resourceStore.handleRealtimeUpdate skips non-primitives) — the caller must recipeStore.fetchById / productStore.fetchAll.

- stale-cache note for the whole recipe/product UI: after any backend cost recompute (an ingredient edit elsewhere, a reconcile, another user), handleRealtimeUpdate only syncs primitive fields — a product's combinations[].costPrice and a recipe's ingredients[] do NOT live-update. B3 needs an explicit refresh affordance or a refetch on view focus.


con picho

que se puedan cambiar de categorias los ingredientes
importar desde xlsx los ingredientes, (dar una plantilla?)
comenzar en correo

toast guardado con exito
se me esta demorando al crear ingredientes


se ve raro en med screens, el card no cabe, se come el nombre.
meter costo por unidad en existencias y mas claras las tarjetas.

use confirm dialogs instead of window alers in new inventory tabs.