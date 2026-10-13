import { request as pwRequest } from '@playwright/test';

// API arrange-helpers for the `e2e-orders` bakery. Specs create data here and assert through the UI.
const AUTH = 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const API = 'http://127.0.0.1:5001/bake-ry/us-central1/bake/bakeries/e2e-orders';
const API_KEY = 'emulator'; // the Auth emulator accepts any key

export const ORDERS_ADMIN = { email: 'admin-orders@e2e.test', password: 'e2e-orders' };
export const DRIVER = { email: 'driver-orders@e2e.test', password: 'driver' };

// A marker for one test's rows: shown under the client name (internal notes) and unique even
// if two tests land on the same day. One word, because the table title-cases the note.
export const uniqueNote = () => `e2e${Math.random().toString(36).slice(2, 8)}`;

// Days are relative to today, like real use: tests share today and tomorrow, find their rows
// by note, and get anything they must count from a product of their own (createProduct).
// Reports work on a month and add up everything in it, so each report test takes a month
// nobody has used (see freeMonth), starting two months out: day tests stay within a day or two
// of today, so never reach it.
const FIRST_REPORT_MONTH = 2;
const LAST_REPORT_MONTH = 24;

export const inDays = (n) => {
  const day = new Date();
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() + n);
  return day;
};

// The 15th of the month n months ahead.
export const inMonths = (n) => {
  const day = new Date();
  day.setHours(12, 0, 0, 0);
  day.setDate(15);
  day.setMonth(day.getMonth() + n);
  return day;
};

export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const call = async (request, token, method, path, data) => {
  const res = await request.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  if (!res.ok()) throw new Error(`${method} ${path} -> ${res.status()} ${await res.text()}`);
  return res.json();
};

// Uses its own request context, not the test fixture's: the fixture records every call in the
// trace, and its temp files break (ENOENT) after a few dozen calls.
export const api = async (credentials = ORDERS_ADMIN) => {
  const request = await pwRequest.newContext();
  const res = await request.post(`${AUTH}?key=${API_KEY}`, {
    data: { ...credentials, returnSecureToken: true },
  });
  const { idToken } = await res.json();
  const get = (path) => call(request, idToken, 'GET', path);

  const products = Object.fromEntries((await get('/products')).items.map((p) => [p.name, p]));
  const users = Object.fromEntries((await get('/users')).items.map((u) => [u.name, u]));

  // line: { product: 'pan campesino', variation?: 'Grande', quantity }
  const toItem = ({ product, variation, quantity = 1 }) => {
    const p = products[product];
    const combo = variation && p.variations.combinations.find((c) => c.name === variation);
    const price = combo ? combo.currentPrice : p.currentPrice;
    return {
      productId: p.id,
      productName: p.name,
      collectionId: p.collectionId,
      collectionName: p.collectionName,
      quantity,
      basePrice: price,
      currentPrice: price,
      ...(combo && { combination: combo }),
    };
  };

  const monthRange = (n) => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth() + n, 1),
      end: new Date(now.getFullYear(), now.getMonth() + n + 1, 0, 23, 59, 59, 999),
    };
  };

  const hasOrdersOn = async (field, { start, end }) => {
    const query = `date_field=${field}&start_date=${start.toISOString()}&end_date=${end.toISOString()}&per_page=1`;
    return (await get(`/orders?${query}`)).pagination.total > 0;
  };

  return {
    products,
    users,
    // The first month from two months out with no order due or paid in it, as an offset in
    // months. Reruns on the same emulator move on to the next month.
    freeMonth: async () => {
      for (let n = FIRST_REPORT_MONTH; n <= LAST_REPORT_MONTH; n++) {
        const range = monthRange(n);
        if (!(await hasOrdersOn('dueDate', range)) && !(await hasOrdersOn('paymentDate', range))) return n;
      }
      throw new Error('No free report month left; reseed the emulator');
    },
    // A product no other test sells, so grouped views and sums can be read without
    // knowing what else is on the day. Same collection as Pan Campesino.
    createProduct: async (price = 5000) => {
      const name = `pan ${uniqueNote()}`;
      const base = products['pan campesino'];
      const product = await call(request, idToken, 'POST', '/products', {
        name,
        collectionId: base.collectionId,
        collectionName: base.collectionName,
        basePrice: price,
        taxPercentage: 0,
      });
      products[product.name] = product;
      return product;
    },
    // client: 'Cliente Persona' | 'Cliente Empresa'
    createOrder: ({ client, day, lines, ...rest }) => {
      const u = users[client];
      return call(request, idToken, 'POST', '/orders', {
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        userPhone: u.phone,
        userCategory: u.category,
        invoiceGracePeriod: u.invoiceGracePeriod,
        preparationDate: day.toISOString(),
        dueDate: day.toISOString(),
        fulfillmentType: 'pickup',
        orderItems: lines.map(toItem),
        ...rest,
      });
    },
    getOrder: (id) => get(`/orders/${id}`),
    patchOrder: (id, data) => call(request, idToken, 'PATCH', `/orders/${id}`, data),
  };
};
