'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';

export default function NotificationsPage() {
  return (
    <ProfileSubpageLayout title="Notificaciones">
      <div style={{ paddingTop: 20, paddingBottom: 40 }}>
        <EmptyState
          icon={<div style={{ fontSize: 32 }}>📭</div>}
          title="Sin notificaciones"
          description="Aún no tienes notificaciones nuevas. Te avisaremos cuando ocurra algo importante."
        />
      </div>
    </ProfileSubpageLayout>
  );
}
