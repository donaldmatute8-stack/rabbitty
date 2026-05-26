'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';

export default function SecurityPage() {
  return (
    <ProfileSubpageLayout title="Seguridad">
      <div style={{ paddingTop: 20, paddingBottom: 40 }}>
        <EmptyState
          icon={<div style={{ fontSize: 32 }}>🛡️</div>}
          title="Centro de Seguridad"
          description="Tus datos y fondos están protegidos mediante cifrado end-to-end. Las opciones de seguridad estarán disponibles pronto."
        />
      </div>
    </ProfileSubpageLayout>
  );
}
