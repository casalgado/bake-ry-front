# PLAN — Retirar `Ingredient.isResale`, mover reventa a `Product`

**Fecha:** 2026-09-07
**Estado:** aprobado y ejecutado 2026-09-07 — fases 1, 2, 3 y 5.
Fase 0 (medición) no se corrió: requiere consultar Firestore en vivo. Se aplicó
la **opción 1 de §5.2** (regla hacia adelante, sin migrar el histórico), que es
la única segura sin esa medición. Fase 4 queda pendiente por decisión del propio
plan (§4.7: no parchear `EntryDoc.vue`, aplicar la regla al escribir
`PurchaseDoc.vue` / `ProductionDoc.vue`); `modeOf` se agrega ahí, con consumidor.
Fase 6 no aplica bajo la opción 1.
**Alcance:** backend `bake-ry/functions` + frontend `bake-ry-front` + docs de estrategia

---

## 0. Hallazgo que cambia el plan — leer primero

El objetivo pedido fue *"quitar `isResale` de ingredient y agregarlo a product"*.

**La mitad de agregar ya está hecha, y con mejor nombre.** El campo que representa
"producto de reventa" ya existe, ya está implementado en el backend y ya está
ratificado en la estrategia:

```
Product.inventoryMode: 'none' | 'unit' | 'recipe'
```

- `'unit'` — **es exactamente el producto de reventa.** "Store-style. Tracks
  units of the sellable item (the coke, the bag of beans). Sale deducts its own
  stock; restocked via Compras." (`INVENTORY-IMPLEMENTATION.md` §5)
- `'recipe'` — lo que se produce.
- `'none'` — sin control (default; todos los productos existentes).

Y la estrategia rechaza explícitamente agregar un flag aparte:

> **§5:** *"Not two product types — **one behavior field**. A separate 'resale
> product' type would fork every form, list, POS view, and report; the only thing
> that actually differs is what happens to stock when a unit is sold."*

**Recomendación: NO agregar `Product.isResale`.** Agregarlo crea un segundo flag
redundante que contradice una decisión cerrada, y obliga a resolver el caso
imposible `isResale: true` + `inventoryMode: 'recipe'`.

El plan que sigue asume esto. Si preferís el flag explícito de todas formas,
decilo y lo reescribo — pero entonces hay que decidir primero qué pasa cuando
los dos campos se contradicen.

Lo que queda es entonces:

| Pedido | Realidad |
|---|---|
| Agregar reventa a `Product` | **Ya existe** como `inventoryMode: 'unit'` (backend listo) |
| Quitar `isResale` de `Ingredient` | **Sí, hay que hacerlo** — está vestigial |
| — | **El trabajo real:** el frontend no conoce `inventoryMode` en absoluto |

---

## 1. Auditoría del estado actual

### 1.1 Dónde vive `isResale` hoy — inventario completo

**Backend** (`bake-ry/functions/src`)

| Archivo | Línea | Qué hace | Al retirar |
|---|---|---|---|
| `models/Ingredient.js` | 21, 74 | Declara y asigna el campo | Borrar |
| `models/Ingredient.js` | 64 | `if (recipeId && isResale) throw` — guarda de construcción | Borrar (queda vacía) |
| `controllers/ingredientController.js` | 26-28 | Valida que sea booleano | Borrar |
| `services/recipeService.js` | 241-245 | **La única regla real:** rechaza enlazar una receta a un ingrediente de reventa | Borrar |
| `models/Recipe.js` | 23 | Comentario aclaratorio (`type` de componente ≠ `isResale`) | Reescribir |
| `seeds/data/ingredients.js` | 161 | `Café Beatriz 500g`, `isResale: true` | **Migrar a producto** (§5) |
| `seeds/data/seededIngredients.json` | 18 ocurrencias | Datos sembrados, 17× `false`, 1× `true` | Regenerar |
| `__tests__/services/ingredientService.test.js` | 20 | Fixture `isResale: false` | Borrar la clave |
| `__tests__/services/recipeService.graph.test.js` | 18, 578 | Fixture + test `seedIngredient('gaseosa', { isResale: true })` | Borrar el caso |
| `__tests__/services/stockService.test.js` | 527 | Fixture | Borrar la clave |

**Frontend** (`bake-ry-front/src`)

