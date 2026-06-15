export interface StaffMember {
  id: string;
  name: string;
  code: string;
  shop?: string;
}

export interface StaffPermission {
  email: string;
  tabs: string[]; // ['home', 'orders', 'menu', 'qr', 'settings', 'analytics', 'staff', 'customers', 'staff_analytics']
}

export interface Restaurant {
  id: string;
  name: string;
  ownerId: string;
  isBlocked?: boolean;
  subscriptionFee?: number;
  ownerEmail?: string;
  businessType: string;
  description?: string;
  enableStaffCode?: boolean;
  staffCode?: string;
  staffEmails?: string[];
  staffPermissions?: StaffPermission[];
  staffMembers?: StaffMember[];
  shops?: string[];
  requestAccessEmails?: string[];
  adminMessage?: string;
  theme?: 'classic-orange' | 'modern-slate' | 'ultra-cute' | 'neon-tech' | 'sunset-luxury';
  createdAt: any;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  businessType?: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  volume?: string;
  imageUrl?: string;
  isAvailable: boolean;
  stockCount: number;
  updatedAt: any;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';

export interface Order {
  id: string;
  restaurantId: string;
  businessType?: string;
  tableNo: string;
  customerName: string;
  staffCode?: string;
  storeCustomerCode?: string;
  paymentMethod?: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: any;
  updatedAt: any;
}

export interface QrTable {
  id: string;
  restaurantId: string;
  name: string;
  tableNo: string;
  dynamicLink: string;
  imageUrl?: string;
  googleMapReviewLink?: string;
  createdAt: any;
}

export interface StoreCustomer {
  id: string;
  restaurantId: string;
  name: string;
  code: string;
  creditBalance: number;
  phone?: string;
  createdAt: any;
}

