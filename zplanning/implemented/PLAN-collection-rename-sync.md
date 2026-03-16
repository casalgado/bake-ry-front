# Plan: Sync Product Collection Names on Rename

## Problem
When a ProductCollection is renamed, products that belong to it keep the old `collectionName` (stale denormalized data). This causes confusion in the UI since products show outdated category names.

## Solution
When a collection is renamed, atomically update all products that belong to it using a Firestore transaction.

## Architecture Decision
- **Transaction happens on the backend** in `productCollectionService.js`
- Frontend calls existing endpoint; backend auto-detects name change
- If transaction fails, nothing changes (safe rollback)
- **Minimal changes** - only override `update` method in collection service

---

## Implementation Plan

### Phase 1: Backend Changes

**File to modify:** `functions/src/services/productCollectionService.js`

**What to do:** Override the `update` method (similar to how `remove` is already overridden)

```javascript
// services/productCollectionService.js
const { db } = require('../config/firebase');
const ProductCollection = require('../models/ProductCollection');
const createBaseService = require('./base/serviceFactory');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const createProductCollectionService = () => {
  const baseService = createBaseService(
    'productCollections',
    ProductCollection,
    'bakeries/{bakeryId}',
  );

  // NEW: Override update to sync product collectionNames
  const update = async (collectionId, data, bakeryId, editor = null) => {
    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Get current collection
        const collectionRef = baseService.getCollectionRef(bakeryId).doc(collectionId);
        const collectionDoc = await transaction.get(collectionRef);

        if (!collectionDoc.exists) {
          throw new NotFoundError('Product collection not found');
        }

        const currentCollection = ProductCollection.fromFirestore(collectionDoc);
        const nameChanged = data.name && data.name !== currentCollection.name;

        // 2. If name changed, get all products with this collectionId
        let productsToUpdate = [];
        if (nameChanged) {
          const productsRef = db
            .collection(`bakeries/${bakeryId}/products`)
            .where('collectionId', '==', collectionId);

          const productsSnapshot = await transaction.get(productsRef);
          productsToUpdate = productsSnapshot.docs;

          // Safety check: Firestore transaction limit is 500 writes
          if (productsToUpdate.length > 498) { // 498 + collection + history = 500
            throw new BadRequestError(
              `Esta colección tiene ${productsToUpdate.length} productos. ` +
              'Por favor contacta soporte para renombrar colecciones grandes.'
            );
          }
        }

        // 3. Update the collection
        const updatedCollection = new ProductCollection({
          ...currentCollection,
          ...data,
          id: collectionId,
          updatedAt: new Date(),
        });

        const changes = baseService.diffObjects(currentCollection, updatedCollection);
        await baseService.recordHistory(transaction, collectionRef, changes, currentCollection, editor);
        transaction.update(collectionRef, updatedCollection.toFirestore());

        // 4. Update all products with new collectionName
        if (nameChanged) {
          productsToUpdate.forEach((productDoc) => {
            transaction.update(productDoc.ref, {
              collectionName: data.name,
              updatedAt: new Date(),
            });
          });
        }

        return {
          ...updatedCollection,
          _productsUpdated: productsToUpdate.length, // Informational
        };
      });
    } catch (error) {
      console.error('Error in updateProductCollection:', error);
      throw error;
    }
  };

  const remove = async (collectionId, bakeryId) => {
    // ... existing remove code unchanged ...
  };

  return {
    ...baseService,
    update,  // NEW: override update
    remove,
  };
};

module.exports = createProductCollectionService();
```

**Why this works:**
- Uses existing transaction pattern (same as `remove` and `productService.update`)
- Auto-detects if `name` changed by comparing `data.name` vs `currentCollection.name`
- Only queries products if name actually changed (efficient)
- All updates happen in single transaction (atomic)
- Includes safety check for >498 products (Firestore limit)

---

### Phase 2: Frontend Changes

**No changes required!**

- Existing `productCollectionStore.update()` calls the same endpoint
- Real-time subscriptions will automatically update products in the store
- The frontend doesn't need to know about the product sync logic

---

### Phase 3: Testing Strategy

**3.1 Unit Tests (Backend)**

Add to `functions/src/__tests__/services/productCollection.test.js`:

```javascript
describe('update with name change', () => {
  it('should update collectionName on all related products', async () => {
    // Setup: Create collection + 3 products
    // Action: Update collection name
    // Assert: All 3 products have new collectionName
  });

  it('should rollback if product update fails', async () => {
    // Setup: Create collection + products, mock one product update to fail
    // Action: Attempt rename
    // Assert: Collection still has old name, products unchanged
  });

  it('should not touch products if name unchanged', async () => {
    // Setup: Create collection + products
    // Action: Update collection description (not name)
    // Assert: Products unchanged
  });

  it('should handle collection with 0 products', async () => {
    // Setup: Create collection with no products
    // Action: Rename collection
    // Assert: Collection renamed successfully
  });

  it('should reject rename if >498 products', async () => {
    // Setup: Mock collection with 500 products
    // Action: Attempt rename
    // Assert: BadRequestError thrown
  });
});
```

**3.2 Manual QA Checklist**

- [ ] Rename a collection with 1 product → product shows new name
- [ ] Rename a collection with 10+ products → all products updated
- [ ] Rename a collection with 0 products → no errors
- [ ] Edit collection description (not name) → products unchanged
- [ ] Check old orders still show original collection name
- [ ] Open two browser tabs, rename in one → other tab updates via real-time

---

### Phase 4: Rollout

1. **Write unit tests first** (TDD approach)
2. **Implement the `update` override**
3. **Test locally** with Firebase emulator
4. **Deploy to staging** and run manual QA
5. **Deploy to production**
6. **Monitor** Cloud Functions logs for errors

---

## Files Summary

| File | Change |
|------|--------|
| `functions/src/services/productCollectionService.js` | Override `update` method |
| `functions/src/__tests__/services/productCollection.test.js` | Add unit tests |
| Frontend | **No changes** |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Transaction fails mid-way | None | Firestore transactions are atomic |
| >500 products in collection | Very Low | Safety check with clear error message |
| Existing stale data | Low impact | Self-heals when collection is edited |

---

## Answered Questions

1. ~~Backend repo location~~ → `bake-ry/functions/src/`
2. ~~New endpoint vs modify existing~~ → Modify existing `update` (minimal changes)
3. ~~One-time cleanup~~ → Let it self-heal (no migration script needed)
