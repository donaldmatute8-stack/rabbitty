'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';

export default function PrivacyPage() {
  return (
    <ProfileSubpageLayout title="Soporte">
      <div style={{ paddingTop: 20, paddingBottom: 40 }}>
        <EmptyState
          icon={<div style={{ fontSize: 32 }}>❓</div>}
          title="Ayuda y Soporte"
          description="Próximamente podrás chatear directamente con nuestro equipo de soporte aquí."
        />
      </div>
    </ProfileSubpageLayout>
  );
}
