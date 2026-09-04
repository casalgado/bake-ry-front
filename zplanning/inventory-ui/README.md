# Inventory UI — design decisions

Working notes for the two inventory front-end views. Design decisions only; the *why* of the data model lives in [../strategy/INVENTORY-IMPLEMENTATION.md](../strategy/INVENTORY-IMPLEMENTATION.md) and the sequence in [../strategy/INVENTORY-PLAN.md](../strategy/INVENTORY-PLAN.md) (this covers plan items 1C.2 and 1C.3).

- `recetas-prototype.html` — clickable layout prototype for the recipes view. Open it in a browser; it has no dependencies. It is a **layout and interaction** prototype, not the styling target and not component-accurate.
- `existencias-prototype.html` — same, for the stock view. Same rules: no dependencies, layout and interaction only.

## Design principles

1. **Fun.** The user should want to keep going. Progression (cobertura), live reward (margen), physical gestures (drag). Information and behavior first — no decorative graphics.
2. **Concrete.** Everything reads as moving real things: a mesa you put things on, a despensa you take them from.

---

## View 1 — Recetas (cobertura)

### The task
Not "assign recipes" and not "create recipes" — **cover every combination of a product with a costed recipe**. A recipe is born owned; creating and assigning are one act.

### Model facts that shape the UI

