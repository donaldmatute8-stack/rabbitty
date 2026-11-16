'use client';

/**
 * ── Mi lista de deseos ──────────────────────────────────────────────────────
 *
 * Se siente parte de la app, no una pantalla suelta:
 * · entra desde Perfil (y desde la ficha de cada producto con un corazón)
 * · usa el mismo lenguaje visual del pase y las membresías (cristal, degradado
 *   de marca, tarjetas redondeadas)
 * · comparte con los grupos que ya existen (la madriguera)
 *
 * Los deseos caducan a 90 días: si algo ya lo conseguiste, se quita solo.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Plus, Share2, Trash2, Users, X, Check, Calendar, Sparkles } from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

interface WishItem {
  id: string;
  kind: string;
  businessId: string | null;
  menuItemId: string | null;
  title: string;
  imageUrl: string | null;
  priceSnapshot: number | null;
  note: string | null;
  status: string;
  expiresAt: string;
  pledges: number;
}

interface Wishlist {
  id: string;
  title: string | null;
  visibility: string;
  birthdayAt: string | null;
}

interface GiftRow {
  id: string;
  itemId: string;
  status: string;
  amount: number;
  voucherCode: string | null;
  title?: string;
}

interface CircleItem {
  id: string;
  title: string;
  imageUrl: string | null;
  priceSnapshot: number | null;
  note: string | null;
  kind: string;
  businessId: string | null;
  ownerId: string;
  ownerName: string;
  groupId: string;
  pledges: number;
  iPledged: boolean;
}

interface GroupOption {
  id: string;
  name: string;
}

type Tab = 'mine' | 'circle';

export default function WishlistPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('mine');
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Wishlist | null>(null);
  const [items, setItems] = useState<WishItem[]>([]);
  const [circle, setCircle] = useState<CircleItem[]>([]);
  const [giftsReceived, setGiftsReceived] = useState<GiftRow[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [sharedGroupIds, setSharedGroupIds] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showBirthday, setShowBirthday] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [birthday, setBirthday] = useState('');

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const headers = await PlatformBridge.getAuthHeaders();
    return fetch(input, { cache: 'no-store', ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  }, []);

  const loadMine = useCallback(async () => {
    const res = await authFetch('/api/wishlist');
    const data = await res.json();
    if (data?.success) {
      setList(data.wishlist);
      setItems(Array.isArray(data.items) ? data.items : []);
      setSharedGroupIds(Array.isArray(data.shares) ? data.shares.map((s: { groupId: string }) => s.groupId) : []);
      if (data.wishlist?.birthdayAt) setBirthday(String(data.wishlist.birthdayAt).slice(0, 10));
      setGiftsReceived(Array.isArray(data.gifts?.received) ? data.gifts.received : []);
    }
  }, [authFetch]);

  const loadCircle = useCallback(async () => {
    const res = await authFetch('/api/wishlist/circle');
    const data = await res.json();
    if (data?.success) setCircle(Array.isArray(data.items) ? data.items : []);
  }, [authFetch]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await Promise.all([loadMine(), loadCircle()]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Grupos para compartir (reutiliza el endpoint del chat)
    void (async () => {
      try {
        const res = await authFetch('/api/chat');
        const data = await res.json();
        const conversations = Array.isArray(data?.conversations) ? data.conversations : Array.isArray(data) ? data : [];
        const onlyGroups = conversations
          .filter((c: { kind?: string; id?: string }) => c?.kind === 'GROUP' && c?.id)
          .map((c: { id: string; name?: string; title?: string }) => ({ id: c.id, name: c.name || c.title || 'Grupo' }));
        setGroups(onlyGroups);
      } catch { /* sin grupos */ }
    })();
  }, [authFetch]);

  const activeItems = useMemo(() => items.filter((i) => i.status === 'ACTIVE'), [items]);
  const giftByItem = useMemo(() => {
    const map = new Map<string, GiftRow>();
    for (const g of giftsReceived) map.set(g.itemId, g);
    return map;
  }, [giftsReceived]);

  const addWish = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch('/api/wishlist/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'CUSTOM',
          title: title.trim(),
          priceSnapshot: amount ? Number(amount) : null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'No se pudo agregar');
      PlatformBridge.hapticFeedback('success');
      showToast('Deseo agregado', 'success');
      setShowAdd(false);
      setTitle('');
      setAmount('');
      setNote('');
      await loadMine();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo agregar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeWish = async (id: string) => {
    try {
      PlatformBridge.hapticFeedback('light');
      await authFetch(`/api/wishlist/items?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      showToast('No se pudo quitar', 'error');
    }
  };

  const toggleShare = async (groupId: string) => {
    const shared = sharedGroupIds.includes(groupId);
    try {
      PlatformBridge.hapticFeedback('light');
      if (shared) {
        await authFetch(`/api/wishlist/share?groupId=${encodeURIComponent(groupId)}`, { method: 'DELETE' });
        setSharedGroupIds((prev) => prev.filter((g) => g !== groupId));
      } else {
        const res = await authFetch('/api/wishlist/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId }),
        });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || 'No se pudo compartir');
        setSharedGroupIds((prev) => [...prev, groupId]);
        showToast('Lista compartida con el grupo', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo compartir', 'error');
    }
  };

  const saveBirthday = async () => {
    try {
      await authFetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthdayAt: birthday || null }),
      });
      setShowBirthday(false);
      showToast(birthday ? 'Cumpleaños guardado' : 'Cumpleaños quitado', 'success');
      await loadMine();
    } catch {
      showToast('No se pudo guardar', 'error');
    }
  };

  const giftWithPayment = async (item: CircleItem) => {
    try {
      PlatformBridge.hapticFeedback('medium');
      const res = await authFetch('/api/wishlist/gift/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!data?.success || !data?.url) throw new Error(data?.error || 'No se pudo iniciar el pago');
      window.location.href = data.url as string;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo regalar', 'error');
    }
  };

  const pledge = async (item: CircleItem) => {
    try {
      PlatformBridge.hapticFeedback('medium');
      if (item.iPledged) {
        await authFetch(`/api/wishlist/pledge?itemId=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
        setCircle((prev) => prev.map((i) => (i.id === item.id ? { ...i, iPledged: false, pledges: Math.max(0, i.pledges - 1) } : i)));
      } else {
        const res = await authFetch('/api/wishlist/pledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id }),
        });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || 'No se pudo apuntar');
        setCircle((prev) => prev.map((i) => (i.id === item.id ? { ...i, iPledged: true, pledges: i.pledges + 1 } : i)));
        showToast('Apuntado. Le avisamos a la persona.', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo apuntar', 'error');
    }
  };

  return (
    <ProfileSubpageLayout
      title="Mi lista de deseos"
      right={
        <button
          type="button"
          onClick={() => { PlatformBridge.hapticFeedback('light'); setShowShare(true); }}
          aria-label="Compartir lista"
          className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <Share2 size={16} />
        </button>
      }
    >
      {/* Tabs */}
      <div className="mb-4 flex rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-1">
        {([
          { id: 'mine' as const, label: 'Mis deseos', icon: Gift },
          { id: 'circle' as const, label: 'Madriguera', icon: Users },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); PlatformBridge.hapticFeedback('light'); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-extrabold transition-all ${tab === t.id ? 'bg-[#E91E63] text-white shadow-[0_4px_14px_rgba(233,30,99,.35)]' : 'text-(--text-muted)'}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-pink-500" /></div>
      ) : tab === 'mine' ? (
        <>
          {/* Estado de la lista: compartida + cumpleaños */}
          <div className="mb-4 rounded-3xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-[#E91E63]">Tu lista</p>
                <p className="m-0 mt-0.5 text-[12.5px] font-bold text-(--text-primary)">
                  {activeItems.length === 0 ? 'Aún sin deseos' : `${activeItems.length} deseo${activeItems.length === 1 ? '' : 's'} activo${activeItems.length === 1 ? '' : 's'}`}
                </p>
                <p className="m-0 mt-0.5 text-[11px] text-(--text-muted)">
                  {sharedGroupIds.length > 0
                    ? `Compartida con ${sharedGroupIds.length} grupo${sharedGroupIds.length === 1 ? '' : 's'}`
                    : 'Privada — solo tú la ves'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {list?.birthdayAt && (
                  <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-black text-fuchsia-300">
                    🎂 {new Date(list.birthdayAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowBirthday(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-(--border-subtle) px-2.5 py-1 text-[10px] font-bold text-(--text-muted) active:scale-95"
                >
                  <Calendar size={11} /> Cumpleaños
                </button>
              </div>
            </div>
          </div>

          {/* Deseos */}
          {activeItems.length === 0 ? (
            <div className="rounded-3xl border border-(--border-subtle) bg-(--bg-elevated) p-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 text-2xl">🎁</div>
              <p className="m-0 text-[14px] font-black text-(--text-primary)">Tu lista está vacía</p>
              <p className="m-0 mt-1 text-[12px] leading-snug text-(--text-muted)">
                Agrega algo libre (un antojo) o guárdalo desde la ficha de cualquier negocio con el corazón.
              </p>
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="mt-4 rounded-2xl px-4 py-2.5 text-[12px] font-black text-white active:scale-95"
                style={{ background: 'linear-gradient(135deg, #E91E63 0%, #8B5CF6 100%)' }}
              >
                Agregar mi primer deseo
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  className="flex items-center gap-3 rounded-3xl border border-(--border-subtle) bg-(--bg-elevated) p-3"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-black/30">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl">{item.kind === 'PRODUCT' ? '🍽️' : '✨'}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-black text-(--text-primary)">{item.title}</p>
                    {item.note && <p className="m-0 mt-0.5 line-clamp-1 text-[11px] text-(--text-muted)">{item.note}</p>}
                    <div className="mt-1 flex items-center gap-2">
                      {item.priceSnapshot != null && (
                        <span className="text-[11px] font-black text-[#E91E63]">${Number(item.priceSnapshot).toFixed(0)}</span>
                      )}
                      {item.pledges > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9.5px] font-black text-emerald-300">
                          {item.pledges} se apuntó
                        </span>
                      )}
                      <span className="text-[9.5px] text-(--text-muted)">
                        hasta {new Date(item.expiresAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                      </span>
                      {giftByItem.get(item.id)?.voucherCode && (
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[9.5px] font-black text-amber-300">
                          Vale {giftByItem.get(item.id)?.voucherCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeWish(item.id)}
                    aria-label="Quitar deseo"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-(--text-muted) active:scale-90"
                    style={{ background: 'var(--bg-primary)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}

              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="mt-1 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-(--border-subtle) py-3 text-[12px] font-black text-(--text-muted) active:scale-[0.99]"
              >
                <Plus size={15} /> Agregar otro deseo
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── Madriguera ── */
        <>
          {circle.length === 0 ? (
            <div className="rounded-3xl border border-(--border-subtle) bg-(--bg-elevated) p-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">🐇</div>
              <p className="m-0 text-[14px] font-black text-(--text-primary)">Nada en tu madriguera</p>
              <p className="m-0 mt-1 text-[12px] leading-snug text-(--text-muted)">
                Cuando alguien de tus grupos comparta su lista, sus deseos aparecerán aquí para que le regales algo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {circle.map((item) => (
                <div key={`${item.id}-${item.groupId}`} className="rounded-3xl border border-(--border-subtle) bg-(--bg-elevated) p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-black/30">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl">{item.kind === 'PRODUCT' ? '🍽️' : '✨'}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13px] font-black text-(--text-primary)">{item.title}</p>
                      <p className="m-0 mt-0.5 truncate text-[11px] text-(--text-muted)">De {item.ownerName}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {item.priceSnapshot != null && (
                          <span className="text-[11px] font-black text-[#E91E63]">${Number(item.priceSnapshot).toFixed(0)}</span>
                        )}
                        {item.pledges > 0 && (
                          <span className="text-[9.5px] text-(--text-muted)">{item.pledges} apuntado{item.pledges === 1 ? '' : 's'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => pledge(item)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[11.5px] font-black active:scale-[0.99]"
                      style={
                        item.iPledged
                          ? { background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.35)' }
                          : { background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }
                      }
                    >
                      {item.iPledged ? <><Check size={13} /> Ya me apunté</> : <><Gift size={13} /> Me apunto</>}
                    </button>
                    {item.priceSnapshot != null && Number(item.priceSnapshot) > 0 && (
                      <button
                        type="button"
                        onClick={() => giftWithPayment(item)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[11.5px] font-black text-white active:scale-[0.99]"
                        style={{ background: 'linear-gradient(135deg, #E91E63 0%, #8B5CF6 100%)' }}
                      >
                        <Sparkles size={13} /> Regalar ${Number(item.priceSnapshot).toFixed(0)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Hoja: agregar deseo ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-md"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-lg rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-4"
              style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-(--border-subtle)" />
              <div className="mb-3 flex items-center justify-between">
                <p className="m-0 text-[15px] font-black text-(--text-primary)">Nuevo deseo</p>
                <button type="button" onClick={() => setShowAdd(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-(--bg-elevated) text-(--text-muted)"><X size={15} /></button>
              </div>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="¿Qué se te antoja? (pizza, helado, iPad…)"
                className="w-full rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) px-4 py-3 text-[13px] font-semibold text-(--text-primary) outline-none"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  placeholder="Monto aprox. (opcional)"
                  className="w-full rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) px-4 py-3 text-[13px] font-semibold text-(--text-primary) outline-none"
                />
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota (talla, sabor…)"
                  className="w-full rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) px-4 py-3 text-[13px] font-semibold text-(--text-primary) outline-none"
                />
              </div>
              <p className="m-0 mt-2 text-[10.5px] text-(--text-muted)">
                Caduca en 90 días. Si ya lo conseguiste, quítalo de la lista.
              </p>

              <button
                type="button"
                onClick={addWish}
                disabled={saving || !title.trim()}
                className="mt-3 w-full rounded-2xl py-3 text-[13px] font-black text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E91E63 0%, #8B5CF6 100%)' }}
              >
                {saving ? 'Guardando…' : 'Agregar a mi lista'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hoja: compartir con grupos ── */}
      <AnimatePresence>
        {showShare && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-md"
            onClick={() => setShowShare(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-lg max-h-[80dvh] overflow-y-auto rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-4"
              style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-(--border-subtle)" />
              <div className="mb-1 flex items-center justify-between">
                <p className="m-0 text-[15px] font-black text-(--text-primary)">Compartir con mi madriguera</p>
                <button type="button" onClick={() => setShowShare(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-(--bg-elevated) text-(--text-muted)"><X size={15} /></button>
              </div>
              <p className="m-0 mb-3 text-[11px] text-(--text-muted)">Elige los grupos que pueden ver tus deseos. Puedes quitarlo cuando quieras.</p>

              {groups.length === 0 ? (
                <p className="m-0 rounded-2xl border border-dashed border-(--border-subtle) p-4 text-[12px] text-(--text-muted)">
                  Aún no tienes grupos. Crea uno en Mensajes y vuelve aquí.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {groups.map((g) => {
                    const shared = sharedGroupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleShare(g.id)}
                        className="flex items-center justify-between rounded-2xl border px-3.5 py-3 active:scale-[0.99]"
                        style={{
                          borderColor: shared ? 'rgba(16,185,129,0.4)' : 'var(--border-subtle)',
                          background: shared ? 'rgba(16,185,129,0.10)' : 'var(--bg-elevated)',
                        }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Users size={14} className={shared ? 'text-emerald-400' : 'text-(--text-muted)'} />
                          <span className="truncate text-[12.5px] font-bold text-(--text-primary)">{g.name}</span>
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${shared ? 'text-emerald-400' : 'text-(--text-muted)'}`}>
                          {shared ? 'Compartida' : 'Compartir'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hoja: cumpleaños ── */}
      <AnimatePresence>
        {showBirthday && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-md"
            onClick={() => setShowBirthday(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-lg rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-4"
              style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-(--border-subtle)" />
              <p className="m-0 text-[15px] font-black text-(--text-primary)">Tu cumpleaños</p>
              <p className="m-0 mt-0.5 mb-3 text-[11px] text-(--text-muted)">
                Solo lo usamos para recordarle a tu madriguera que se acerca. No mostramos la fecha.
              </p>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) px-4 py-3 text-[13px] font-semibold text-(--text-primary) outline-none"
              />
              <div className="mt-3 flex gap-2">
                {birthday && (
                  <button
                    type="button"
                    onClick={() => { setBirthday(''); void saveBirthday(); }}
                    className="rounded-2xl border border-(--border-subtle) px-4 py-3 text-[12px] font-black text-(--text-muted)"
                  >
                    Quitar
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveBirthday}
                  className="flex-1 rounded-2xl py-3 text-[13px] font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #E91E63 0%, #8B5CF6 100%)' }}
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-(--text-muted)">
        <Sparkles size={11} /> Los deseos caducan a los 90 días
      </p>
    </ProfileSubpageLayout>
  );
}
