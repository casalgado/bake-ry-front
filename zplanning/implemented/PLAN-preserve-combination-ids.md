# Plan: Preserve Combination IDs During Variation Edits

## Problem Statement

When editing product variations (adding/removing/reordering options), all combination IDs are regenerated. This breaks any external references to those combinations (orders, inventory, reports, etc.).

---

## Current Behavior Analysis

### Relevant Files

| File | Role |
|------|------|
| `src/components/forms/VariationsManager.vue` | Manages dimensions and options, triggers regeneration |
| `src/models/VariationGroups.js` | Model class, generates combinations |
| `src/components/forms/VariationCombinationManager.vue` | UI for editing prices (doesn't cause the issue) |

### Flow That Causes ID Regeneration

1. User edits an option (adds "Extra-grande", removes an option, reorders, etc.)

2. Deep watcher in `VariationsManager.vue:564-580` detects change:
   ```javascript
   watch(
     () => variationGroup.value.dimensions,
     () => {
       // ... debounced call to regenerateCombinations()
     },
     { deep: true }
   );
   ```

3. `regenerateCombinations()` (lines 235-312) is called:
   ```javascript
   const regenerateCombinations = () => {
     // Stores existing data by NAME (not ID)
     const existingCombinations = {};
     variationGroup.value.combinations.forEach(combo => {
       existingCombinations[combo.name] = {
         basePrice: combo.basePrice,
         costPrice: combo.costPrice,
         // NOTE: ID is NOT stored!
       };
     });

     // Generates NEW combinations with NEW IDs
     const newCombinations = variationGroup.value.generateCombinationsWithWholeGrainStatus();
     // ...
   };
   ```

4. `generateCombinationsWithWholeGrainStatus()` in `VariationGroups.js:745-765` always creates new IDs:
   ```javascript
   return new Combination({
     id: generateId(),  // <-- ALWAYS generates new ID
     selection,
     name: this.generateCombinationName(selection),
     // ...
   });
   ```

### Example: Adding an Option

**Before (2 combinations):**
```javascript
[
  { id: "abc123", selection: ["Pequeño"], name: "Pequeño", basePrice: 100 },
  { id: "def456", selection: ["Mediano"], name: "Mediano", basePrice: 150 }
]
```

**User adds "Extra-grande" option**

**After regeneration (3 combinations, ALL with new IDs):**
```javascript
[
  { id: "xyz111", selection: ["Pequeño"], name: "Pequeño", basePrice: 100 },  // ID changed!
  { id: "xyz222", selection: ["Mediano"], name: "Mediano", basePrice: 150 },  // ID changed!
  { id: "xyz333", selection: ["Extra-grande"], name: "Extra-grande", basePrice: 0 }  // New, expected
]
```

The first two combinations have identical selections but lost their original IDs.

---

## Proposed Solution

### Concept

Match new combinations to existing ones by their `selection` array. If a match is found, preserve the existing ID. If no match (genuinely new combination), use the newly generated ID.

### Why Match by Selection?

The `selection` array (e.g., `["Pequeño", "Chocolate"]`) is the true identity of a combination. When you:
- **Add** an option: Existing selections don't change
- **Remove** an option: Affected combinations disappear (no match needed)
- **Reorder** options: Selections don't change (display order is separate)

### Implementation

**File:** `src/components/forms/VariationsManager.vue`

**Replace** `regenerateCombinations()` function (lines 235-312) with:

```javascript
const regenerateCombinations = () => {
  if (props.isCategoryTemplateMode) {
    return;
  }

  const hasValidDimensions = variationGroup.value.dimensions.every(
    d => d.options.length > 0 && d.options.every(o => o.name),
  );

  if (!hasValidDimensions) {
    return;
  }

  // Step 1: Create lookup maps from existing combinations
  // Key by sorted selection for exact matching
  const existingBySelection = new Map();
  // Also keep by name for fallback
  const existingByName = new Map();

  variationGroup.value.combinations.forEach(combo => {
    const selectionKey = [...combo.selection].sort().join('|');
    existingBySelection.set(selectionKey, {
      id: combo.id,
      basePrice: combo.basePrice,
      costPrice: combo.costPrice,
      accountingCode: combo.accountingCode,
      selection: combo.selection,
    });
    existingByName.set(combo.name, {
      id: combo.id,
      basePrice: combo.basePrice,
      costPrice: combo.costPrice,
      accountingCode: combo.accountingCode,
      selection: combo.selection,
    });
  });

  // Step 2: Generate new combinations (with temporary new IDs)
  const newCombinations = variationGroup.value.generateCombinationsWithWholeGrainStatus();

  // Step 3: Match and preserve IDs where possible
  const updatedCombinations = newCombinations.map(combo => {
    const selectionKey = [...combo.selection].sort().join('|');

    // Try exact selection match first (handles add/remove/reorder)
    let matched = existingBySelection.get(selectionKey);

    // Fallback: try name match
    if (!matched) {
      matched = existingByName.get(combo.name);
    }

    // Fallback: partial matching for multi-dimension cases
    if (!matched) {
      let bestMatch = null;
      let bestMatchCount = 0;

      for (const [, oldData] of existingBySelection) {
        const sharedPrimaryValues = oldData.selection.filter(item => {
          const dim = variationGroup.value.getDimensionForOption(item);
          return dim && ['WEIGHT', 'QUANTITY', 'SIZE'].includes(dim.type) &&
                 combo.selection.includes(item);
        });

        if (sharedPrimaryValues.length > bestMatchCount) {
          bestMatch = oldData;
          bestMatchCount = sharedPrimaryValues.length;
        }
      }

      if (bestMatch) {
        matched = bestMatch;
      }
    }

    return {
      ...combo,
      id: matched?.id || combo.id,  // PRESERVE existing ID if matched
      basePrice: matched?.basePrice || 0,
      costPrice: matched?.costPrice || 0,
      accountingCode: matched?.accountingCode || '',
    };
  });

  variationGroup.value.combinations = updatedCombinations;
};
```

---

## What This Handles

| User Action | Selection Changes? | ID Preserved? |
|-------------|-------------------|---------------|
| Add new option | No (for existing) | Yes |
| Remove option | N/A (combo removed) | N/A |
| Reorder options | No | Yes |
| Edit price/cost/code | No | Yes (different flow) |
| Rename option (e.g., "Small" → "Pequeño") | **Yes** | **No** |

### Limitation: Renaming Options

When an option is renamed, the `selection` array changes because it stores option names, not IDs:
- Before: `["Small", "Chocolate"]`
- After rename: `["Pequeño", "Chocolate"]`

To fully handle renaming, we'd need to refactor `selection` to store option IDs instead of names. This is a larger change affecting:
- `VariationGroups.js` - selection storage and name generation
- `Combination.js` - selection handling
- Backend storage format
- Any code that reads/displays selections

**Recommendation:** Accept this limitation for now. Renaming options is less common than adding/removing. Document that renaming an option will regenerate combination IDs for affected combinations.

---

## Testing Checklist

- [ ] Add new option to single-dimension product → existing IDs preserved
- [ ] Add new option to multi-dimension product → existing IDs preserved
- [ ] Remove option → removed combinations gone, others preserved
- [ ] Reorder options (move up/down) → IDs preserved
- [ ] Edit prices in combination manager → IDs preserved (existing behavior)
- [ ] Rename option → IDs regenerated (expected limitation)
- [ ] Save product and reload → IDs persist correctly
- [ ] Orders referencing combinations still link correctly after adding options

---

## Files to Modify

1. **`src/components/forms/VariationsManager.vue`**
   - Replace `regenerateCombinations()` function (lines 235-312)

That's it. Single file change.

---

## Future Consideration

If renaming options becomes a frequent need, consider:
1. Adding stable IDs to options in dimensions
2. Storing option IDs in `selection` instead of names
3. Generating display names from option IDs at render time

This would require a data migration for existing products.
