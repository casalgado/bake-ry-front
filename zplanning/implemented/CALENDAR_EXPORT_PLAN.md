# Calendar Export Feature Plan

## Overview
Add export functionality to `ShowDeliveryCalendar.vue` allowing users to export day, week, or month calendar views as PNG/PDF files.

## Feasibility Assessment
✅ **VIABLE** - The existing DataCalendar component renders structured HTML with Tailwind styles, making it suitable for export using html2canvas or similar libraries.

## Key Considerations

### Challenges
| Challenge | Impact | Notes |
|-----------|--------|-------|
| **Dynamic content** | Low | Calendar displays live order data - straightforward rendering |
| **Styling preservation** | Medium | Tailwind styles should render; complex layouts may shift |
| **Image quality** | Medium | html2canvas produces raster; text can blur at low DPI |
| **Performance** | Medium | Large month views may be CPU-intensive |
| **Icons** | Low | Phosphor icons render as SVG within canvas |
| **Modals/Dialogs** | N/A | Won't export (separate DOM) - exclude from export scope |

### Recommended Approach
1. **Use html2canvas** (lightweight, no backend needed, suitable for table/calendar exports)
2. **Alternative: jsPDF** (better quality/styling for structured documents)
3. **Export scope**: Calendar table only (exclude headers, dialogs, action bars)
4. **File format**: PNG or PDF (needs decision)
5. **Size handling**: Month views may need wider rendering than screen width

## Outstanding Decisions

### Technical
- [ ] **File format**: PNG (raster) vs PDF (better for documents)?
- [ ] **Column selection**: Export all columns or only delivery-relevant ones?
- [ ] **Styling**: Include full colors/styling or minimal visual export?
- [ ] **DPI/Resolution**: What quality is acceptable for users?

### UX
- [ ] **Button placement**: Next to PeriodSelector? In ActionBar?
- [ ] **Customization**: Allow users to select which columns to export?
- [ ] **File naming**: Auto-generate based on period (e.g., `delivery-calendar-2025-12-15.png`)?
- [ ] **Loading state**: Show progress during export (especially for large months)?

## Implementation Steps (Once Approved)

1. **Install dependency** - html2canvas or jsPDF
2. **Create export utility** - Wrapper for rendering and download logic
3. **Add export button** - Integrate into ShowDeliveryCalendar.vue UI
4. **Handle edge cases**:
   - Loading states during render
   - Error handling (failed exports)
   - Large data sets (month views)
5. **Test across period ranges** - Day/Week/Month exports
6. **Browser compatibility** - Verify export works across target browsers

## Related Files
- `src/views/orders/ShowDeliveryCalendar.vue` - Main view to add export feature
- `src/components/DataCalendar/index.vue` - Calendar component being exported
- `src/components/common/PeriodSelector.vue` - Period selection (affects export scope)

## Notes
- Server is already running, no setup needed
- Vue 3 Composition API with Pinia for state management
- Tailwind CSS for styling
- Follow project conventions: script setup, scoped styles
