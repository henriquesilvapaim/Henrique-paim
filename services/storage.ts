
import { Customer, Supplier, Product, StockEntry, Order, Promotion, User, CalendarEvent, SalesGoal } from '../types';

const KEYS = {
  CUSTOMERS: 'app_customers',
  SUPPLIERS: 'app_suppliers',
  PRODUCTS: 'app_products',
  STOCK_ENTRIES: 'app_stock_entries',
  ORDERS: 'app_orders',
  PROMOTIONS: 'app_promotions',
  USERS: 'app_users',
  EVENTS: 'app_events',
  GOALS: 'app_sales_goals'
};

const load = <T>(key: string, defaultValue: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

const save = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initialize default admin if no users exist
const initUsers = () => {
  const users = load<User[]>(KEYS.USERS, []);
  if (users.length === 0) {
    const admin: User = {
      id: 'admin-1',
      username: 'Administrador',
      password: 'Hsp010305', // Password updated per request
      name: 'Administrador',
      role: 'ADMIN'
    };
    save(KEYS.USERS, [admin]);
    return [admin];
  }
  return users;
};

export const storageService = {
  getCustomers: () => load<Customer[]>(KEYS.CUSTOMERS, []),
  saveCustomers: (data: Customer[]) => save(KEYS.CUSTOMERS, data),

  getSuppliers: () => load<Supplier[]>(KEYS.SUPPLIERS, []),
  saveSuppliers: (data: Supplier[]) => save(KEYS.SUPPLIERS, data),

  getProducts: () => load<Product[]>(KEYS.PRODUCTS, []),
  saveProducts: (data: Product[]) => save(KEYS.PRODUCTS, data),

  getStockEntries: () => load<StockEntry[]>(KEYS.STOCK_ENTRIES, []),
  saveStockEntries: (data: StockEntry[]) => save(KEYS.STOCK_ENTRIES, data),

  getOrders: () => load<Order[]>(KEYS.ORDERS, []),
  saveOrders: (data: Order[]) => save(KEYS.ORDERS, data),

  getPromotions: () => load<Promotion[]>(KEYS.PROMOTIONS, []),
  savePromotions: (data: Promotion[]) => save(KEYS.PROMOTIONS, data),

  getUsers: () => initUsers(),
  saveUsers: (data: User[]) => save(KEYS.USERS, data),

  getEvents: () => load<CalendarEvent[]>(KEYS.EVENTS, []),
  saveEvents: (data: CalendarEvent[]) => save(KEYS.EVENTS, data),

  getSalesGoals: () => load<SalesGoal[]>(KEYS.GOALS, []),
  saveSalesGoals: (data: SalesGoal[]) => save(KEYS.GOALS, data),
};