| Archivo | Línea | Qué hace | Al retirar |
|---|---|---|---|
| `views/ingredients/ShowIngredients.vue` | 35 | `typeLabel: ingredient.isResale ? 'Reventa' : 'Producción'` — **única superficie de UI** | Borrar la columna |
| `models/Ingredient.js` | 11, 48 | Declara y asigna | Se regenera (§3.3) |
| `components/forms/IngredientForm.vue` | 14 | Comentario describiendo el alcance del form viejo | Reescribir |
| `views/recipes/RecipeBookView.vue` | 782 | Comentario: *"`isResale` is left to default to false"* | Borrar la frase |

### 1.2 Lo que el flag realmente hace hoy

**Una sola cosa: impedir que un ingrediente tenga receta.**

No lo lee ningún código de inventario, de pedidos, ni de precios. `stockService`
nunca lo consulta. No hace nada comprable, vendible, ni visible fuera de una
columna de tabla.

### 1.3 Por qué está mal ubicado

`models/Order.js` referencia **solo `productId`** — no existe `ingredientId` ni
`itemType` en un ítem de pedido. Un ingrediente **no puede venderse**,
estructuralmente.

El propio seed lo delata (`seeds/data/ingredients.js:155`):

```js
{
  name: 'Café Beatriz 500g',
  unit: 'unidades',
  costPerUnit: 18000,
  isResale: true,              // "bought and sold as-is"
  preferredSupplier: 'Café Beatriz',
}
```

Una bolsa de café de 500 g que el cliente levanta del mostrador — y que hoy **no
se puede vender**, porque es un ingrediente: tiene costo pero no precio, no tiene
colección, y no hay campo donde meterla en un pedido.

El flag describe algo que la entidad donde vive no puede hacer.

### 1.4 Lo que YA está implementado en el backend

| Pieza | Estado | Evidencia |
|---|---|---|
| `Product.inventoryMode` + enum `INVENTORY_MODES` | ✅ | `models/Product.js:39,77` |
| Validación de modo | ✅ | `services/productService.js:13-18` |
| Deducción según modo | ✅ | `services/stockService.js:362` |
| Alta de stocks docs por producto | ✅ | `syncProductStockDocs`, `stockService.js:359` |
| `Ingredient.stockBehavior` (passThrough/stocked) | ✅ | `models/Ingredient.js:10,31,79` |
| `Ingredient.recipeId` (preparaciones) | ✅ | `models/Ingredient.js:30,78` |
| Resolución de receta de preparación en el grafo | ✅ | `services/recipeGraph.js:100-107` |

### 1.5 Lo que NO existe en el frontend

| Pieza | Estado |
|---|---|
| `inventoryMode` | ❌ **cero ocurrencias en todo `src/`** |
| `stockBehavior` | ❌ solo una escritura hardcodeada en `RecipeBookView.vue:783` |
| `recipeId` en el modelo de ingrediente del front | ❌ el modelo está desactualizado |
| Selector de modo en `ProductForm.vue` | ❌ (es la tarea B1 de `inventory-next-steps.md`) |
| `IngredientForm.vue` | ❌ stub vacío desde 2026-09-01 |

**Consecuencia operativa:** todo producto creado desde el frontend nace con
`inventoryMode: 'none'` (el default). Hoy, en la práctica, **ningún producto
lleva inventario**, porque no hay forma de decir que sí.

---

## 2. Decisión

### 2.1 El modelo destino

| Concepto | Entidad | Campo | Vendible | Se produce | Se compra |
|---|---|---|---|---|---|
| Croissant | `Product` | `inventoryMode: 'recipe'` | ✅ | ✅ | ❌ |
| Coca-Cola / Café Beatriz | `Product` | `inventoryMode: 'unit'` | ✅ | ❌ | ✅ |
| Producto sin control | `Product` | `inventoryMode: 'none'` | ✅ | — | — |
| Harina | `Ingredient` | `recipeId: null` | ❌ | ❌ | ✅ |
| Crema pastelera | `Ingredient` | `recipeId` + `stockBehavior` | ❌ | ✅ | ❌ |

Regla derivada, limpia y sin solapamiento — la que necesitan las pantallas de
Ingreso y Producción:

- **Ingreso** = ingredientes sin receta **+** productos con `inventoryMode: 'unit'`
- **Producción** = productos con `inventoryMode: 'recipe'` **+** ingredientes con `recipeId`

