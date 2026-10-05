# Inventario — Plan UX/UI

Plan de desarrollo UX del módulo de inventario, definido antes de tocar data
structures. El módulo es opt-in por bakery (`features.inventory.enabled`,
cobrado como adicional, se activa desde la vista Negocios del system admin).

---

## Modelo conceptual (decisiones cerradas)

- **Tres tipos de ítem, no tres bodegas:**
  1. **Ingredientes** — se compran (harina, azúcar).
  2. **Preparaciones intermedias** — un ingrediente que tiene receta (crema
     pastelera). Es un ingrediente que lleva `recipeId`.
  3. **Productos** — modo por producto: `Compro y vendo` (reventa),
     `Lo produzco` (con receta) o `Sin control de stock` (comportamiento
     actual; default en migración).
- **Bodegas = ubicaciones con nombre.** Sin tipos ni jerarquía. Si la bakery
  tiene una sola bodega (auto-creada "Principal"), todos los pickers de bodega
  se ocultan — el caso simple no paga el costo de la feature.
- **No hay bodega virtual ni stock-negativo-como-pendiente.** La elección
  explícita en el pedido lo reemplaza:
  - **"De bodega"** → stock del producto −N inmediato; el item **no aparece en
    las vistas de producción** (no hay nada que hornear).
  - **"Producir"** → el stock del producto no se toca nunca. El item fluye a
    producción como hoy; al marcarse producido consume ingredientes según
    receta y va al cliente. Neto cero en stock de producto.
  - **"Producir para stock"** → el único flujo que *suma* stock de producto
    (también carga preparaciones intermedias, descontando ingredientes).
  - Stock negativo solo sobrevive como "sobrevendiste de la bodega": se
    permite con advertencia, se corrige con conteo.
- **Ingredientes: una sola ubicación por ahora.** Todo movimiento lleva tag de
  bodega internamente (default "Principal"), así multi-ubicación de
  ingredientes a futuro es un unlock solo-UI, sin migración. Fundación = un
  campo, no una feature.
- **Multi-local:** catálogo/clientes/staff/reportes compartidos → una bakery
  con varias bodegas (caso "puntos de venta"). Negocios separados → bakeries
  separadas (multi-tenancy existente). **No** diseñar precios, permisos ni
  reportes por bodega hasta que un cliente lo pida; el tag de bodega en los
  items deja la data lista.
- **Default del pedido = setting por bakery** con tres valores:
  - `smart`: entrega hoy/POS → Bodega; fecha futura → Producir.
  - `siempre producir`: se comporta como hoy (default seguro de migración).
  - `siempre bodega`: negocios de pura reventa.
  El setting solo elige el valor **preseleccionado**; el toggle queda siempre
  visible en la línea mostrando la decisión resuelta — nunca magia oculta.

## Flujo completo del usuario

1. Cargo ingredientes y cuánto tengo (Ingredientes + ajuste inicial).
2. A cada producto le digo su modo y asigno receta (ProductForm → Recipe
   Manager).
3. Vendo normal; en cada línea decido (o acepto el default) Bodega/Producir.
4. Producción ve solo lo que se produce; al marcar producido se descuentan
   ingredientes.
5. Cuando quiero, produzco para stock (crema pastelera, pan de bonos de
   vitrina) y registro compras cuando llegan.
6. Cada 15/30 días hago el conteo guiado y la app me da el análisis
   esperado vs real.

---

## Spec por vista

### A. Pedidos

#### `OrderForm.vue` + `OrderItemsManager.vue` + `OrderLineItem.vue` — EXISTEN, modificar
- **Agregar (solo con inventory activo):** toggle por línea `Bodega /
  Producir` con default resuelto por el setting, siempre visible y volteable.
  Hint de stock junto al toggle (`en bodega: 4`). Picker de bodega origen solo
  si hay >1 bodega. Reventa: fijo en Bodega, sin toggle. Sin control de stock:
  idéntico a hoy. Bodega con stock insuficiente: advierte, permite.
- **Caso mixto** (quiere 5, hay 3, se hacen 2): el usuario agrega el producto
  en dos líneas (Bodega ×3, Producir ×2). Sin widget de split por ahora.
- **Lee:** `stockStore` (existencias de los productos del pedido),
  `bakerySettingsStore` (`features.inventory`), lo que ya lee.
- **Escribe:** cada item lleva su origen (`producir` | bodega elegida). El
  descuento de stock lo hace el backend al guardar, no el form.

### B. Productos

#### `ProductForm.vue` — EXISTE, modificar
- **Agregar:** sección "Inventario" (solo con feature activo): selector de
  modo (`Compro y vendo` / `Lo produzco` / `Sin control de stock`). Si "Lo
  produzco": resumen **read-only** de qué receta tiene cada
  variación/combinación, con botón "Gestionar recetas" que navega al Recipe
  Manager con el producto preseleccionado. Cero edición de recetas aquí.
- **Lee:** `recipeStore` (resumen de asignaciones).
- **Escribe:** modo de inventario del producto. Nada de recetas.

