export const mockTables = [
  { id: "t1", branchId: "b1", number: 1, capacity: 2, location: "ventana", qrCode: null, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "t2", branchId: "b1", number: 2, capacity: 4, location: "centro", qrCode: null, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "t3", branchId: "b1", number: 3, capacity: 6, location: "terraza", qrCode: null, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "t4", branchId: "b1", number: 4, capacity: 4, location: "centro", qrCode: null, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
];

export const mockCategories = [
  { id: "c1", branchId: "b1", name: "Desayunos", description: "Desayunos tradicionales", sortOrder: 1, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "c2", branchId: "b1", name: "Bebidas", description: "Café, jugos y más", sortOrder: 2, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "c3", branchId: "b1", name: "Postres", description: "Dulces tentaciones", sortOrder: 3, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
];

export const mockMenuItems = [
  { id: "m1", categoryId: "c1", branchId: "b1", name: "Chilaquiles", description: "Chilaquiles verdes con pollo", price: 89, cost: 30, imageUrl: null, sku: "CHQ-001", isActive: true, isAvailable: true, sortOrder: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "m2", categoryId: "c1", branchId: "b1", name: "Huevos Rancheros", description: "Huevos estrellados con salsa roja", price: 75, cost: 25, imageUrl: null, sku: "HR-001", isActive: true, isAvailable: true, sortOrder: 2, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "m3", categoryId: "c1", branchId: "b1", name: "Hotcakes", description: "Hotcakes con miel de maple", price: 65, cost: 20, imageUrl: null, sku: "HC-001", isActive: true, isAvailable: false, sortOrder: 3, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "m4", categoryId: "c2", branchId: "b1", name: "Café Americano", description: "Café de especialidad", price: 35, cost: 10, imageUrl: null, sku: "CAF-001", isActive: true, isAvailable: true, sortOrder: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "m5", categoryId: "c2", branchId: "b1", name: "Jugo de Naranja", description: "Natural", price: 45, cost: 15, imageUrl: null, sku: "JN-001", isActive: true, isAvailable: true, sortOrder: 2, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "m6", categoryId: "c3", branchId: "b1", name: "Pastel de Chocolate", description: "Rebanada de pastel", price: 55, cost: 20, imageUrl: null, sku: "PST-001", isActive: true, isAvailable: true, sortOrder: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
];

export const mockOrders = [
  { id: "o1", branchId: "b1", tableId: "t3", orderType: "DINE_IN", status: "OPEN", subtotal: 164, tax: 26.24, discount: 0, tip: 0, total: 190.24, customerName: null, customerPhone: null, voidReason: null, createdAt: "2026-06-01T12:00:00Z", updatedAt: "2026-06-01T12:00:00Z" },
];

export const mockOrderItems = [
  { id: "oi1", orderId: "o1", menuItemId: "m1", quantity: 1, unitPrice: 89, totalPrice: 89, modifiers: null, notes: null, status: "PENDING", createdAt: "2026-06-01T12:00:00Z", updatedAt: "2026-06-01T12:00:00Z" },
  { id: "oi2", orderId: "o1", menuItemId: "m4", quantity: 2, unitPrice: 35, totalPrice: 70, modifiers: null, notes: null, status: "PENDING", createdAt: "2026-06-01T12:00:00Z", updatedAt: "2026-06-01T12:00:00Z" },
];

export const mockOrdersWithItems = [
  {
    ...mockOrders[0],
    items: [
      { ...mockOrderItems[0], name: "Chilaquiles" },
      { ...mockOrderItems[1], name: "Café Americano" },
    ],
  },
];
