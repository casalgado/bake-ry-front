import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ShowBakeryUsers from '../ShowBakeryUsers.vue';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';

// Mock router
const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock DataTable component
vi.mock('@/components/DataTable/index.vue', () => ({
  default: {
    name: 'DataTable',
    template: '<div data-testid="data-table">DataTable</div>',
    props: ['data', 'columns', 'actions', 'filters', 'actionLoading', 'dataLoading'],
    emits: ['selection-change', 'action'],
  },
}));

// Mock BakeryUserForm component
vi.mock('@/components/forms/BakeryUserForm.vue', () => ({
  default: {
    name: 'BakeryUserForm',
    template: '<div data-testid="bakery-user-form">BakeryUserForm</div>',
    props: ['title', 'initialData', 'loading'],
    emits: ['submit', 'cancel'],
  },
}));

describe('ShowBakeryUsers', () => {
  let wrapper;
  let pinia;
  let bakeryUserStore;

  beforeEach(() => {
    pinia = createPinia();

    wrapper = mount(ShowBakeryUsers, {
      global: {
        plugins: [pinia],
        stubs: {
          Dialog: true,
          DialogPanel: true,
        },
      },
    });

    bakeryUserStore = useBakeryUserStore();

    // Mock store data
    bakeryUserStore.items = [
      {
        id: '1',
        name: 'Test Client',
        email: 'test@example.com',
        category: 'B2C',
        address: '123 Test St',
        phone: '123-456-7890',
        nationalId: '12345678',
      },
    ];
  });

  describe('Create Client Button', () => {
    it('renders the create client button', () => {
      const createButton = wrapper.find('button');
      expect(createButton.exists()).toBe(true);
      expect(createButton.text()).toBe('Crear Cliente');
    });

    it('navigates to create client page when button is clicked', async () => {
      const createButton = wrapper.find('button');
      await createButton.trigger('click');

      expect(mockPush).toHaveBeenCalledWith('/dashboard/users/create-client');
    });

    it('has correct styling classes on the button', () => {
      const createButton = wrapper.find('button');
      expect(createButton.classes()).toContain('action-btn');
    });
  });

  describe('Layout and Structure', () => {
    it('displays the correct page title', () => {
      const title = wrapper.find('h2');
      expect(title.exists()).toBe(true);
      expect(title.text()).toBe('Clientes');
    });

    it('has proper layout structure with title and button', () => {
      const headerDiv = wrapper.find('.flex.justify-between.items-center');
      expect(headerDiv.exists()).toBe(true);

      const title = headerDiv.find('h2');
      const button = headerDiv.find('button');

      expect(title.exists()).toBe(true);
      expect(button.exists()).toBe(true);
    });

    it('renders the DataTable component', () => {
      const dataTable = wrapper.find('[data-testid="data-table"]');
      expect(dataTable.exists()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('displays error message when store has error', async () => {
      bakeryUserStore.error = 'Test error message';
      await wrapper.vm.$nextTick();

      const errorDiv = wrapper.find('.text-danger');
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toBe('Test error message');
    });

    it('does not display error message when no error', () => {
      bakeryUserStore.error = null;
      const errorDiv = wrapper.find('.text-danger');
      expect(errorDiv.exists()).toBe(false);
    });
  });

  describe('Table Configuration', () => {
    it('passes correct props to DataTable', () => {
      const dataTable = wrapper.findComponent({ name: 'DataTable' });

      expect(dataTable.props('columns')).toBeDefined();
      expect(dataTable.props('actions')).toBeDefined();
      expect(dataTable.props('filters')).toBeDefined();
      expect(dataTable.props('data')).toBeDefined();
    });

    it('has edit and delete actions configured', () => {
      const vm = wrapper.vm;
      const actions = vm.tableActions;

      expect(actions).toHaveLength(2);
      expect(actions[0].id).toBe('edit');
      expect(actions[1].id).toBe('delete');
    });

    it('has proper column configuration', () => {
      const vm = wrapper.vm;
      const columns = vm.columns;

      const nameColumn = columns.find(col => col.id === 'name');
      const emailColumn = columns.find(col => col.id === 'email');

      expect(nameColumn).toBeDefined();
      expect(nameColumn.sortable).toBe(true);
      expect(emailColumn).toBeDefined();
      expect(emailColumn.sortable).toBe(true);
    });
  });
});