#### Recipe Manager — `views/recipes/ShowRecipes.vue` — REVIVIR + rediseñar
- **Hace:** directorio de recetas (nombre, tipo de destino, costo calculado,
  dónde se usa) + editor de asignación: producto → combinaciones → receta por
  combinación. Reusa `RecipeForm.vue` e `IngredientSelector.vue` para
  crear/editar la receta (una receta puede incluir preparaciones como
  ingrediente).
- **Lee:** `recipeStore`, `productStore`, `ingredientStore`.
- **Escribe:** `recipeStore` CRUD + asignaciones receta↔combinación.
- **PENDIENTE DE DISEÑO:** mecanismo exacto de asignación por combinación
  (¿receta base + escala por `variation.value` con overrides, o receta
  completa por combinación?). Se diseña aparte.
- `CreateRecipe.vue` probablemente se elimina (crear pasa a modal/inline).

### C. Inventario

#### `ShowStock.vue` — EXISTE, modificar
- **Agregar:** filtro por tipo (ingrediente/preparación/producto), filtro por
  bodega (oculto si hay 1; total con desglose si hay varias), valor del stock
  a costo, acción **Transferir** (item, cantidad, bodega→bodega, solo
  multi-bodega), acción **Producir para stock** (modal: item con receta +
  cantidad + bodega destino → descuenta ingredientes, suma stock).
- **Lee:** `stockStore.fetchAll()` como hoy.
- **Escribe:** `stockStore.adjust` (existe), + `transfer` y `produce`
  (nuevos métodos del store/service).

#### `StockMovementsModal.vue` — EXISTE, modificar
- **Agregar:** columna bodega, tipos de movimiento (compra, producción,
  consumo por receta, venta, transferencia, conteo) con link al pedido/lote
  cuando aplique (`getOrderMovements` ya existe).

#### `ShowIngredients.vue` + `IngredientForm.vue` — EXISTEN, modificar
- **Hoy:** CRUD, categorías desde settings. (El flag `isResale` se retiró — la
  reventa es `Product.inventoryMode: 'unit'`.)
- **Agregar:** acción por fila **Registrar compra** (modal: cantidad + costo
  total → movimiento de entrada + actualiza `costPerUnit`; bodega destino si
  multi). Para ingredientes con receta: link a su receta en Recipe Manager. Stock
  actual viene de `stockStore`, no editable aquí.
- **Quitar:** edición directa de `currentStock` en el form.
  `CreateIngredient.vue` sobra si el modal de `ShowIngredients` cubre
  creación.
- **Escribe:** `ingredientStore` CRUD + `stockStore` (movimiento de compra).
- *Diferido: página "Compras" multi-línea (una factura, muchos ingredientes)
  — cuando la entrada uno-a-uno moleste.*

#### Conteo de inventario — `views/inventory/StockCount.vue` — NUEVO
- **Hace:** flujo guiado de "hacer inventario". Recorre items agrupados y
  ordenados por `ingredientCategories.displayOrder` (productos al final),
  pregunta "¿cuánto hay de X?" con input rápido, muestra al final esperado vs
  contado con la diferencia valorada a costo, y al confirmar genera ajustes en
  lote + guarda el conteo como registro histórico.
- **Lee:** `stockStore`, `bakerySettingsStore` (categorías/orden).
- **Escribe:** ajustes en lote + documento de conteo.
- El "análisis de inventario" es la pantalla final de este flujo, no una
  página aparte.

### D. Configuración

#### `BakeryFeaturesForm.vue` — EXISTE, modificar
- **Agregar** al bloque inventory (el toggle enabled ya existe y se maneja
  desde Negocios): setting de default de pedido (`smart` / `siempre producir`
  / `siempre bodega`) y editor de bodegas (lista de nombres, marcar default,
  crear/renombrar; borrar solo si sin stock).

#### `AdminSidebar.vue` — EXISTE, modificar
- Sección Inventario (ya condicional) pasa de 1 a 4 links: **Existencias**,
  **Ingredientes**, **Recetas**, **Hacer Inventario**.

### E. Producción

#### `ShowProductionSingleItems.vue` + `ShowProductionGroupedItems.vue` — EXISTEN, modificar
- **Agregar:** filtrar fuera los items "de bodega" (no se producen). Marcar
  producido además consume ingredientes según receta (lo hace el backend).
- Sin columnas nuevas.

---

## Inventario de piezas

| Pieza | Estado |
|---|---|
| `StockCount.vue` | **nueva** |
| `ShowRecipes.vue` → Recipe Manager | rediseño |
| `OrderForm` / `OrderLineItem` / `OrderItemsManager`, `ProductForm`, `ShowStock`, `StockMovementsModal`, `ShowIngredients`, `IngredientForm`, `BakeryFeaturesForm`, `AdminSidebar`, vistas de producción | modificar |
| `CreateRecipe.vue`, `CreateIngredient.vue` | candidatas a borrar |
| Stores | ninguno nuevo; se extienden `stockStore`, `ingredientStore`, `recipeStore` |

## Pendientes (fuera de este plan)

1. **Diseño del editor de asignación receta↔combinación** (el usuario tiene
   una idea propia por discutir).
2. Contrastar este UX contra `zplanning/inventory/INVENTORY-PLAN.md` y decidir
   qué data structures sobreviven.
3. Diferidos con trigger: página Compras multi-línea, widget de split
   Bodega/Producir, multi-ubicación de ingredientes, reportes por bodega.