### 2.2 Qué pasa con la guarda que se pierde

Al borrar `isResale` desaparece la regla *"un ingrediente de reventa no puede
tener receta propia"* (`recipeService.js:241`).

**No hay que reemplazarla.** Bajo el modelo destino ningún ingrediente es de
reventa, así que la condición nunca puede dispararse. La regla se vuelve vacía,
no ausente.

Lo que sí hay que conservar es la guarda **contigua** (`recipeService.js:247`),
que impide reasignar una receta a un ingrediente que ya tiene otra. Esa es una
regla distinta y sigue siendo necesaria.

---

## 3. Cambios — Backend

### 3.1 `src/models/Ingredient.js`

- Quitar `isResale` de la firma del constructor (línea 21) y la asignación (74).
- Borrar la guarda `if (recipeId && isResale)` (64-68).
- Ajustar el comentario de `recipeId` — hoy dice *"non-resale only"*; pasa a ser
  simplemente opcional.

### 3.2 `src/controllers/ingredientController.js`

- Borrar la validación de booleano (26-28).
- **Decidir:** ¿rechazar `isResale` si llega en el payload, o ignorarlo en
  silencio? Recomiendo **ignorar** durante una release y rechazar después, para
  no romper un cliente viejo en caché.

### 3.3 `src/services/recipeService.js`

- Borrar el bloque 241-245 (`planOwnerLink`).
- Conservar 247-251 (receta ya asignada).
- Actualizar el comentario de cabecera del bloque (225-230), que menciona la
  regla que se va.

### 3.4 `src/models/Recipe.js`

- Reescribir el comentario de la línea 23. Ya no hay `isResale` con el cual
  confundir el `type` del componente; la aclaración útil que queda es
  componente-producto vs componente-ingrediente.

### 3.5 Seeds

- `seeds/data/ingredients.js` — quitar `Café Beatriz 500g` de la lista de
  ingredientes (150-162) y crearlo como **producto** con `inventoryMode: 'unit'`,
  con `collectionId`, `basePrice` y `costPrice`.
- `seeds/data/seededIngredients.json` — regenerar sin la clave.
- `seeds/runners/seedIngredients.js` — revisar; hoy fuerza
  `stockBehavior: STOCKED` (línea 19), lo cual conviene revisar aparte pero no
  bloquea este plan.
- Agregar al seed de productos al menos un `inventoryMode: 'unit'` y uno
  `'recipe'`, para que el frontend tenga con qué probar Ingreso y Producción.

### 3.6 Tests

- `__tests__/services/ingredientService.test.js:20` — quitar la clave del fixture.
- `__tests__/services/recipeService.graph.test.js:18` — quitar del fixture.
- `__tests__/services/recipeService.graph.test.js:578` — **borrar el caso**
  `seedIngredient('gaseosa', { isResale: true })`; comprueba una regla que deja
  de existir. Si conviene, reemplazarlo por un test de producto
  `inventoryMode: 'unit'`.
- `__tests__/services/stockService.test.js:527` — quitar la clave.

> Los tests no se corren sin permiso explícito. Este plan solo los enumera.

### 3.7 Lo que NO cambia

- `Product.inventoryMode` — ya está, no se toca.
- `stockService` — ya discrimina por modo, no se toca.
- `Ingredient.stockBehavior` y `Ingredient.recipeId` — se quedan.
- **No se agrega `Product.isResale`.**

---

## 4. Cambios — Frontend

### 4.1 Modelos: correr el sync, no editar a mano

`back/functions/scripts/syncModels.js` copia `src/models/` del backend al
frontend con transformación a ES6. **Está desactualizado**: el
`front/src/models/Ingredient.js` no declara `recipeId`, `stockBehavior` ni
`preferredSupplier`, que el backend sí tiene.

Hoy no rompe nada porque los stores pasan JSON crudo desde la API sin
instanciar el modelo — pero cualquier cosa que construya la clase pierde tres
campos en silencio.

**Acción:** después de los cambios de backend, correr `node scripts/syncModels.js`.
Eso arregla la deriva y propaga la baja de `isResale` de una sola vez.
Verificar que `Product.js` traiga `inventoryMode`.

### 4.2 `views/ingredients/ShowIngredients.vue`

