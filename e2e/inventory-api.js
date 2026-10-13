// API arrange-helpers for the inventory suites, run against `es-alimento-dev` (`npm run seed:setup`).
// The bakery is shared and mutable, so every test mints its own uniquely named items here and asserts on
// those; seeded items (Focaccia, harina, Cold Brew) are only used for chain tests, by delta.
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { setPassword, STAFF_PASSWORD } from './helpers.js';

const AUTH = 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
export const BAKERY = 'es-alimento-dev';
const API = `http://127.0.0.1:5001/bake-ry/us-central1/bake/bakeries/${BAKERY}`;

export const INVENTORY_ADMIN = { email: 'es.alimento@gmail.com', password: 'alimento' };

let counter = 0;

// Lowercase on purpose: the screens render names with CSS `capitalize`, the stored text stays as typed.
export const uniqueName = (kind) => `e2e ${kind} ${Date.now().toString(36)}${++counter}`;

export const itemKey = ({ type = 'product', id, combinationId }) =>
  combinationId ? `${type}_${id}_${combinationId}` : `${type}_${id}`;

// Emulator-only reads and writes that bypass the API (rules are skipped for the `owner` token).
const FIRESTORE = `http://localhost:8080/v1/projects/bake-ry/databases/(default)/documents/bakeries/${BAKERY}`;
const OWNER = { Authorization: 'Bearer owner' };

export const firestore = (request) => ({
  // stockGaps docs of one order: [{ reason, name }]
  gaps: async (order) => {
    const res = await request.post(`${FIRESTORE}:runQuery`, {
      headers: OWNER,
      data: {
        structuredQuery: {
          from: [{ collectionId: 'stockGaps' }],
          where: { fieldFilter: { field: { fieldPath: 'orderId' }, op: 'EQUAL', value: { stringValue: order.id } } },
        },
      },
    });
    // One doc per order line, each with a `gaps` array of { item, name, reason }: flattened.
    return (await res.json())
      .filter((row) => row.document)
      .flatMap(({ document: { fields } }) => fields.gaps.arrayValue.values ?? [])
      .map(({ mapValue: { fields } }) => ({ reason: fields.reason.stringValue, name: fields.name.stringValue }));
  },

  // What the Firestore rules say to a signed-in user (the token of an `api()` login), not the owner bypass.
  ordersAs: async (token) => {
    const as = { Authorization: `Bearer ${token}` };
    const write = await request.patch(`${FIRESTORE}/orders/rules-probe?updateMask.fieldPaths=note`, {
      headers: as,
      data: { fields: { note: { stringValue: 'e2e' } } },
    });
    const read = await request.get(`${FIRESTORE}/orders?pageSize=1`, { headers: as });
    return { write: write.status(), read: read.status() };
  },

  // The module switch of the bakery (settings/default `features.inventory.enabled`).
  inventoryEnabled: async (enabled) => {
    const res = await request.patch(`${FIRESTORE}/settings/default?updateMask.fieldPaths=features.inventory.enabled`, {
      headers: OWNER,
      data: { fields: { features: { mapValue: { fields: { inventory: { mapValue: { fields: { enabled: { booleanValue: enabled } } } } } } } } },
    });
    if (!res.ok()) throw new Error(`inventoryEnabled -> ${res.status()} ${await res.text()}`);
  },

  // A half-finished close, as a crashed close leaves it: status `closing` with who and when, nothing frozen yet.
  forceClosing: async (count) => {
    const mask = ['status', 'closedAt', 'closedBy'].map((f) => `updateMask.fieldPaths=${f}`).join('&');
    const by = count.createdBy ?? {};
    const res = await request.patch(`${FIRESTORE}/stockCounts/${count.id}?${mask}`, {
      headers: OWNER,
      data: {
        fields: {
          status: { stringValue: 'closing' },
          closedAt: { timestampValue: new Date().toISOString() },
          closedBy: { mapValue: { fields: { userId: { stringValue: by.userId ?? 'e2e' }, name: { stringValue: by.name ?? 'e2e' } } } },
        },
      },
    });
    if (!res.ok()) throw new Error(`forceClosing -> ${res.status()} ${await res.text()}`);
  },

  // Sets the order's status and shippedAt in the document itself: no API, so no reconcile runs.
  forceShipped: async (order) => {
    const mask = 'updateMask.fieldPaths=status&updateMask.fieldPaths=shippedAt';
    const res = await request.patch(`${FIRESTORE}/orders/${order.id}?${mask}`, {
      headers: OWNER,
      data: { fields: { status: { integerValue: '2' }, shippedAt: { timestampValue: new Date().toISOString() } } },
    });
    if (!res.ok()) throw new Error(`forceShipped -> ${res.status()} ${await res.text()}`);
  },
});

