# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

when producing vue components, the order of the sections will always be script, template, styles. 
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Development Commands

- **Development server**: `npm run dev` - Starts Vite dev server
- **Build**: `npm run build` - Production build using Vite
- **Preview**: `npm run preview` - Preview production build locally
- **Deploy**: `npm run deploy` - Deploy to Firebase hosting (bake-ry environment)
- **Linting**: No specific lint command defined, but ESLint is configured

## Project Architecture

This is a Vue 3 bakery management system with the following stack:
- **Frontend**: Vue 3 with Composition API, Vite, Tailwind CSS
- **State Management**: Pinia stores
- **Routing**: Vue Router with role-based guards
- **Authentication**: Firebase Auth with custom backend integration
- **UI Components**: Headless UI, Phosphor Icons, custom component library
- **Data Tables**: Custom DataTable and DataCalendar components with @carsalhaz/vue-data-table
- **Forms**: TanStack Vue Form (@tanstack/vue-form)
- **Backend Communication**: Axios for API calls
- **Deployment**: Firebase hosting

### Key Architectural Patterns

#### Multi-Role Dashboard System
The application has role-based dashboards with different sidebars and access controls:
- **Admin Dashboard**: Full bakery management (orders, products, users, settings)
- **Accounting Dashboard**: Financial reports and payment tracking  
- **Driver Dashboard**: Delivery orders and driver-specific summaries
- **Production Dashboard**: Production orders, schedules, and manufacturing views

#### Authentication & Authorization
- Firebase Authentication integrated with custom backend
- Role-based route guards in router (`requiresAuth`, `allowedRoles`)
- User roles: `system_admin`, `bakery_admin`, `bakery_staff`, `bakery_customer`, `delivery_assistant`, `production_assistant`, `accounting_assistant`
- Authentication state managed in Pinia store with automatic token refresh

#### Service Layer Architecture
All API communication is abstracted through service classes:
- Base `resourceService.js` provides CRUD operations
- Specialized services extend base: `orderService.js`, `productService.js`, etc.
- Services are paired with Pinia stores for state management
- API endpoints switch between local development and production based on environment

#### Custom Component System
- **DataTable**: Advanced table component with filtering, sorting, pagination, undo history
- **DataCalendar**: Calendar view for order management with drag/drop
- **Forms**: Reusable form components with validation (OrderForm, ProductForm, etc.)
- All custom renderers for table cells (MoneyCell, DateCell, CheckboxCell, etc.)

#### File Structure Patterns
- `src/views/`: Page components organized by feature domain (orders, products, bakeries)
- `src/components/`: Reusable UI components, forms, and complex widgets
- `src/services/`: API service layer with consistent patterns
- `src/stores/`: Pinia stores mirroring the service structure
- `src/utils/`: Shared utilities like export functions and helpers

### Important Technical Details

#### Environment Configuration
- Development mode uses auth emulator when `VITE_USE_AUTH_EMULATOR=true`
- API URL switches between local (`localhost:5001`) and remote based on environment
- Firebase configuration in `src/config/firebase.js`

#### Component Conventions
- Vue SFC structure: `<script>`, `<template>`, `<style>` (as per CLAUDE.md instructions)
- PascalCase for component names in templates
- Composition API with Pinia for state management
- TanStack forms for complex form validation

#### Styling Approach
- Tailwind CSS for utility-first styling
- Custom base styles in `src/assets/`
- Comprehensive design system documented in `StyleGuidelines.md`
- SVG icons loaded via vite-svg-loader with currentColor support

#### Code Quality
- ESLint configured with Vue-specific rules
- Single quotes, 2-space indentation, trailing commas
- No unused variables warnings disabled, strict formatting rules enabled 
- Act as a senior engineer with lot's of experience. Don't accept all my ideas immediately, be critical, think things step by step and try to provide the best solution. Sometimes I make mistakes and propose ideas that are not great, I would like it if you could help me improve my own thinking, instead of accepting it blindly.