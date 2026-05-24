'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

const BUNZ_CONTRACT = '0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB';
const BUNZ_ABI = [
  "function getBusinessCredit(address business) view returns (uint256 limit, uint256 used, uint256 remaining)",
  "function setRewardRate(uint256 newRate)",
  "function businesses(address) view returns (uint256 creditLimit, uint256 creditUsed, uint256 rewardRate, bool active, string businessType, uint256 joinedAt)",
  "function isRegistered(address) view returns (bool)"
];

export default function BusinessPanel() {
  const [user, setUser] = useState<any>(null);
  const [businessData, setBusinessData] = useState<any>(null);
  const [newRate, setNewRate] = useState(20);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [WebApp, setWebApp] = useState<any>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      setWebApp(app);
      
      const tgUser = app.initDataUnsafe.user;
      if (tgUser) {
        setUser(tgUser);
        checkBusiness(tgUser.id);
      }
    });
  }, []);

  const checkBusiness = async (userId: number) => {
    // En producción: verificar si el usuario es business en contrato
    // Por ahora: simular data para demo
    setBusinessData({
      name: 'Café Cultura',
      type: 'restaurante',
      creditLimit: '100000',
      creditUsed: '25000',
      creditRemaining: '75000',
      rewardRate: 20,
      active: true,
      transactions: 156,
      customers: 89
    });
  };

  const generateQR = async () => {
    WebApp.showPopup({
      title: '📷 QR Code Ready',
      message: 'Show this QR to your customer',
      buttons: [
        { id: 'copy', type: 'default', text: 'Copy Link' },
        { type: 'ok' }
      ]
    });
  };

  const updateRate = async () => {
    setLoading(true);
    // Call contract
    await new Promise(r => setTimeout(r, 1000));
    setBusinessData({ ...businessData, rewardRate: newRate });
    WebApp.showAlert(`Reward rate updated to ${newRate}%`);
    setLoading(false);
  };

  if (!businessData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">🏪 Business Panel</h1>
          <p className="text-gray-600">Loading your business data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
            🏪
          </div>
          <div>
            <h1 className="font-bold text-xl">{businessData.name}</h1>
            <p className="text-sm opacity-80">{businessData.type}</p>
          </div>
        </div>
        
        {/* Credit Overview */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs opacity-80">Total Credit</p>
            <p className="text-xl font-bold">{Number(businessData.creditLimit).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs opacity-80">Used</p>
            <p className="text-xl font-bold">{Number(businessData.creditUsed).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs opacity-80">Remaining</p>
            <p className="text-xl font-bold">{Number(businessData.creditRemaining).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Main Actions */}
      <div className="p-4 space-y-4">
        {/* Generate QR */}
        <button
          onClick={generateQR}
          className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-5 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition flex items-center justify-center gap-3"
        >
          <span className="text-2xl">📷</span>
          <span>Generate QR for Customer</span>
        </button>

        {/* Reward Rate */}
        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h2 className="font-bold text-gray-800 mb-4">⚡ Reward Rate</h2>
          <p className="text-sm text-gray-500 mb-4">Current: {businessData.rewardRate}%</p>
          
          <div className="flex items-center gap-4 mb-4">
            <input
              type="range"
              min="10"
              max="200"
              value={newRate}
              onChange={(e) => setNewRate(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg"
            />
            <span className="text-2xl font-bold text-blue-600">{newRate}%</span>
          </div>
          
          <button
            onClick={updateRate}
            disabled={loading}
            className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Rate'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-md text-center">
            <span className="text-3xl block mb-2">🛒</span>
            <p className="text-2xl font-bold text-gray-800">{businessData.transactions}</p>
            <p className="text-sm text-gray-500">Transactions</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-md text-center">
            <span className="text-3xl block mb-2">👥</span>
            <p className="text-2xl font-bold text-gray-800">{businessData.customers}</p>
            <p className="text-sm text-gray-500">Customers</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h2 className="font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <span className="font-bold text-gray-700">View Analytics</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <span className="font-bold text-gray-700">Promotions</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚙️</span>
                <span className="font-bold text-gray-700">Settings</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