- Borrar `typeLabel` de `processData` (35) y su columna de la tabla.
- **No reemplazar con nada.** La distinción reventa/producción deja de existir
  para ingredientes.

### 4.3 `views/recipes/RecipeBookView.vue`

- Línea 782: borrar la frase sobre `isResale` del comentario. El resto del
  comentario (por qué `stockBehavior: 'stocked'`) sigue vigente.
- `createIngredient` (760-799) no cambia de comportamiento.

### 4.4 `components/forms/IngredientForm.vue`

Es un stub vacío. Solo hay que corregir el comentario de alcance (14): la
reconstrucción futura **no** debe incluir el flag `isResale`. El alcance pasa a
ser: nombre, descripción, categoría, unidad, `costPerUnit`, temperatura,
`preferredSupplier`, atributos custom, `stockBehavior`, y receta opcional.

### 4.5 `components/forms/ProductForm.vue` — el trabajo real

Es la tarea **B1** de `inventory-next-steps.md`, y este plan la vuelve
bloqueante: sin ella no hay forma de marcar un producto como de reventa, y por
lo tanto Ingreso no tiene qué mostrar.

Sección **"Inventario"**, visible solo con el feature activo, en el lenguaje que
exige `INVENTORY-IMPLEMENTATION.md` §11.1 (sin jerga):

| Opción | Valor | Texto |
|---|---|---|
| Sin control | `none` | "No controlo inventario de este producto" |
| Reventa | `unit` | "Compro y vendo unidades" |
| Producción | `recipe` | "Lo preparo con ingredientes (receta)" |

- Default `none`, saltable.
- `RadioFeatureCard` ya existe en `components/forms/`.
- Con `recipe`: resumen read-only de recetas por combinación + link al Recipe
  Manager.
- Revisar también `ProductWizard.vue` (613 líneas) — si es el camino real de
  creación, el selector va ahí y no solo en el form.

### 4.6 `composables/useItemCatalog.js`

`kindOf` (84-87) hoy devuelve `'prod'` para cualquier producto. Con el modelo
destino, Ingreso y Producción necesitan distinguir `unit` de `recipe`.

Dos opciones:

- **A** — agregar `modeOf(item)` al composable y que cada pantalla filtre. Menos
  invasivo, `kindOf` sigue siendo "en qué estante va".
- **B** — partir `'prod'` en `'prod_unit'` / `'prod_recipe'`. Contamina
  `SHELF_TITLES`, que hoy lo comparten el recetario y Existencias.

**Recomiendo A.** `kindOf` responde "qué es"; el modo es una pregunta distinta y
merece su propia función.

### 4.7 `views/inventory/*` — corregir el reparto de estantes

`EntryDoc.vue:45-78` hoy declara:

```js
ingreso:    shelves: ['ingr', 'prod']   // ← deja "comprar" tus propios croissants
produccion: shelves: ['prod', 'prep']
```

Con el modelo destino:

- **Ingreso** → `ingr` + productos `inventoryMode === 'unit'`
- **Producción** → `prep` + productos `inventoryMode === 'recipe'`

Esto se cruza con el rediseño de Ingreso/Producción en dos archivos separados.
**Sugerencia: no parchear `EntryDoc.vue` — aplicar la regla directamente en
`PurchaseDoc.vue` y `ProductionDoc.vue` cuando se escriban.** Parchear un
archivo que se va a borrar es trabajo tirado.

---

## 5. Migración de datos — la parte difícil

`INVENTORY-IMPLEMENTATION.md` §10 dice *"no data migration required"*. Eso valía
para agregar `inventoryMode`. **Retirar `isResale` sí requiere migración**, y no
es mecánica.

### 5.1 El problema: un ingrediente de reventa no se convierte en producto solo

Un `Ingredient` con `isResale: true` que deba pasar a `Product` necesita datos
**que no existen** en el documento origen:

| Campo del producto | ¿De dónde sale? |
|---|---|
| `basePrice` / `currentPrice` | ❌ **No existe.** El ingrediente solo tiene `costPerUnit` |
| `collectionId` / `collectionName` | ❌ No existe. La categoría de ingrediente es otra taxonomía |
| `taxPercentage` | ❌ No existe |
| `inventoryMode` | ✅ `'unit'` por definición |
| `name`, `costPrice` | ✅ Directos |

