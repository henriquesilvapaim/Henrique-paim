

export interface Address {
  street: string;
  number: string;
  city: string;
  state: string;
  zip: string;
  neighborhood?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: Address;
  cnpj?: string;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  contact: string;
  email: string;
  address?: Address;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  costPrice: number;
  stock: number;
  image: string;
  supplierId?: string; // Linked supplier
}

export interface StockEntry {
  id: string;
  productId: string;
  supplierId: string;
  quantity: number;
  date: string;
  cost: number;
}

export interface Promotion {
  id: string;
  name: string;
  discountPercent: number;
  active: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type OrderStatus = 'pending' | 'partially_delivered' | 'delivered' | 'completed' | 'canceled';
export type OrderType = 'WHOLESALE' | 'RETAIL';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerAddress: Address;
  items: OrderItem[];
  subtotal: number;
  discountValue: number;
  discountPercent: number;
  total: number;
  date: string;
  status: OrderStatus;
  deliveryNotes?: string;
  signature?: string; // Base64 image string
  orderType?: OrderType; // Defaults to RETAIL if undefined for backward compatibility
}

export type Role = 'ADMIN' | 'SELLER' | 'STOCK_MANAGER';

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this would be hashed
  name: string;
  role: Role;
}

export type EventType = 'VISIT' | 'DELIVERY' | 'OTHER';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // ISO Date string YYYY-MM-DD
  time: string; // HH:MM
  type: EventType;
  relatedId?: string; // ID of customer or supplier
  relatedName?: string;
}

export interface SalesGoal {
  id: string;
  month: string; // Format YYYY-MM
  wholesaleTarget: number;
  retailTarget: number;
}

export type ViewState = 'LOGIN' | 'DASHBOARD' | 'CUSTOMERS' | 'SUPPLIERS' | 'PRODUCTS' | 'INVENTORY' | 'NEW_ORDER' | 'OPEN_ORDERS' | 'REPORTS' | 'AGENDA' | 'USERS' | 'PAYMENTS' | 'GOALS';