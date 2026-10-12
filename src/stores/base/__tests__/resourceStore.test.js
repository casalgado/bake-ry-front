import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createResourceStore } from '../resourceStore';

// Overlapping fetches can land out of order. Only the newest request may write
// the list, set the error or clear the loading flag.
describe('resourceStore.fetchAll with overlapping requests', () => {
  beforeEach(() => setActivePinia(createPinia()));

  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  const storeFor = (...answers) => {
    const getAll = vi.fn();
    answers.forEach((answer) => getAll.mockReturnValueOnce(answer.promise));
    return createResourceStore('things', { getAll })();
  };

  it('keeps the newest answer when an older one arrives last', async () => {
    const slow = deferred();
    const fast = deferred();
    const store = storeFor(slow, fast);

    const first = store.fetchAll();
    const second = store.fetchAll();
    fast.resolve({ data: [{ id: 'new' }] });
    await second;
    slow.resolve({ data: [{ id: 'old' }] });
    await first;

    expect(store.items).toEqual([{ id: 'new' }]);
    expect(store.loading).toBe(false);
  });

  it('an older failure neither sets the error nor ends the loading of a newer fetch', async () => {
    const slow = deferred();
    const fast = deferred();
    const store = storeFor(slow, fast);

    const first = store.fetchAll().catch(() => {});
    const second = store.fetchAll();
    slow.reject(new Error('boom'));
    await first;

    expect(store.error).toBeNull();
    expect(store.loading).toBe(true);

    fast.resolve({ data: [{ id: 'new' }] });
    await second;
    expect(store.loading).toBe(false);
    expect(store.items).toEqual([{ id: 'new' }]);
  });

  it('a lone fetch still loads and reports its error', async () => {
    const failing = deferred();
    const store = storeFor(failing);

    const request = store.fetchAll().catch(() => {});
    failing.reject(new Error('boom'));
    await request;

    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
  });
});