**Ningún script puede inventar un precio de venta.** La migración es
necesariamente asistida por una persona, ítem por ítem.

### 5.2 El problema mayor: el itemKey del libro mayor

`stockService.buildItemKey` (66-79) construye:

```
ingredient_{ingredientId}
product_{productId}
product_{productId}_{combinationId}
```

Mover un ítem de ingrediente a producto **le cambia el itemKey**. Y el libro de
movimientos es **append-only** — por diseño no se reescribe.

Consecuencia: todo el historial de compras, ventas, conteos y ajustes de ese
ítem queda bajo `ingredient_{viejoId}`, mientras el ítem vivo pasa a ser
`product_{nuevoId}`. En la práctica:

- Existencias muestra el producto nuevo **en cero**.
- El historial del ítem viejo queda huérfano: sin catálogo que resuelva su
  nombre, se degrada a un itemKey crudo.
- El valor de la bodega se descuadra en el monto del stock migrado.

**Tres salidas, en orden de preferencia:**

1. **No migrar el histórico. Aplicar la regla solo hacia adelante.**
   Se retira el flag del modelo, y los ingredientes que hoy lo tienen en `true`
   simplemente quedan como ingredientes normales (comprables, no vendibles). Si
   el negocio necesita venderlos, se crea el producto a mano y se transfiere el
   saldo con un **ajuste explícito** en cada punta — que es exactamente el
   mecanismo que Existencias ya ofrece y que deja rastro honesto en el libro.
   *Es la opción barata y la única que no miente sobre la historia.*

2. **Migrar con un movimiento de compensación.** Existe `type: 'compensation'`
   en las etiquetas de movimiento (`ShowStock.vue:179` — "Correcciones"). Un
   script escribe la baja en el ingrediente y el alta en el producto, ambos como
   `compensation`, con una nota que los enlaza. El libro queda cuadrado y
   auditable, pero es un script real con transacciones.

3. **Reescribir el libro.** Descartada. Rompe la invariante central del diseño.

### 5.3 Alcance real de la migración

Antes de decidir hay que medir. Consulta por bakery:

- ¿Cuántos ingredientes tienen `isResale: true`?
- De esos, ¿cuántos tienen `stockBehavior: 'stocked'` (o sea, un stocks doc)?
- De esos, ¿cuántos tienen movimientos en el ledger?

**Si la tercera respuesta es cero — que es lo más probable, porque el módulo de
inventario está detrás de un feature flag y las pantallas de escritura no
existen todavía — la opción 1 es gratis y el problema desaparece.**

Esta consulta es el primer paso ejecutable del plan.

---

## 6. Cambios — Documentación de estrategia

| Archivo | Línea | Cambio |
|---|---|---|
| `INVENTORY-IMPLEMENTATION.md` | 27 | Quitar `isResale` de la descripción de `Ingredient` |
| `INVENTORY-IMPLEMENTATION.md` | 90 | §4: *"non-resale ingredient (`isResale: false`, the default)"* → *"ingrediente de producción"*. El argumento de identidad no cambia |
| `INVENTORY-IMPLEMENTATION.md` | 299 | Tabla §10: la fila `Ingredient` dice `type` enum → `isResale` boolean. Reescribir: el flag se retira; `recipeId` deja de ser "non-resale only" |
| `INVENTORY-IMPLEMENTATION.md` | ~305 | La frase *"All changes are additive; no data migration required"* **deja de ser cierta**. Anotar §5 de este plan |
| `INVENTORY-PLAN.md` | 90 | *"optional `recipeId` (non-resale only — reject when `isResale`)"* → simplemente opcional |
| `INVENTORY-PLAN.md` | 155 | *"For non-resale ingredients only"* → para todos los ingredientes |
| `inventory-ux-plan.md` | 14 | *"Es un ingrediente con `isResale: false` (el default)"* → *"un ingrediente con receta"* |
| `inventory-ux-plan.md` | 122 | *"Hoy: CRUD con flag `isResale`"* → actualizar |
| `inventory-ux-plan.md` | 125 | *"Para ingredientes de producción (no reventa)"* → quitar el paréntesis |
| `inventory-next-steps.md` | 64 | B2: *"para no-reventa (`isResale: false`)"* → quitar la condición |
| `ui/README.md` | 99, 114, 153 | Sección "Reventa" y las menciones en la tabla de documentos: reventa pasa a ser un **modo de producto**, no un tipo de ingrediente |
| `ui/existencias-prototype.html` | 318, 336, 429 | Prototipo con `resale:true` en un ítem de shelf `prod`. **Ya es correcto conceptualmente** (lo modela como producto). Dejar como está o anotar |

