# Inventario — Pasos de implementación

Orden acordado (2026-08-26). Decisión: **correcciones de esquema primero, UX
después** — el ledger está vacío en prod y el endpoint de ajuste ya está vivo;
la ventana barata para cambiar el esquema de movimientos se cierra con el
primer dato real. Detalle de cada cambio en
[strategy/INVENTORY-CORRECTIONS.md](./strategy/INVENTORY-CORRECTIONS.md) (§N);
UX en [inventory-ux-plan.md](./inventory-ux-plan.md); secuencia original en
[strategy/INVENTORY-PLAN.md](./strategy/INVENTORY-PLAN.md).

Regla heredada del plan: cada fase termina con la app funcionando y shippable.
Tests se escriben donde se indica; **siempre preguntar antes de correrlos**.

---

## Fase A — Correcciones backend (§1–§3) — LA VENTANA

Todo en `functions/src`. Pequeña y acotada; nada de UX nuevo aquí.

- [x] **A1. Bodegas en settings** (§1.1) — `features.inventory.warehouses`
  `[{ id, name, isDefault }]`, auto-provisión de `{ id: 'main', name:
  'Principal', isDefault: true }`. Modelo `BakerySettings` + defaults.
- [x] **A2. `stockService.js`: dimensión bodega** (§1.2) — `buildStockDocId(itemKey,
  warehouseId)`; `warehouseId` obligatorio en `validateMovement`; delta map de
  `writeMovements` por stock-doc-id; `stockDocSeed` y `StockDoc` con
  `warehouseId`; los `sync*` crean solo el doc de la bodega default; `adjust`,
  `getStock`, `getStocks`, `getItemMovements` aceptan/filtran bodega.
- [x] **A3. Transferencias** (§1.2) — `MOVEMENT_TYPES.TRANSFER` +
  `transfer()` (dos movimientos ±qty, `refs.transferId` compartido) + ruta
  `POST /stocks/:itemKey/transfer`.
- [x] **A4. Bajas** (§3) — `MOVEMENT_TYPES.WASTE`, endpoint hermano del
  adjust (qty negativa, `reason: dañado|vencido|perdido|otro` + nota).
- [x] **A5. Modelos orden/producto/ingrediente** (§2.1, §2.3, §4) —
  `OrderItem.fulfillmentSource: 'produce'|'stock'` + `sourceWarehouseId`
  (default `'produce'`, sin migración); setting
  `features.inventory.orderDefault: 'smart'|'produce'|'stock'` (default
  `'produce'`); `syncProductStockDocs` de `!== 'unit'` a `=== 'none'`;
  `Ingredient.preferredSupplier` (texto libre). Solo modelo+validación —
  ningún comportamiento se engancha todavía (la deducción es Fase D).
- [x] **A6. Tests de la fase** — bodega en cada movimiento, idempotencia con
  el nuevo doc-id, transfer atómico, waste rechaza qty positiva, sync default
  bodega. *(`__tests__/services/stockService.test.js`, 31 en verde)*
- [x] **A7. Limpieza dev** — no aplica: no hay stocks/movimientos que borrar
  (prod vacío, dev sin datos). Los docs viejos con id sin `__warehouse`, si
  aparecieran, son caché desechable y se ignoran.
- [x] **A8. Adaptación mínima frontend** — `services/stockService.js` y
  `ShowStock.vue` mandan el `warehouseId` **de la fila** en el ajuste (el doc de
  stock ya lo trae: cero plomería de settings). `stockStore.js` no cambia —
  solo reenvía el payload; `StockMovementsModal.vue` tampoco: el historial se
  lee por `itemKey`, o sea de todas las bodegas, que es lo correcto con una y
  con varias (la columna es C3). `BakerySettings` (front) suma `warehouses` y
  `orderDefault` a sus defaults, y `systemAdminStore` deja de pisar
  `features.inventory` al guardar. Con una bodega no cambia nada visual.

## Fase B — UX con backend ya listo

Puro frontend contra endpoints implementados (plan 1C.1–1C.4).

