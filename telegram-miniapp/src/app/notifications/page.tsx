'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface ApiNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead?: boolean;
  is_read?: boolean;
  createdAt?: string;
  created_at?: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user, loading: authLoading } = useAuth();
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let alive = true;
    if (authLoading) return;

    if (!user?.id) {
      return;
    }

    async function loadNotifications() {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(`/api/notifications`, { headers });
        const data = await res.json();
        if (alive && data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications.map((n: ApiNotification) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            isRead: n.isRead ?? n.is_read ?? false,
            createdAt: n.createdAt ?? n.created_at ?? new Date().toISOString(),
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (alive) {
          setFetching(false);
        }
      }
    }

    loadNotifications();

    return () => {
      alive = false;
    };
  }, [user?.id, authLoading]);

  const loading = authLoading || (!!user?.id && fetching);

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      const headers = await PlatformBridge.getAuthHeaders();
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ id }),
      }).catch((e) => console.warn('[Notifications] Failed to persist read state:', e));
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
          <div className="bg-(--bg-elevated) p-8 rounded-3xl text-center border border-(--border-subtle) shadow-[0_4px_20px_rgba(0,0,0,0.03)] mt-4">
            <div className="w-16 h-16 bg-[#FFF0F5]/10 rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[#E91E63]">
              <Bell size={28} />
            </div>
            <h3 className="text-[18px] font-black text-(--text-primary) m-0 mb-2 tracking-[-0.5px]">No tienes notificaciones</h3>
            <p className="text-[13px] text-(--text-muted) m-0 leading-normal">Aquí aparecerán tus alertas y recompensas de Rabbitty.</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id} 
              onClick={() => !notif.isRead && markAsRead(notif.id)}
              className={`bg-(--bg-elevated) p-4 rounded-2xl border transition-all ${notif.isRead ? 'opacity-60 border-(--border-subtle) shadow-sm' : 'border-pink-500/30 shadow-md cursor-pointer'}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-white/5 p-2 rounded-full">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-[15px] ${notif.isRead ? 'font-semibold text-(--text-muted)' : 'font-black text-(--text-primary)'}`}>
                      {notif.title}
                    </h3>
                    {!notif.isRead && <span className="w-2.5 h-2.5 bg-pink-500 rounded-full shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-[13px] text-(--text-muted) mt-1 leading-snug">{notif.message}</p>
                  <p className="text-[11px] text-(--text-muted) mt-2 font-medium">
                    {new Date(notif.createdAt).toLocaleDateString()}
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

