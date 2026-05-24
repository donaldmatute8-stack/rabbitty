'use client';

import { useEffect, useState } from 'react';

interface Transaction {
  id: string;
  type: 'earned' | 'spent';
  amount: number;
  business: string;
  date: string;
  description: string;
  icon: string;
}

const MOCK_HISTORY: Transaction[] = [
  { id: '1', type: 'earned', amount: 50, business: 'Café Cultura', date: 'Hoy, 10:30 AM', description: 'Compra de $200', icon: '☕' },
  { id: '2', type: 'spent', amount: 100, business: 'Pizza Napoli', date: 'Ayer, 7:00 PM', description: 'Cena', icon: '🍕' },
  { id: '3', type: 'earned', amount: 30, business: 'Gimnasio Power', date: 'Ayer, 9:00 AM', description: 'Membresía mensual', icon: '💪' },
  { id: '4', type: 'earned', amount: 75, business: 'TechZone', date: '22 Ene, 3:45 PM', description: 'Compra de audífonos', icon: '💻' },
  { id: '5', type: 'spent', amount: 50, business: 'Café Cultura', date: '21 Ene, 11:20 AM', description: 'Desayuno', icon: '☕' },
  { id: '6', type: 'earned', amount: 25, business: 'Libros Universo', date: '20 Ene, 4:00 PM', description: 'Libro de ficción', icon: '📚' },
  { id: '7', type: 'earned', amount: 100, business: 'Pizza Napoli', date: '19 Ene, 8:00 PM', description: 'Cena familiar', icon: '🍕' },
  { id: '8', type: 'spent', amount: 25, business: 'Café Cultura', date: '18 Ene, 9:30 AM', description: 'Café mañanero', icon: '☕' },
];

export default function HistoryPage() {
  const [filter, setFilter] = useState<'all' | 'earned' | 'spent'>('all');
  const [selectedMonth, setSelectedMonth] = useState('Enero 2026');
  const [WebApp, setWebApp] = useState<any>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      setWebApp(app);
    });
  }, []);

  const filteredTransactions = MOCK_HISTORY.filter(t => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  const totalEarned = filteredTransactions
    .filter(t => t.type === 'earned')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = filteredTransactions
    .filter(t => t.type === 'spent')
    .reduce((sum, t) => sum + t.amount, 0);

  const showTransactionDetail = (tx: Transaction) => {
    if (WebApp) {
      WebApp.showPopup({
        title: tx.type === 'earned' ? '🎉 Bunz Ganados' : '💳 Pago Realizado',
        message: `${tx.business}\n${tx.description}\nCantidad: ${tx.amount} bunz\nFecha: ${tx.date}`,
        buttons: [{ type: 'ok' }]
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF6B35] to-[#FF4081] text-white p-4 pt-8">
        <h1 className="text-2xl font-bold mb-4">📊 Historial</h1>
        
        {/* Month Selector */}
        <div className="flex items-center gap-2 mb-4">
          <button className="bg-white/20 backdrop-blur p-2 rounded-lg">←</button>
          <span className="font-medium">{selectedMonth}</span>
          <button className="bg-white/20 backdrop-blur p-2 rounded-lg">→</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-4 -mt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <p className="text-gray-500 text-sm mb-1">Ganado</p>
            <p className="text-2xl font-bold text-green-500">+{totalEarned}</p>
            <p className="text-xs text-gray-400">bunz</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <p className="text-gray-500 text-sm mb-1">Gastado</p>
            <p className="text-2xl font-bold text-red-500">-{totalSpent}</p>
            <p className="text-xs text-gray-400">bunz</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 mb-4">
        <div className="flex gap-2">
          {(['all', 'earned', 'spent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition ${
                filter === f
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'earned' ? 'Ganados' : 'Gastados'}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="px-4 pb-24 space-y-3">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Transacciones</h2>
        
        {filteredTransactions.map((tx) => (
          <button
            key={tx.id}
            onClick={() => showTransactionDetail(tx)}
            className="w-full bg-white rounded-2xl p-4 shadow-md flex items-center gap-4 hover:shadow-lg transition text-left"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
              tx.type === 'earned' 
                ? 'bg-green-100' 
                : 'bg-red-100'
            }`}>
              {tx.icon}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-800">{tx.business}</h3>
                <span className={`font-bold ${
                  tx.type === 'earned' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                </span>
              </div>
              <p className="text-sm text-gray-500">{tx.description}</p>
              <p className="text-xs text-gray-400 mt-1">{tx.date}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Export Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={() => { if (WebApp) WebApp.showAlert('Historial exportado a CSV'); }}
          className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-medium flex items-center justify-center gap-2"
        >
          <span>📥</span>
          <span>Exportar Historial</span>
        </button>
      </div>
    </div>
  );
}