export const api = async (request, credentials = INVENTORY_ADMIN) => {
  const login = await request.post(`${AUTH}?key=emulator`, {
    data: { ...credentials, returnSecureToken: true },
  });
  const { idToken } = await login.json();

  // A socket left idle while the browser runs gets reset by the functions emulator; reads and deletes are safe to repeat.
  const send = async (method, path, data) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await request.fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${idToken}` }, data });
      } catch (err) {
        if (!['GET', 'DELETE'].includes(method) || attempt === 3 || !/ECONNRESET/.test(err.message)) throw err;
      }
    }
  };

  const call = async (method, path, data) => {
    const res = await send(method, path, data);
    if (!res.ok()) throw new Error(`${method} ${path} -> ${res.status()} ${await res.text()}`);
    return res.json().catch(() => null);
  };

  const orderIds = [];
  const inv = {
    call,
    token: idToken, // for requests that go straight to the emulators (Firestore rules apply to it)

    // A team account of `role` (production_assistant, delivery_assistant, accounting_assistant, bakery_staff) with a known password.
    staff: async (role) => {
      const name = uniqueName(role);
      const email = `${name.replace(/\s+/g, '-')}@example.com`;
      await call('POST', '/users', { name, email, role, category: 'PER', phone: `3${String(Date.now()).slice(-7)}${String(++counter).padStart(2, '0')}`.slice(0, 10) });
      await setPassword(request, email);
      return { email, password: STAFF_PASSWORD };
    },

    // Not an `api`-level concern for most tests, but the one collection every product needs.
    collection: async () => (await call('GET', '/productCollections')).items[0],

    // A stocked ingredient with exact starting stock (`stock: 0` leaves it empty).
    ingredient: async ({ unit = 'g', cost = 5, stock = 0, stockBehavior = 'stocked' } = {}) => {
      const ingredient = await call('POST', '/ingredients', {
        name: uniqueName('ingr'),
        categoryId: 'harinas-y-almidones',
        categoryName: 'Harinas y Almidones',
        unit,
        costPerUnit: cost,
        stockBehavior,
      });
      if (stock) await inv.stockUp({ type: 'ingredient', id: ingredient.id }, stock);
      return { ...ingredient, type: 'ingredient' };
    },

    // mode: 'none' | 'unit' (resale) | 'recipe'. `recipe`: [{ ingredient, quantity }] (an `inv.ingredient()` result).
    // `costPrice`: a hand-typed cost (the product starts manual); left out, a recipe gives it its cost.
    product: async ({ mode = 'recipe', price = 10000, stock = 0, recipe, costPrice } = {}) => {
      const collection = await inv.collection();
      const product = await call('POST', '/products', {
        ...(costPrice !== undefined && { costPrice }),
        name: uniqueName('prod'),
        collectionId: collection.id,
        collectionName: collection.name,
        inventoryMode: mode,
        basePrice: price,
        taxPercentage: 0,
        variations: [],
        customAttributes: {},
        isActive: true,
      });
      if (recipe) {
        await call('POST', '/recipes', {
          name: product.name,
          productId: product.id,
          ingredients: recipe.map(({ ingredient, quantity }) => ({
            type: 'ingredient',
            id: ingredient.id,
            quantity,
          })),
        });
      }
      if (stock) await inv.stockUp({ type: 'product', id: product.id }, stock);
      return { ...product, type: 'product' };
    },

    // Adjusts to an exact starting number; the stocks doc already exists for any tracked item.
    stockUp: (item, qty) =>
      call('POST', `/stocks/${itemKey(item)}/adjust`, {
        qty,
        reason: 'e2e setup',
        idempotencyKey: randomUUID(),
      }),

    stock: async (item) => {
      const key = itemKey(item);
      const rows = await call('GET', `/stocks?itemKeys=${key}`);
      return rows.find((r) => r.itemKey === key);
    },

    movements: (item) => call('GET', `/stocks/${itemKey(item)}/movements?limit=100`),
    orderMovements: (order) => call('GET', `/stockMovements?orderId=${order.id}`),

    // One distinct client per test: the kitchen lists and order list are bakery-wide.
    client: (name = uniqueName('cliente')) =>
      call('POST', '/users', {
        name,
        email: `${name.replace(/\s+/g, '-')}@example.com`,
        phone: `3${String(Date.now()).slice(-7)}${String(++counter).padStart(2, '0')}`.slice(0, 10), // unique per client
        role: 'bakery_customer',
        category: 'B2C',
      }),

    // lines: [{ product: <inv.product()>, quantity, source: 'stock' | 'produce' }]
    order: async ({ client, lines, day = new Date(), status = 0, ...rest }) => {
      const noon = new Date(day);
      noon.setHours(12, 0, 0, 0);
      const order = await call('POST', '/orders', {
        userId: client.id,
        userName: client.name,
        userEmail: client.email,
        userPhone: client.phone,
        userCategory: client.category,
        preparationDate: noon.toISOString(),
        dueDate: noon.toISOString(),
        fulfillmentType: 'pickup',
        // `combination`: name of one of the product's combinations (its price and id travel with the line).
        orderItems: lines.map(({ product, quantity = 1, source = 'produce', combination }) => {
          const combo = combination && product.variations.combinations.find((c) => c.name.toLowerCase() === combination.toLowerCase());
          const price = combo ? combo.basePrice : product.basePrice;
          return {
            productId: product.id,
            productName: product.name,
            collectionId: product.collectionId,
            collectionName: product.collectionName,
            quantity,
            basePrice: price,
            currentPrice: price,
            fulfillmentSource: source,
            variation: null, // the backend rejects a missing key
            ...(combo && { combination: combo }),
          };
        }),
        ...rest,
      });
      orderIds.push(order.id);
      if (status) return inv.setStatus(order, status);
      return order;
    },

    setStatus: (order, status) => call('PATCH', `/orders/${order.id}`, { status }),

    // What the Entrega table's bulk toggle sends.
    bulkStatus: (orders, status) =>
      call('PATCH', '/orders/bulk-update', { updates: orders.map((o) => ({ id: o.id, data: { status } })) }),

    getOrder: (order) => call('GET', `/orders/${order.id}`),

    // Edits a saved order the way the form does: read it, change its lines, PUT it back.
    editLines: async (order, change) => {
      const current = await call('GET', `/orders/${order.id}`);
      current.orderItems.forEach(change);
      return call('PUT', `/orders/${order.id}`, current);
    },

    removeOrder: (order) => call('DELETE', `/orders/${order.id}`),

    // A seeded product by collection and name (Sourdough, Baguette, Focaccia...). Lists default to 10 rows, newest
    // first, so the seeded ones are asked for by collection. The backend capitalises names.
    seededProduct: async (collectionName, name) => {
      const same = (a, b) => a.toLowerCase() === b.toLowerCase();
      const found = (await call('GET', `/products?collectionName=${encodeURIComponent(collectionName)}&per_page=100`)).items
        .find((p) => same(p.collectionName, collectionName) && same(p.name, name));
      if (!found) throw new Error(`seeded product ${collectionName} / ${name} not found: run seed:setup`);
      return found;
    },

    // Adds a recipe to an existing product after the fact.
    addRecipe: (product, recipe) =>
      call('POST', '/recipes', {
        name: product.name,
        productId: product.id,
        ingredients: recipe.map(({ ingredient, quantity }) => ({ type: 'ingredient', id: ingredient.id, quantity })),
      }),

    provider: (name = uniqueName('prov')) => call('POST', '/providers', { name }),

    // lines: [{ item: <inv.ingredient()|inv.product()>, qty, total, updateCost }]
    purchase: ({ provider, lines, date }) =>
      call('POST', '/purchases', {
        providerId: provider.id,
        date: date ?? new Date().toISOString(),
        idempotencyKey: randomUUID(),
        lines: lines.map(({ item, qty, total, updateCost = false }) => ({
          item: { type: item.type, id: item.id, combinationId: null },
          qty,
          total,
          updateCost,
        })),
      }),

    // lines: [{ item, plannedQty }]
    run: ({ lines, date }) =>
      call('POST', '/productionRuns', {
        date: date ?? new Date().toISOString(),
        idempotencyKey: randomUUID(),
        lines: lines.map(({ item, plannedQty }) => ({
          item: { type: item.type, id: item.id, combinationId: null },
          plannedQty,
        })),
      }),

    runs: () => call('GET', '/productionRuns?per_page=100'),

    // Conteos: one open count per bodega, bakery-wide. Open-or-join, like the Empezar button.
    openCount: () => call('POST', '/stockCounts', {}),
    getCount: (count) => call('GET', `/stockCounts/${count.id}`),
    countItem: (count, item, qty) => call('PUT', `/stockCounts/${count.id}/items/${itemKey(item)}`, { qty }),
    closeCount: (count) => call('POST', `/stockCounts/${count.id}/close`),
    discardCount: (count) => call('POST', `/stockCounts/${count.id}/discard`),
    // Any open count is dropped, so a test starts with none (and leaves none).
    clearCounts: async () => {
      for (const count of (await call('GET', '/stockCounts')).filter((c) => c.status === 'open')) {
        await call('POST', `/stockCounts/${count.id}/discard`);
      }
    },

    verify: () => call('GET', '/stocks/verify'),
    verifyOrders: () => call('GET', '/stocks/verify-orders?days=14'),
    reconcileOrders: () => call('POST', '/stocks/reconcile-orders', {}),

    // An order the test made through the UI: found by its client, then cleaned up like the others.
    orderOf: async (client) => {
      let found;
      await expect
        .poll(async () => {
          found = (await call('GET', `/orders?userId=${client.id}`)).items.find((o) => o.userId === client.id);
          return Boolean(found);
        })
        .toBe(true);
      orderIds.push(found.id);
      return found;
    },

    // Soft-deletes what the test created so it never lingers in `committed` for shared items.
    cleanup: async () => {
      for (const id of orderIds) await call('DELETE', `/orders/${id}`).catch(() => {});
    },
  };
  return inv;
};
