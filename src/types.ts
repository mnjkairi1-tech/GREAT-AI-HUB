export interface Restaurant {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  businessType: string;
  description?: string;
  staffCode?: string;
  staffEmails?: string[];
  requestAccessEmails?: string[];
  createdAt: any;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
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
  tableNo: string;
  customerName: string;
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
