'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, MessageCircle, Search, UserPlus, Users, X } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';
import {
  contactMatches,
  listLocalContacts,
  saveLocalContact,
  type LocalContact,
} from '@/lib/localContacts';

interface DirectoryUser {
  id: string;
  name: string;
  username?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  avatar?: string | null;
  isBusiness?: boolean;
}

interface NewChatHubProps {
  open: boolean;
  onClose: () => void;
  onOpenGroup: () => void;
  ownerId: string;
}

/**
 * Hub único de creación de chats:
 *  - nuevo grupo (delega en CreateGroupSheet)
 *  - nuevo contacto (agenda local; si existe en Rabbitty se enlaza)
 *  - lista de contactos con búsqueda por nombre, teléfono o usuario
 */
export function NewChatHub({ open, onClose, onOpenGroup, ownerId }: NewChatHubProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'menu' | 'contact'>('menu');
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<LocalContact[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('menu');
    setQuery('');
    setLocal(listLocalContacts(ownerId));
  }, [open, ownerId]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setDirectory([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { ...(headers || {}), 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() }),
        });
        const data = await res.json().catch(() => null);
        if (alive && data?.success && Array.isArray(data.results)) {
          setDirectory(data.results);
        }
      } catch {
        if (alive) setDirectory([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  const localRows = useMemo(
    () => local.filter((c) => contactMatches(c, query)),
    [local, query],
  );

  const directoryRows = useMemo(() => {
    return directory.filter((u) => {
      const linked = local.some(
        (c) =>
          c.linkedUserId === u.id ||
          (u.phoneNumber && c.phone.replace(/\D/g, '') === u.phoneNumber.replace(/\D/g, '')),
      );
      return !linked;
    });
  }, [directory, local]);

  if (!open) return null;

  const close = () => {
    PlatformBridge.hapticFeedback('light');
    onClose();
  };

  const openChat = (targetId: string) => {
    PlatformBridge.hapticFeedback('medium');
    close();
    router.push(`/chat/${targetId}`);
  };

  const invite = (contact: LocalContact) => {
    PlatformBridge.hapticFeedback('light');
    const digits = contact.phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `¡Hola ${contact.name}! Te invito a Rabbitty, la app donde cada visita deja recompensas. https://rabbitty.me/download`,
    );
    const url = digits.length >= 8 ? `https://wa.me/${digits}?text=${text}` : `https://rabbitty.me/download`;
    void PlatformBridge.openExternalUrl(url);
  };

  const saveContact = async () => {
    if (saving) return;
    if (name.trim().length < 2) return showToast('Escribe el nombre del contacto', 'error');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return showToast('Escribe un teléfono válido', 'error');

    setSaving(true);
    try {
      // Si ya existe en Rabbitty, enlazarlo para abrir el chat real.
      let linkedUserId: string | null = null;
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { ...(headers || {}), 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: digits }),
        });
        const data = await res.json().catch(() => null);
        const match = (data?.results || []).find(
          (u: DirectoryUser) =>
            (u.phoneNumber && u.phoneNumber.replace(/\D/g, '').endsWith(digits.slice(-10))) ||
            (username && (u.username || '').toLowerCase() === username.trim().toLowerCase()),
        );
        linkedUserId = match?.id ?? null;
      } catch {
        linkedUserId = null;
      }

      saveLocalContact(ownerId, { name, phone, username, email, linkedUserId });
      setLocal(listLocalContacts(ownerId));
      setMode('menu');
      setQuery(phone);
      setName('');
      setPhone('');
      setUsername('');
      setEmail('');
      showToast(linkedUserId ? 'Contacto agregado y enlazado 🐰' : 'Contacto guardado. Puedes invitarlo.', 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#08080C] text-(--text-primary)">
      <header
        className="flex items-center gap-3 border-b border-white/10 px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
      >
        {mode === 'contact' ? (
          <button
            type="button"
            onClick={() => setMode('menu')}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/15 text-pink-300">
            <MessageCircle size={18} />
          </div>
        )}
        <div className="flex-1">
          <p className="m-0 text-[15px] font-black">{mode === 'contact' ? 'Nuevo contacto' : 'Nuevo chat'}</p>
          <p className="m-0 text-[11px] text-white/45">
            {mode === 'contact' ? 'Nombre, teléfono y datos opcionales' : 'Grupo, contacto o alguien de Rabbitty'}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </header>

      {mode === 'menu' ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 p-4">
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                close();
                onOpenGroup();
              }}
              className="flex flex-col items-start gap-2 rounded-2xl border border-pink-500/25 bg-pink-500/10 p-4 text-left active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300">
                <Users size={19} />
              </div>
              <div>
                <p className="m-0 text-sm font-black text-white">Nuevo grupo</p>
                <p className="m-0 text-[11px] text-white/45">Rabbitters, privado</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setMode('contact');
              }}
              className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white/80">
                <UserPlus size={19} />
              </div>
              <div>
                <p className="m-0 text-sm font-black text-white">Nuevo contacto</p>
                <p className="m-0 text-[11px] text-white/45">Nombre y teléfono</p>
              </div>
            </button>
          </div>

          <div className="px-4 pb-2">
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
              <Search size={16} className="shrink-0 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, 80))}
                placeholder="Buscar por nombre, teléfono o usuario"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              />
              {searching && <span className="text-[10px] text-pink-300">…</span>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
            {localRows.length > 0 && (
              <p className="m-0 mb-1.5 mt-2 text-[9.5px] font-black uppercase tracking-[1.5px] text-white/35">
                Mis contactos
              </p>
            )}
            {localRows.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => (c.linkedUserId ? openChat(c.linkedUserId) : invite(c))}
                className="mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:bg-white/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-bold text-white">{c.name}</p>
                  <p className="m-0 truncate text-[11px] text-white/40">
                    {c.username ? `@${c.username}` : c.phone}
                    {!c.linkedUserId && ' · Invitar'}
                  </p>
                </div>
                <ChevronRight size={16} className="text-white/25" />
              </button>
            ))}

            {directoryRows.length > 0 && (
              <p className="m-0 mb-1.5 mt-3 text-[9.5px] font-black uppercase tracking-[1.5px] text-white/35">
                En Rabbitty
              </p>
            )}
            {directoryRows.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => openChat(u.id)}
                className="mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:bg-white/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-sm font-black text-pink-200">
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-bold text-white">{u.name}</p>
                  <p className="m-0 truncate text-[11px] text-white/40">
                    {u.username ? `@${u.username}` : u.phoneNumber || (u.isBusiness ? 'Negocio' : 'Rabbitter')}
                  </p>
                </div>
                <ChevronRight size={16} className="text-white/25" />
              </button>
            ))}

            {localRows.length === 0 && directoryRows.length === 0 && !searching && (
              <div className="px-4 py-12 text-center">
                <p className="m-0 text-sm text-white/50">
                  {query.trim().length >= 2 ? 'Sin resultados.' : 'Busca a alguien o crea un contacto nuevo.'}
                </p>
                <p className="m-0 mt-1 text-[11px] text-white/30">
                  Si aún no está en Rabbitty, guarda su teléfono y podrás invitarlo.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
          {[
            { label: 'Nombre', value: name, set: setName, placeholder: 'Ej. Ana López', max: 60 },
            { label: 'Teléfono', value: phone, set: setPhone, placeholder: '322 123 4567', max: 20 },
            { label: 'Usuario (opcional)', value: username, set: setUsername, placeholder: '@ana', max: 40 },
            { label: 'Correo (opcional)', value: email, set: setEmail, placeholder: 'ana@correo.com', max: 120 },
          ].map((field) => (
            <label key={field.label} className="block">
              <span className="mb-1 block text-[9.5px] font-black uppercase tracking-[1.2px] text-white/40">
                {field.label}
              </span>
              <input
                value={field.value}
                onChange={(e) => field.set(e.target.value.slice(0, field.max))}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none focus:border-pink-500/60 placeholder:text-white/25"
              />
            </label>
          ))}

          <p className="m-0 text-[10.5px] leading-relaxed text-white/35">
            El contacto se guarda en tu dispositivo. Si su teléfono ya está en Rabbitty, se enlaza y
            puedes escribirle; si no, podrás invitarlo por WhatsApp.
          </p>

          <button
            type="button"
            onClick={saveContact}
            disabled={saving}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 py-3.5 text-sm font-black text-white disabled:opacity-50"
          >
            <UserPlus size={16} /> {saving ? 'Guardando…' : 'Guardar contacto'}
          </button>
        </div>
      )}
    </div>
  );
}