- Product without variations → the **product** holds `recipeId`. With variations → **each combination** holds its own. Resolution: `hasVariations ? combination.recipeId : product.recipeId`.
- **No fallback.** A combination with no recipe never borrows the product's. Missing = visible gap, never a guess.
- **A recipe has exactly one owner.** Two combinations can never point at the same recipe doc (that 1:1 is what lets `totalCost` write back to `costPrice`). "Assigning" an existing recipe is therefore always **copying** it.
- Recipe components are typed `ingredient` or `product` — **never `recipe`**. Nesting happens because the *item* has a recipe: a production ingredient expands via `qty / yield`, a product component via its own recipe.
- Scale factors (×2) are **entry-time only**. Nothing stores the multiplier; copies are independent from the moment they exist (icing doesn't scale with sponge).

### Layout

Two columns, one tab rail on top. **The tab carries the mode, the columns never change meaning within a tab.**

**Tab "Recetario"** — permanent, never closes
- Left: products, each with a coverage indicator (pips + `4/6`), grouped by category. Overall counter + bar at top (`12 / 30`).
- Right: the selected product's combinations — recipe sí/no, costo, precio, margen.
- Picking a product fills the right column. No navigation. Clicking a combination opens it as a tab.

**Tab per combination** — dynamic, closable
- Left: **la mesa** — the recipe lines. Always.
- Right: **la despensa** — the shelves. Always.
- Sibling combinations as chips under the title (`500g ✓ · 1000g ○`) so the covering pressure follows you in; clicking one switches/opens its tab.
- Transition: opening a combination flies the recipe from Recetario's right column into the new tab's left column. One transition, then both columns hold still.

### La despensa — four shelves

The shelves *are* the component types, and the object decides the semantics, so the gesture never has to:

| Shelf | Drop result |
|---|---|
| **Ingredientes** | one line |
| **Preparaciones** (production ingredients) | **one line that stays whole** — keeps its own recipe and cost, expands at deduction time |
| **Productos** | one line; choose the combination if the product has variations |
| **Recetas** (other combinations' recipes) | **dissolves into its lines** — the flatten/accumulate case |

This is how "pegar líneas" and "usar como componente" stop being confusable: different objects, different landing behavior, same gesture.

### Actions

**Orientarse** — ver cobertura · elegir producto · elegir combinación (skipped when no variations)
**Crear** — empezar en blanco · empezar desde otra receta · escalar al sembrar (pre-filled from the size ratio, with preview)
**Construir** — agregar ingrediente · agregar preparación · agregar producto · crear ingrediente al vuelo · cambiar cantidad · quitar línea · pegar líneas de otra receta · escalar la receta completa ×N
**Cerrar el costo** — ver costo y margen en vivo · adoptar el costo calculado (shows manual vs. computed, flips `costPriceSource`)
**Multiplicar** — copiar a otras combinaciones (independent copies) · quitar la receta de una combinación

### Deliberately skipped

- Per-line "no escala" flags — needs a model field and is a stored relationship; you fix exceptions by hand after ×N.
- A "base recipes" template library — every recipe needs an owner, so templates would be a new backend entity. Any existing recipe is already a template via "empezar desde otra receta".
- Read-only recipe preview before editing — the mesa is editable on open; a combination row can expand inline for a peek.
- Sale-price editing (lives in the product form) and "where is this preparación used" (phase 2's gap surface).
- Building two combinations side by side in one tab.

### Open

- Name for the permanent tab: *Recetario* / *Vista general* / *Cocina* / *Mesón* / *Cobertura*. Currently **Recetario**.
- Drag a line *out* of the mesa to remove it (prototype uses an ×).
- Scale-preview before a dropped recipe dissolves (prototype lands it at ×1).
- Inline ingredient creation (prototype's search box promises it, doesn't do it).
- "Apply to all combinations sharing this option" (e.g. every *chocolate*) — in this view or later.

---

## View 2 — Existencias

### The task
Recetas answers *what do we make and what does it cost*. Existencias answers a narrower pair: **what do we have right now, and is that number true?** Reading reality, and correcting it when the shelf disagrees with the screen. Not planning, not purchasing decisions.

### Model facts that shape the UI

- **The number on screen is never editable.** It's a running total derived from an append-only ledger. You never type `42` into a stock field — you record *what happened* and the number moves. This is what makes the number trustworthy.
- Movements are never deleted. A mistake is corrected with another movement.
- `writeMovements` is **batch** — so the UI gesture is batch too. You load a whole delivery, not one row at a time.
- Items with `inventoryMode: 'none'` never appear here at all. Silence is the feature.
- **There is no `minStock`.** Without a reorder point "bajo" is undefinable — the view can only honestly flag *cero* and *negativo*. Backend ask, not this phase.

### Vocabulary (locked)

| UI | code | covers |
|---|---|---|
| **Ingreso** | `stockEntry` | lo que llega de afuera: compra de ingredientes, producto para reventa |
| **Producción** | `productionRun` | lo que hacemos: productos **y preparaciones** |
| **Conteo** | `stockCount` | inventario físico |
| **Merma / Salida** | — | one-line actions on an item, not documents |

### Why not an order

The first instinct was that "cargar productos" should create an order so production sees it. Rejected:

- An order is a **promise to a client** — it carries a client, a price, revenue, and it lands in sales reports, client persistency and accounting. A fake-client order pollutes all of it; a flagged internal order taxes every report forever with `if (!order.isInternal)`.
- **Wrong tense.** *Cargar* is past — the product is in your hands now. An order is future. Two different acts at two different moments.
- The production↔stock link already runs the right way: production **consumes** ingredients (out) and **yields** product (in). Stock is production's output, not its request.

"Pedirle a producción que llene la bodega" is a real feature — a *production request* — but it's a separate entity, it belongs with production, and it's a backend ask.

### Reventa

First-class, not an afterthought. Some tenants resell as their main business and have no other inventory: for them an **Ingreso** of finished product is the only flow they'll ever use, and Recetas/Producción stay empty and silent.

### Layout

Same shell as Recetas, and one rule carries across both views:

> **Left is always the thing you're building. Right is always where you take things from.**

Mesa/despensa there, documento/bodega here. Same gesture, second time — that's what makes it one app.

**Tab "Bodega"** — permanent, never closes, never gets a dot. It's a place, not a task.
- Left: valor total + the three actions, then the items grouped by shelf (**Ingredientes · Preparaciones · Productos**), each row big-number-first with unit and value. Cero muted, negativo in red.
- Right: the selected item — its number, its worth, its cost, and **its full movement history**: date, quantity, why, who.
- Clicking an item fills the right column. **No tab opens.** Selecting fills the right column; starting work opens a tab.

**Tabs de trabajo** — dynamic, closable, one per open document:
- **Ingreso** — left: lines with cantidad *and costo unitario*, proveedor and fecha on the document. Right: ingredientes + productos to drag from.
- **Producción** — left: productos y preparaciones with quantities. Right: those two shelves.
- **Conteo** — single column. You write **what's there**, the system shows what it thought and computes the difference. Never write the adjustment.

Each work tab carries its own progress in the label (`Ingreso · 3 ●`, `Conteo · 34/60 ●`), so parked work is legible without opening it.

### Why tabs and not modals

Loading a delivery and counting a bodega are **long, interruptible tasks**. A modal forces you to finish or lose it. Two documents open at once is a real scenario: you're halfway through the monthly count and a delivery arrives. The cost is a pattern users learn once — and they're already learning it in Recetas.

### The payoff moment

Confirm → the tab closes, you land back on Bodega, and the affected rows count up with a flash. Same role that *margen* plays in Recetas: the number that rewards finishing.

### The purchase carries the price

Buying 20kg of flour is one event with two facts: you have more flour, *and* flour costs something different now. The line carries `cantidad × costo unitario`, and the ingredient's `costPrice` follows. Sending the user to the ingredient form separately is exactly how cost data goes stale.

### Actions

**Ver** — existencias por estante · valor total de la bodega · lo que está en rojo · buscar · historia completa de un item
**Ingresar** — compra de ingredientes (multi-línea, con costo) · producto para reventa
**Producir** — registrar productos y preparaciones hechas
**Corregir** — conteo físico (escribes lo que hay) · merma · salida manual

**Nunca** — editar el número directamente · borrar un movimiento · mostrar items con `inventoryMode: 'none'`

### Backend asks (do not improvise)

1. Does a movement carry a **unit cost**, and does an ingreso update the ingredient's `costPrice`?
2. If it does — do recipes referencing that ingredient recompute `totalCost`, and does that touch products with `costPriceSource: 'recipe'`? Cost propagation has real teeth.
3. Can a movement carry a **reference** back to the document that caused it (ingreso / producción / conteo)?
4. `minStock` / reorder point — needed before "bajo" can exist.
5. The `productionRun` **document** (status, date, planned vs. real lines) is a new entity. Lazy alternative for this phase: no document, "entró de producción" is just a batch of in-movements. Ships Existencias complete with zero new endpoints; loses planned-vs-real.

### Deliberately skipped

- A **Salida** tab. A merma is one line — it's an action on the item in Bodega, not a workspace. Nothing that small deserves a tab.
- Reorder alerts, purchase suggestions, supplier management — all of it is planning, and this view reads reality.
- Editing a confirmed document. Corrections are new movements.

### Open

- Does an unconfirmed document survive a reload, or is a tab session-only?
- Conteo scope: whole bodega, or one shelf at a time? (Prototype counts everything.)
- Does *Producción* consume the ingredients it used, or only add the output? (Prototype only adds — consumption presumably belongs to the recipe deduction, but this needs settling.)
- Proveedor as free text or an entity.
