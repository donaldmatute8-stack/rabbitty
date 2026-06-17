"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast, Button } from "@rabbitty/ui";
import { ShoppingCart, Star, Coins, Mic, Users, Receipt } from "lucide-react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

export default function PosMenuPage() {
  const { tableId } = useParams();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<{item: any, quantity: number, notes?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Table Order State
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);

  // Checkout State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CART' | 'SPLIT'>('CART');
  const [splitAmount, setSplitAmount] = useState<string>('');

  // Voice AI States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load menu items & active order
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [menuRes, orderRes] = await Promise.all([
          fetch(`/api/pos/menu?tableId=${tableId}`),
          fetch(`/api/pos/table-bill?tableId=${tableId}`)
        ]);

        const menuData = await menuRes.json();
        if (menuData.success) {
          setMenuItems(menuData.items || []);
        }

        const orderData = await orderRes.json();
        if (orderData.success && orderData.hasActiveOrder) {
          setActiveOrder(orderData.order);
          setOrderItems(orderData.items);
          setPaymentMode('SPLIT');
        }
      } catch (err) {
        toast.error("Error de conexión");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [tableId]);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
    setPaymentMode('CART');
    toast.success(`${item.name} agregado`);
  };

  const cartTotal = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
  
  // Computed values for checkout
  const getSubtotal = () => {
    if (paymentMode === 'CART') return cartTotal;
    if (paymentMode === 'SPLIT' && activeOrder) {
      if (splitAmount && Number(splitAmount) > 0) return Number(splitAmount);
      return activeOrder.total;
    }
    return 0;
  };

  const subtotal = getSubtotal();
  const tipAmount = subtotal * tipPercentage;
  const grandTotal = subtotal + tipAmount;

  const handleCheckout = async (method: 'STARS' | 'BUNZ') => {
    toast.success(`Generando pago con ${method}...`);
    try {
      const payload: any = {
        tableId,
        paymentMethod: method,
        tip: tipAmount,
      };

      if (paymentMode === 'SPLIT' && activeOrder) {
        payload.existingOrderId = activeOrder.id;
        payload.splitPaymentAmount = subtotal; // Solo el subtotal, el tip se suma en backend
      } else {
        payload.items = cart.map(i => ({...i.item, quantity: i.quantity, notes: i.notes}));
      }

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (method === 'STARS' && data.invoiceLink) {
          if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openInvoice(data.invoiceLink, (status: string) => {
              if (status === 'paid') {
                toast.success("¡Pago exitoso! Recibo enviado.");
                setCart([]);
                setIsCheckoutOpen(false);
              } else if (status === 'cancelled') {
                toast.error("Pago cancelado");
              }
            });
          } else {
            toast.error("Telegram WebApp no disponible");
          }
        } else if (method === 'BUNZ') {
          toast.success("¡Pago con Bunz exitoso!");
          setCart([]);
          setIsCheckoutOpen(false);
        }
      } else {
        toast.error(data.error || "Error al procesar pago");
      }
    } catch (err) {
      toast.error("Error de conexión");
    }
  };

  // --- Voice Handlers omitted for brevity in thought, but full implementation kept ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceOrder(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processVoiceOrder = async (audioBlob: Blob) => {
    setIsProcessingVoice(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("tableId", (Array.isArray(tableId) ? tableId[0] : tableId) || "");

      const res = await fetch('/api/pos/voice-order', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.items?.length > 0) {
        toast.success(`Escuchamos: "${data.transcription}"`);
        data.items.forEach((aiItem: any) => {
          const menuItem = menuItems.find(m => m.id === aiItem.itemId);
          if (menuItem) addToCart(menuItem);
        });
      } else {
        toast.error("No logramos identificar ningún platillo.");
      }
    } catch (err) {
      toast.error("Error de conexión con la IA");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 pb-[100px] pt-[calc(max(var(--safe-top,0px),50px))] relative">
      <div className="p-4 bg-white shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Orden en Mesa</h1>
          <p className="text-sm text-gray-500">Mesa ID: {tableId}</p>
        </div>
        <div className="relative cursor-pointer" onClick={() => setIsCheckoutOpen(true)}>
          <ShoppingCart className="w-6 h-6 text-gray-700" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-pink-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {cart.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeOrder && (
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl p-4 text-white shadow-lg mb-6 cursor-pointer" onClick={() => { setPaymentMode('SPLIT'); setIsCheckoutOpen(true); }}>
            <div className="flex items-center gap-3">
              <Receipt className="w-6 h-6 text-white/80" />
              <div>
                <h3 className="font-bold">Cuenta Abierta</h3>
                <p className="text-sm text-white/80">Total mesa: ${activeOrder.total}</p>
              </div>
            </div>
            <p className="text-xs mt-2 text-white/60">Toca para dividir o pagar la cuenta</p>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-500 mt-10">Cargando menú...</p>
        ) : (
          menuItems.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
                <p className="font-bold text-pink-600 mt-1">${item.price}</p>
              </div>
              <Button onClick={() => addToCart(item)} size="sm" variant="secondary">Agregar</Button>
            </div>
          ))
        )}
      </div>

      {/* Voice Order Button */}
      {!loading && !isCheckoutOpen && (
        <div className="fixed bottom-[100px] right-4 z-40">
          <Button 
            onPointerDown={startRecording} onPointerUp={stopRecording} onPointerLeave={stopRecording}
            className={`rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-all ${
              isRecording ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/50 animate-pulse' : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-105'
            }`}
          >
            <Mic className="w-6 h-6 text-white" />
          </Button>
        </div>
      )}

      {/* Checkout Modal Overlay */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end backdrop-blur-sm animate-in fade-in slide-in-from-bottom-10">
          <div className="bg-white rounded-t-3xl p-6 w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Pagar Cuenta</h2>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-gray-400 font-bold bg-gray-100 px-3 py-1 rounded-full text-sm">Cerrar</button>
            </div>

            {/* Payment Mode Selector */}
            {activeOrder && (
              <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button 
                  onClick={() => setPaymentMode('CART')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg ${paymentMode === 'CART' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
                >
                  Mi Pedido
                </button>
                <button 
                  onClick={() => setPaymentMode('SPLIT')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg flex justify-center items-center gap-1 ${paymentMode === 'SPLIT' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
                >
                  <Users className="w-4 h-4" /> Dividir Mesa
                </button>
              </div>
            )}

            {/* Content based on mode */}
            {paymentMode === 'CART' ? (
              <div className="mb-6">
                <p className="font-bold text-gray-700 mb-2">Artículos en mi carrito:</p>
                {cart.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Carrito vacío.</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((c, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{c.quantity}x {c.item.name}</span>
                        <span className="font-semibold">${c.item.price * c.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6 space-y-4">
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-sm text-purple-700 font-semibold mb-1">Total Abierto de la Mesa:</p>
                  <p className="text-2xl font-black text-purple-900">${activeOrder?.total}</p>
                </div>
                
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">¿Cuánto quieres pagar?</label>
                  <div className="flex gap-2">
                    <button onClick={() => setSplitAmount('')} className={`px-4 py-2 rounded-lg text-sm font-bold ${splitAmount === '' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>Todo</button>
                    <button onClick={() => setSplitAmount((activeOrder?.total / 2).toString())} className={`px-4 py-2 rounded-lg text-sm font-bold ${splitAmount === (activeOrder?.total / 2).toString() ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>Mitad (50%)</button>
                  </div>
                  <div className="mt-3 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <input 
                      type="number" 
                      placeholder="Monto personalizado" 
                      value={splitAmount}
                      onChange={(e) => setSplitAmount(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-8 pr-4 font-bold outline-none focus:border-pink-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tip Selection */}
            {(paymentMode === 'CART' ? cart.length > 0 : true) && (
              <div className="mb-8">
                <p className="font-bold text-gray-700 mb-3">Agregar Propina</p>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 0.10, 0.15, 0.20].map((tip) => (
                    <button
                      key={tip}
                      onClick={() => setTipPercentage(tip)}
                      className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${tipPercentage === tip ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'}`}
                    >
                      {tip === 0 ? 'No' : `${tip * 100}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Totals & Pay */}
            {(paymentMode === 'CART' ? cart.length > 0 : true) && (
              <div className="border-t border-gray-100 pt-6">
                <div className="flex justify-between text-gray-500 mb-2">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-pink-500 mb-2">
                    <span>Propina</span>
                    <span>+${tipAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-6 mt-4">
                  <span className="font-black text-gray-900 text-xl">Total a Pagar</span>
                  <span className="text-3xl font-black text-gray-900">${grandTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button onClick={() => handleCheckout('STARS')} className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669]">
                    <Star className="w-5 h-5 fill-white" />
                    Pagar con Stars (${grandTotal.toFixed(2)})
                  </Button>
                  <Button onClick={() => handleCheckout('BUNZ')} className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700">
                    <Coins className="w-5 h-5 fill-white" />
                    Pagar con Bunz
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
