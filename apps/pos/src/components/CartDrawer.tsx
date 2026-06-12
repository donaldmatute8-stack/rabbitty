"use client";

import { trpc } from "../lib/trpc-client";
import { Button, cn, toast } from "@rabbitty/ui";
import { useState } from "react";
import { X, Plus, Minus, ShoppingCart, ChevronLeft, Trash2, CreditCard } from "lucide-react";
import { CheckoutModal } from "./CheckoutModal";

interface CartDrawerProps {
  tableId?: string | null;
  onClose: () => void;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export function CartDrawer({ tableId, onClose }: CartDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const { data: categories } = trpc.pos.getCategories.useQuery();
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery(selectedCategory ? { categoryId: selectedCategory } : {});
  const utils = trpc.useUtils();

  const createOrder = trpc.pos.createOrder.useMutation({
    onSuccess: (data) => {
      setOrderId(data.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const addToCart = trpc.pos.addToCart.useMutation({
    onSuccess: () => {
      utils.pos.getOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeFromCart = trpc.pos.removeFromCart.useMutation({
    onSuccess: () => {
      utils.pos.getOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAddItem = async (item: { id: string; name: string; price: number }) => {
    setAddingId(item.id);
    try {
      let currentOrderId = orderId;
      if (!currentOrderId) {
        const order = await createOrder.mutateAsync({
          tableId: tableId ?? undefined,
          orderType: tableId ? "DINE_IN" : "TO_GO",
        });
        currentOrderId = order.id;
        setOrderId(order.id);
      }
      await addToCart.mutateAsync({
        orderId: currentOrderId,
        menuItemId: item.id,
        quantity: 1,
      });
      setCart((prev) => {
        const existing = prev.find((ci) => ci.menuItemId === item.id);
        if (existing) {
          return prev.map((ci) =>
            ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
          );
        }
        return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
      });
    } finally {
      setAddingId(null);
    }
  };

  const handleIncrement = async (item: CartItem) => {
    if (!orderId) return;
    await addToCart.mutateAsync({ orderId, menuItemId: item.menuItemId, quantity: 1 });
    setCart((prev) =>
      prev.map((ci) =>
        ci.menuItemId === item.menuItemId ? { ...ci, quantity: ci.quantity + 1 } : ci
      )
    );
  };

  const handleDecrement = async (item: CartItem) => {
    if (item.quantity <= 1) {
      await handleRemove(item);
      return;
    }
    if (!orderId) return;
    await removeFromCart.mutateAsync({ id: item.menuItemId });
    setCart((prev) =>
      prev.map((ci) =>
        ci.menuItemId === item.menuItemId ? { ...ci, quantity: ci.quantity - 1 } : ci
      )
    );
  };

  const handleRemove = async (item: CartItem) => {
    if (!orderId) return;
    await removeFromCart.mutateAsync({ id: item.menuItemId });
    setCart((prev) => prev.filter((ci) => ci.menuItemId !== item.menuItemId));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * 0.16 * 100) / 100;
  const total = subtotal + tax;
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="font-bold text-gray-900">
              {tableId ? `Mesa ${tableId.slice(0, 8)}` : "Para llevar"}
            </h3>
            {orderId && <p className="text-xs text-gray-400">Orden #{orderId.slice(0, 8)}</p>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
              !selectedCategory ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            Todos
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                selectedCategory === cat.id
                  ? "bg-pink-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          {menuItems?.map((item) => (
            <button
              key={item.id}
              onClick={() => handleAddItem(item)}
              disabled={addingId === item.id || !item.isAvailable}
              className="flex flex-col items-start rounded-xl border border-gray-100 bg-white p-3 text-left transition-all hover:border-pink-200 hover:shadow-sm active:scale-[0.98] disabled:opacity-40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-50 text-lg">🍽</div>
              <span className="mt-2 text-sm font-semibold text-gray-900">{item.name}</span>
              <span className="mt-0.5 text-xs text-gray-400">${Number(item.price).toFixed(2)}</span>
              {!item.isAvailable && (
                <span className="mt-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                  Agotado
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {itemCount > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-pink-600" />
            <span className="text-sm font-semibold text-gray-900">{itemCount} artículo(s)</span>
          </div>
          <div className="mb-3 max-h-40 space-y-1.5 overflow-y-auto">
            {cart.map((item, idx) => (
              <div key={`${item.menuItemId}-${idx}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <span className="ml-2 text-gray-400">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDecrement(item)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => handleIncrement(item)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleRemove(item)}
                    className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-red-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-gray-200 pt-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>IVA (16%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 p-4">
        {itemCount > 0 && orderId ? (
          <Button onClick={() => setShowCheckout(true)} className="w-full bg-pink-600 shadow-lg hover:bg-pink-700" size="lg">
            <CreditCard className="mr-2 h-5 w-5" />
            Cobrar ${total.toFixed(2)}
          </Button>
        ) : (
          <Button onClick={onClose} className="w-full" size="lg" variant="secondary">
            Cerrar
          </Button>
        )}
      </div>

      {showCheckout && orderId && (
        <CheckoutModal
          orderId={orderId}
          total={total}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => {
            setShowCheckout(false);
            utils.pos.getOrders.invalidate();
            onClose();
          }}
        />
      )}
    </div>
  );
}
