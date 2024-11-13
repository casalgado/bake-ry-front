# Bakery Management System Design System

## 1. Design Principles

### Efficiency First
- Minimize clicks for common tasks
- Provide keyboard shortcuts for power users
- Show the most relevant information upfront
- Enable batch operations where possible

### Clarity & Consistency
- Use clear, descriptive labels
- Maintain consistent patterns throughout
- Provide visual feedback for actions
- Use status indicators for important states

### Error Prevention
- Validate input in real-time
- Provide clear error messages
- Confirm destructive actions
- Show helpful tooltips for complex features

## 2. Color Palette

### Primary Colors
- Primary Blue: `#2563eb` - Main actions, headers
- Secondary Blue: `#3b82f6` - Hover states, secondary elements
- Light Blue: `#bfdbfe` - Backgrounds, disabled states

### Semantic Colors
- Success: `#22c55e` - Positive actions, confirmations
- Warning: `#f59e0b` - Caution states, pending actions
- Error: `#ef4444` - Error states, destructive actions
- Info: `#3b82f6` - Informational elements

### Neutral Colors
- Text Primary: `#1e293b` - Main text
- Text Secondary: `#64748b` - Secondary text
- Border: `#e2e8f0` - Borders, dividers
- Background: `#f8fafc` - Page background
- White: `#ffffff` - Component background

## 3. Typography

### Font Family
- Primary: Inter (Sans-serif)
- Monospace: JetBrains Mono (for numerical data)

### Type Scale
- Display: 36px/2.25rem
- H1: 30px/1.875rem
- H2: 24px/1.5rem
- H3: 20px/1.25rem
- Body: 16px/1rem
- Small: 14px/0.875rem
- Tiny: 12px/0.75rem

## 4. Spacing System

Use consistent spacing increments:
- 4px/0.25rem: Minimal spacing
- 8px/0.5rem: Tight spacing
- 16px/1rem: Standard spacing
- 24px/1.5rem: Relaxed spacing
- 32px/2rem: Section spacing
- 48px/3rem: Large section spacing

## 5. Common Components

### Buttons
- Primary: Filled background, white text
- Secondary: Outlined, colored text
- Tertiary: Text only, no background
- Destructive: Red background for dangerous actions

### Form Elements
- Text inputs: Full width, consistent padding
- Select dropdowns: Custom styling with clear indicators
- Checkboxes/Radio: Clear active states
- Toggle switches: For boolean settings

### Data Display
- Tables: Clean lines, hover states
- Cards: Boxed content with consistent padding
- Lists: Clear hierarchy and spacing
- Stats: Bold numbers with labels

### Navigation
- Sidebar: Fixed position, collapsible
- Breadcrumbs: Clear path indication
- Tabs: Underlined active state
- Mobile menu: Hamburger with smooth animation

## 6. Layout Guidelines

### Grid System
- 12-column grid for desktop
- 4-column grid for tablet
- Single column for mobile
- Consistent gutters (16px/1rem)

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Container Widths
- Small: 640px max
- Medium: 768px max
- Large: 1024px max
- XL: 1280px max

## 7. Interaction States

### Buttons
- Default: Base color
- Hover: Darker shade
- Active: Darkest shade
- Disabled: Gray, reduced opacity

### Form Fields
- Default: Light border
- Focus: Primary color border
- Error: Red border
- Disabled: Gray background

### Links
- Default: Primary color
- Hover: Underline
- Visited: Darker shade
- Active: Darkest shade

## 8. Animation Guidelines

### Transitions
- Duration: 200ms
- Timing: ease-in-out
- Use for: Hover states, expanding panels, modals

### Loading States
- Skeleton screens for content loading
- Spinners for actions in progress
- Progress bars for longer operations

## 9. Accessibility Guidelines

### Color Contrast
- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Test all color combinations

### Focus States
- Visible focus rings
- Skip-to-main content link
- Keyboard navigation support

### Screen Readers
- Meaningful alt text
- ARIA labels where needed
- Proper heading hierarchy