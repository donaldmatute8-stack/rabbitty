'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Info, AlertCircle, Trash2 } from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useWallet } from '@/contexts/WalletContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { address } = useWallet();

  useEffect(() => {
    if (address) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
  }, [address]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?wallet=${address}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id })
      });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS': return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'ALERT': return <AlertCircle className="w-6 h-6 text-red-500" />;
      default: return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  return (
    <ProfileSubpageLayout title="Notificaciones">
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div></div>
        ) : notifications.length === 0 ? (
          <div style={{
            background: '#fff', padding: 32, borderRadius: 24, textAlign: 'center',
            border: '1px solid #F0F0F0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginTop: 16
          }}>
            <div style={{
              width: 64, height: 64, background: '#FFF0F5', borderRadius: 20, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              margin: '0 auto 16px', color: '#E91E63'
            }}>
              <Bell size={28} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#111', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>No tienes notificaciones</h3>
            <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.5 }}>Aquí aparecerán tus alertas y recompensas de Rabbitty.</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id} 
              onClick={() => !notif.is_read && markAsRead(notif.id)}
              className={`bg-white p-4 rounded-2xl border transition-all ${notif.is_read ? 'opacity-60 border-transparent shadow-sm' : 'border-pink-100 shadow-md cursor-pointer'}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-gray-50 p-2 rounded-full">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-[15px] ${notif.is_read ? 'font-semibold text-gray-700' : 'font-black text-black'}`}>
                      {notif.title}
                    </h3>
                    {!notif.is_read && <span className="w-2.5 h-2.5 bg-pink-500 rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-[13px] text-gray-500 mt-1 leading-snug">{notif.message}</p>
                  <p className="text-[11px] text-gray-400 mt-2 font-medium">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </ProfileSubpageLayout>
  );
}
