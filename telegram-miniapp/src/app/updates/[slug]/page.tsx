'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Share2 } from 'lucide-react';
import { MarkdownLite } from '@/components/updates/MarkdownLite';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

interface UpdatePost {
  slug: string;
  version: string | null;
  title: string;
  summary: string;
  body: string;
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

/** Entrada del Update Log. URL estable y compartible: /updates/<slug>. */
export default function UpdatePostPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const slug = typeof params?.slug === 'string' ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : '';
  const [post, setPost] = useState<UpdatePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/updates?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || 'Novedad no encontrada');
        if (alive) setPost(data.post as UpdatePost);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Error al cargar');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: post?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('Enlace copiado', 'success');
    } catch {
      showToast('No se pudo compartir', 'info');
    }
  };

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
          padding: 'calc(var(--safe-top, 0px) + 14px) 16px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            if (typeof window !== 'undefined' && window.history.length > 2) router.back();
            else router.push('/updates');
          }}
          aria-label="Volver"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(28,28,34,0.8)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={17} />
        </button>

        <span
          style={{
            fontSize: 9.5,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: 'rgba(255,143,184,0.9)',
          }}
        >
          Novedades de Rabbitty
        </span>

        <button
          type="button"
          onClick={() => void share()}
          aria-label="Compartir"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(28,28,34,0.8)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Share2 size={16} />
        </button>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '10px 20px 0' }}>
        {loading && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Cargando…</p>}
        {!loading && error && (
          <div style={{ paddingTop: 40, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>No encontramos esta novedad</p>
            <p style={{ margin: '6px 0 14px', fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{error}</p>
            <button
              type="button"
              onClick={() => router.push('/updates')}
              style={{
                border: 'none',
                borderRadius: 12,
                background: '#E91E63',
                color: '#fff',
                fontSize: 13,
                fontWeight: 900,
                padding: '10px 16px',
                cursor: 'pointer',
              }}
            >
              Ver todas las novedades
            </button>
          </div>
        )}

        {post && (
          <article>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {post.version && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.4,
                    borderRadius: 999,
                    padding: '3px 9px',
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

            <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              {post.title}
            </h1>

            {post.summary && (
              <p style={{ margin: '0 0 18px', fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)' }}>
                {post.summary}
              </p>
            )}

            {post.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.coverUrl}
                alt=""
                style={{ width: '100%', borderRadius: 16, marginBottom: 18, objectFit: 'cover' }}
              />
            )}

            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: 18,
              }}
            >
              <MarkdownLite markdown={post.body} />
            </div>

            {post.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 18 }}>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
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

            <div
              style={{
                marginTop: 26,
                padding: '14px 16px',
                borderRadius: 16,
                border: '1px solid rgba(233,30,99,0.25)',
                background: 'rgba(233,30,99,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bunzy-avatar.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' }}>
                Comunicado oficial de Rabbitty · Bunzy Connect
              </p>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
