'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

interface UpdatePost {
  slug: string;
  version: string | null;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  coverUrl: string | null;
  publishedAt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT: 'Producto',
  IMPROVEMENT: 'Mejora',
  FIX: 'Corrección',
  SECURITY: 'Seguridad',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Update Log público: el blog de novedades de Rabbitty.
 * Cada entrada tiene URL estable (`/updates/<slug>`) para enlazarla desde un
 * comunicado de Bunzy Connect.
 */
export default function UpdatesPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<UpdatePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/updates?limit=50');
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || 'No se pudieron cargar');
        if (alive) setPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Error al cargar');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(ellipse at top, rgba(233,30,99,0.10) 0%, #09090D 55%, #050507 100%)',
        color: '#fff',
        paddingBottom: 60,
      }}
    >
      <header
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: 'calc(var(--safe-top, 0px) + 20px) 20px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #FF2E93, #8B5CF6)',
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bunzy-avatar.png" alt="Rabbitty" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: 'rgba(255,143,184,0.85)',
            }}
          >
            Rabbitty
          </p>
          <h1 style={{ margin: '2px 0 0', fontSize: 21, fontWeight: 900, letterSpacing: '-0.4px' }}>
            Novedades
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '8px 20px 0' }}>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
          Lo que va cambiando en Rabbitty: producto, mejoras y correcciones. Cada novedad tiene un enlace permanente.
        </p>

        {loading && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Cargando novedades…</p>}
        {!loading && error && <p style={{ fontSize: 13, color: '#FB7185' }}>{error}</p>}

        {!loading && !error && posts.length === 0 && (
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 18,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Todavía no hay novedades</p>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>
              Las actualizaciones aparecerán aquí y en tu chat de Bunzy.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map((post) => (
            <button
              key={post.slug}
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                router.push(`/updates/${post.slug}`);
              }}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 18,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                padding: '16px 16px 14px',
                color: '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {post.version && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 0.4,
                      borderRadius: 999,
                      padding: '2px 8px',
                      background: 'rgba(233,30,99,0.18)',
                      border: '1px solid rgba(233,30,99,0.35)',
                      color: '#FF8FB8',
                    }}
                  >
                    v{post.version}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 900,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  {CATEGORY_LABEL[post.category] || 'Producto'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
                  {formatDate(post.publishedAt)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 900, lineHeight: 1.3 }}>{post.title}</p>
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.62)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {post.summary}
                  </p>
                  {post.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {post.tags.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 999,
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.55)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight size={18} style={{ marginTop: 4, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