- [ ] **B1. ProductForm: selector de modo** — sección "Inventario" (solo con
  feature activo): `Sin control` / `Compro y vendo` / `Lo produzco`
  (radio-cards, `RadioFeatureCard`); productos `none` no muestran NADA de
  inventario en ninguna parte. Si `recipe`: resumen read-only de recetas por
  combinación + botón al Recipe Manager.
- [ ] **B2. IngredientForm: extras** — para `manufactured`: receta opcional
  con yield obligatorio, toggle pass-through/stocked en lenguaje plano;
  `preferredSupplier`; sin edición de stock en el form.
- [ ] **B3. Recipe Manager** (el pedazo grande — `ShowRecipes.vue` rediseñado)
  — directorio de recetas + editor de asignación producto→combinaciones;
  editor de receta keyboard-first con costo/margen vivo, componentes tipados
  (ingrediente y producto), creación inline de ingredientes, matriz de
  cobertura, copy-and-scale como camino principal de creación.
  **Antes de construir: discutir la idea propia de asignación por combinación
  contra la decisión copy-and-scale (IMPLEMENTATION §2, §11.3).**
  `CreateRecipe.vue` / `CreateIngredient.vue` probablemente se eliminan.

## Fase C — Correcciones frontend completas

- [ ] **C1. Editor de bodegas** en `BakeryFeaturesForm.vue` (crear, renombrar,
  default; borrar solo sin stock) + setting `orderDefault`.
- [ ] **C2. `ShowStock.vue` multi-bodega** — filas agrupadas por item con
  desglose por bodega (solo si >1), filtro por tipo y bodega, valor a costo,
  acción **Transferir** (solo multi-bodega), acción **Registrar baja**.
- [ ] **C3. `StockMovementsModal.vue`** — columna bodega (solo si >1), tipos
  waste/transfer/production renderizados.

## Fase D — Deducción (fase 2 del plan, con enmiendas §2.2)

Backend primero, frontend después — orden estricto aquí.

- [ ] **D1. Backend**: predicado `affectsStock` + `Order.salesChannel`;
  `expandOrderItem` **source-aware y bodega-aware** (línea `stock` → −qty en
  su bodega y STOP; línea `produce` → expansión de receta; gaps nunca
  bloquean); hooks en `orderService` (edges del predicado, compensación,
  patchAll una transacción por orden); drift verify. Tests de 2.6 — el
  contrato de correctitud del epic. *(preguntar antes de correr)*
- [ ] **D2. OrderForm**: toggle por línea `Bodega/Producir` con default
  resuelto y siempre visible, hint de stock, picker de bodega origen (solo
  multi), advertencia de stock insuficiente (nunca bloquea). Caso mixto = dos
  líneas.
- [ ] **D3. Vistas de producción**: filtrar fuera líneas `stock`. Marcar
  producido sigue sin tocar stock (manda el predicado).
- [ ] **D4. Gaps + stock negativo visibles** (plan 2.7) en matriz de cobertura
  y ShowStock.

## Fase E — Conteo (fase 3 del plan + rider §1.5)

- [ ] **E1. Backend `stockCountService`** — draft/completed, conteo scoped a
  una bodega, completion baselinea pares (item, bodega), parcial permitido.
- [ ] **E2. `StockCount.vue`** — flujo guiado por categorías
  (`ingredientCategories.displayOrder`), inputs rápidos, draft reanudable,
  resumen final con merma **explicada** (Σ waste) vs **no explicada**
  (residuo del conteo).

## Fase F — Compras (fase 4 del plan + riders)

- [ ] **F1. Backend `purchaseService`** — doc multi-línea con `supplier` texto
  libre, bodega destino por línea, presentaciones entry-time, campos IVA,
  prompt de actualización de costo.
- [ ] **F2. UI de compras** — entrada keyboard-first; `preferredSupplier`
  pre-llena el proveedor.
- [ ] **F3. Producir para stock** — flujo para producto con receta **y**
  preparación stocked: +N en bodega destino, −componentes, preview antes de
  confirmar (modal desde ShowStock).

---

**Diferidos con trigger** (no construir hasta que duela): página Compras si
el modal simple alcanza primero, widget de split Bodega/Producir,
multi-ubicación de ingredientes (unlock solo-UI, el campo ya existe),
reportes por bodega, entidades proveedor (fase balance-sheet).
