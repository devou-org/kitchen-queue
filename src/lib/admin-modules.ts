export interface AdminModuleDefinition {
  key: string;
  name: string;
  description: string;
  pathSegment: string;
  iconName: string;
}

export const ADMIN_MODULES: AdminModuleDefinition[] = [
  {
    key: 'pos',
    name: 'POS Terminal',
    description: 'Take dine-in & takeaway orders, bill generation',
    pathSegment: 'pos',
    iconName: 'Store',
  },
  {
    key: 'orders',
    name: 'Orders',
    description: 'Live order tracking, status updates, and KOT prints',
    pathSegment: 'orders',
    iconName: 'ClipboardList',
  },
  {
    key: 'tables',
    name: 'Tables',
    description: 'Table layout, active sessions, and QR codes',
    pathSegment: 'tables',
    iconName: 'LayoutGrid',
  },
  {
    key: 'products',
    name: 'Products',
    description: 'Manage menu items, categories, and pricing',
    pathSegment: 'products',
    iconName: 'UtensilsCrossed',
  },
  {
    key: 'inventory',
    name: 'Inventory',
    description: 'Stock levels, purchase orders, suppliers, and wastage',
    pathSegment: 'inventory',
    iconName: 'Boxes',
  },
  {
    key: 'analytics',
    name: 'Analytics',
    description: 'Daily sales, period statements, and payment analytics',
    pathSegment: 'analytics',
    iconName: 'BarChart3',
  },
  {
    key: 'staff',
    name: 'Staff & Roles',
    description: 'Manage staff accounts, custom roles, and module permissions',
    pathSegment: 'staff',
    iconName: 'Users',
  },
  {
    key: 'billing',
    name: 'Billing',
    description: 'Subscription status, payments, and invoices',
    pathSegment: 'billing',
    iconName: 'Receipt',
  },
  {
    key: 'settings',
    name: 'Settings',
    description: 'Restaurant profile, print agents, and operational timings',
    pathSegment: 'settings',
    iconName: 'Settings',
  },
];

export const DEFAULT_ROLE_TEMPLATES = [
  {
    name: 'Waiter',
    description: 'Floor staff handling dine-in tables, table orders, and checking active orders',
    permissions: ['pos', 'orders', 'tables'],
  },
  {
    name: 'Kitchen Staff',
    description: 'Kitchen and chef display for viewing and preparing live orders',
    permissions: ['orders'],
  },
  {
    name: 'Cashier',
    description: 'Counter staff managing billing, POS orders, tables, and daily sales reports',
    permissions: ['pos', 'orders', 'tables', 'analytics'],
  },
  {
    name: 'Manager',
    description: 'General manager overseeing operations, menu items, inventory, analytics, and staff',
    permissions: ['pos', 'orders', 'tables', 'products', 'inventory', 'analytics', 'staff'],
  },
];

export function hasModulePermission(userPermissions: string[] | undefined | null, moduleKey: string, isAdmin?: boolean): boolean {
  if (isAdmin) return true;
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  if (userPermissions.includes('*')) return true;
  return userPermissions.includes(moduleKey);
}