`ui/EXISTENCIAS-BUILD.md:96` ya habla de `inventoryMode: 'none'` — es
consistente con el modelo destino, no requiere cambios.

---

## 7. Orden de trabajo

Cada fase deja el sistema funcionando. Ninguna depende de una fase posterior.

### Fase 0 — Medir (bloqueante, ~30 min)
- Consultar cuántos ingredientes `isResale: true` existen, cuántos tienen stocks
  docs y cuántos tienen movimientos.
- **Salida:** elegir opción 1 / 2 / 3 de §5.2. Con cero movimientos, opción 1 y
  el resto del plan se simplifica mucho.

### Fase 1 — Backend: retirar el flag
- §3.1 a §3.4 (modelos, controller, recipeService).
- §3.5 seeds.
- §3.6 tests — *pedir permiso antes de correrlos.*
- **Verificación:** crear un ingrediente con receta; ya no hay camino por el que
  la guarda pueda dispararse.

### Fase 2 — Sync de modelos + limpieza de frontend
- `node scripts/syncModels.js`.
- §4.2 `ShowIngredients.vue` — quitar la columna.
- §4.3 y §4.4 — comentarios.
- **Verificación:** el listado de ingredientes ya no muestra "Reventa";
  `front/src/models/Product.js` ahora trae `inventoryMode`.

### Fase 3 — `ProductForm`: el selector de modo (B1)
- §4.5. Es la fase con trabajo de UI real.
- **Verificación:** crear un producto "Coca-Cola 400 ml" en modo `unit`;
  confirmar que el backend le genera su stocks doc (`syncProductStockDocs`) y
  que aparece en Existencias.

### Fase 4 — Reparto de estantes en las pantallas de inventario
- §4.6 `modeOf` en `useItemCatalog`.
- §4.7 — **aplicar la regla al escribir `PurchaseDoc.vue` / `ProductionDoc.vue`,
  no parchear `EntryDoc.vue`.**
- **Verificación:** la Coca-Cola aparece en Ingreso y no en Producción; el
  croissant al revés.

### Fase 5 — Documentación
- §6 completo. Al final, para que refleje lo construido y no lo planeado.

### Fase 6 — Migración de datos (solo si Fase 0 la exige)
- Según la opción elegida.

---

## 8. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Historial del ledger huérfano al mover un ítem entre entidades | **Alta** | Fase 0 mide el alcance; opción 1 de §5.2 lo evita por completo |
| Precio de venta inexistente en el ingrediente origen | Alta | La migración es asistida, nunca automática |
| Se agrega `Product.isResale` además de `inventoryMode` | Media | Este plan lo rechaza; requiere decisión explícita para revertirlo |
| El frontend sigue creando todo con `inventoryMode: 'none'` | Media | Fase 3 es la que lo resuelve; sin ella, Ingreso queda sin catálogo |
| `syncModels.js` sobrescribe ediciones manuales en `front/src/models/` | Baja | Revisar el diff del sync antes de commitear |
| Un cliente con caché vieja manda `isResale` en el payload | Baja | Ignorar en silencio una release antes de rechazar (§3.2) |

---

## 9. Preguntas abiertas

1. **¿Se confirma no agregar `Product.isResale`?** El plan asume que
   `inventoryMode: 'unit'` es la representación de reventa. Es la decisión de
   mayor impacto del documento.
2. **¿Qué pasa con los ingredientes `isResale: true` que existan?** Depende de
   Fase 0. Si hay movimientos, hay que elegir entre opción 1 y 2 de §5.2.
3. **¿El selector de modo va en `ProductForm` o en `ProductWizard`?** Hay que
   ver cuál es el camino real de creación hoy.
4. **`seedIngredients.js:19` fuerza `stockBehavior: STOCKED` para todo.**
   Probablemente incorrecto (el default de diseño es `passThrough`), pero es un
   problema aparte. ¿Se arregla acá o se abre suelto?
