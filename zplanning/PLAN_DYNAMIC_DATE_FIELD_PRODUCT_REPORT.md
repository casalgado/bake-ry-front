# PLAN: Make Date Field Dynamic in ProductReportCard

## Problem Analysis
The ProductReportCard component currently hardcodes the `date_field` to `'dueDate'` in the form data initialization (line 35). However, the app has a bakery settings feature that allows configuring the default report filter via `bakerySettings.features.reports.defaultReportFilter`.

## Solution
I need to integrate the bakery settings store into the ProductReportCard component to make the date field dynamic, following the same pattern used in the IncomeStatement component.

## Implementation Steps

1. **Import BakerySettingsStore**
   - Add `import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';` to the imports
   - Initialize the store: `const bakerySettingsStore = useBakerySettingsStore();`

2. **Load Settings on Mount**
   - In the `onMounted` hook, add code to fetch bakery settings before loading categories
   - Fetch the settings: `await bakerySettingsStore.fetchById('default');`

3. **Initialize Date Field Dynamically**
   - Get the default report filter from settings: `const settings = bakerySettingsStore.items[0];`
   - Use the bakery setting or fallback to 'dueDate': `settings?.features?.reports?.defaultReportFilter || 'dueDate'`
   - Set this value in the `formData.value.date_field` instead of hardcoding 'dueDate'

## Key Changes
- Line 3: Add bakery settings store import
- Line 8: Initialize bakery settings store
- Line 35: Change from hardcoded `'dueDate'` to dynamic value
- Line 152-157: Update onMounted to load settings first, then set dynamic date field

## Reference Implementation
This approach follows the exact same pattern already implemented in the IncomeStatement component (lines 23-31), ensuring consistency across the application.

### IncomeStatement Pattern (lines 23-31):
```javascript
onMounted(async () => {
  // Load default report filter from bakery settings
  await bakerySettingsStore.fetchById('default');
  const settings = bakerySettingsStore.items[0];
  if (!settings?.features?.reports?.defaultReportFilter) {
    throw new Error('Default report filter not found in bakery settings');
  }
  console.log('🍞 Default Report Filter:', settings.features.reports.defaultReportFilter);
  selectedDateFilterType.value = settings.features.reports.defaultReportFilter;
  // ... rest of initialization
});
```

## Expected Behavior
After implementation:
- When the component loads, it will automatically use the bakery's configured default report filter (dueDate or paymentDate)
- The date field dropdown will show the correct default selection based on bakery settings
- If no setting is found, it falls back to 'dueDate' to maintain backward compatibility
- The behavior will be consistent with other report components like IncomeStatement

## Files Affected
- `src/components/reports/ProductReportCard.vue` - Main component file requiring changes