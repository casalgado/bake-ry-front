import { config } from '@vue/test-utils';
import { vi } from 'vitest';

// CRITICAL SAFETY CHECK: Prevent tests from running against production auth
const useAuthEmulator = import.meta.env.VITE_USE_AUTH_EMULATOR;
if (useAuthEmulator !== 'true' && useAuthEmulator !== true) {
  console.error('🚨 CRITICAL ERROR: Tests MUST run with VITE_USE_AUTH_EMULATOR=true');
  console.error('Current value:', useAuthEmulator);
  console.error('Type:', typeof useAuthEmulator);
  console.error('Tests are BLOCKED to prevent hitting production Firebase Auth');
  console.error('');
  console.error('To fix this:');
  console.error('1. Ensure .env.local contains: VITE_USE_AUTH_EMULATOR=true');
  console.error('2. Never set VITE_USE_AUTH_EMULATOR=false in any environment file');
  console.error('3. Do not override this variable when running tests');
  process.exit(1);
}

// Mock window.matchMedia for Headless UI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage to avoid authentication token errors
const localStorageMock = {
  getItem: vi.fn((key) => {
    if (key === 'AuthToken') return 'mock-auth-token';
    return null;
  }),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock HeadlessUI Dialog to prevent FocusTrap warnings
const MockDialog = {
  name: 'Dialog',
  props: ['open'],
  emits: ['close'],
  template: '<div v-if="open" class="mock-dialog"><slot /></div>',
};

const MockDialogPanel = {
  name: 'DialogPanel',
  template: '<div class="mock-dialog-panel"><slot /></div>',
};

// Configure global test utils
config.global.stubs = {
  teleport: true,
  Teleport: true,
  Dialog: MockDialog,
  DialogPanel: MockDialogPanel,
};

config.global.components = {
  Dialog: MockDialog,
  DialogPanel: MockDialogPanel,
};

// Mock fetch to prevent network requests
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: {
      get: vi.fn(),
    },
  })
);

// Mock XMLHttpRequest for axios
global.XMLHttpRequest = vi.fn().mockImplementation(() => ({
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  readyState: 4,
  status: 200,
  response: '{}',
  responseText: '{}',
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// Mock AbortController for cleaner test teardown
global.AbortController = vi.fn().mockImplementation(() => ({
  abort: vi.fn(),
  signal: {
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
}));

// Suppress Vue warnings in test environment
const originalConsoleWarn = console.warn;
console.warn = vi.fn().mockImplementation((message) => {
  // Allow specific warnings through, suppress FocusTrap warnings
  if (typeof message === 'string' && message.includes('FocusTrap')) {
    return; // Suppress FocusTrap warnings
  }
  originalConsoleWarn(message);
});
