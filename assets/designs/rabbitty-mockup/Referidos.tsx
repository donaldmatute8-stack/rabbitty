import "./_group.css";

function RabbitIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.25)} viewBox="0 0 38 48" fill="none">
      <path d="M11 1C11 1 7 4 7 14C7 20 9.5 23 13 23C16.5 23 18 19 18 14C18 6.5 14 1 11 1Z" fill="#2A2A2A"/>
      <path d="M27 1C27 1 31 4 31 14C31 20 28.5 23 25 23C21.5 23 20 19 20 14C20 6.5 24 1 27 1Z" fill="#2A2A2A"/>
      <ellipse cx="19" cy="33" rx="14" ry="12" fill="#1A1A1A"/>
      <rect x="8" y="29" width="8.5" height="6" rx="1.5" fill="#C8A830" opacity="0.9"/>
      <rect x="21.5" y="29" width="8.5" height="6" rx="1.5" fill="#C8A830" opacity="0.9"/>
      <line x1="16.5" y1="32" x2="21.5" y2="32" stroke="#333" strokeWidth="1.2"/>
      <path d="M13 43L19 41L25 43L19 45.5Z" fill="#2A2A2A"/>
      <circle cx="19" cy="43" r="1.8" fill="#111"/>
    </svg>
  );
}

const levels = [
  { name: "Bronce", refs: 0, bunz: "+50 bunz", color: "#CD7F32", active: true },
  { name: "Plata", refs: 5, bunz: "+75 bunz", color: "#999", active: false },
  { name: "Oro", refs: 15, bunz: "+100 bunz", color: "#DAA520", active: false },
  { name: "Platino", refs: 50, bunz: "+200 bunz", color: "#4FC3F7", active: false },
];

const referidos = [
  { initial: "M", name: "María G.", time: "Hace 2 días", color: "#E91E63" },
  { initial: "C", name: "Carlos R.", time: "Hace 5 días", color: "#2196F3" },
  { initial: "A", name: "Ana L.", time: "Hace 1 semana", color: "#4CAF50" },
];

export function Referidos() {
  return (
    <div style={{ width: 390, height: 844, fontFamily: "var(--font-family-base)", backgroundColor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ paddingTop: 52, paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none"><path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <RabbitIcon size={36} />
          <div style={{ width: 18 }} />
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", marginBottom: 4 }}>Referidos</h1>
        <p style={{ fontSize: 14, color: "#AAA", marginBottom: 16 }}>Gana <strong style={{ color: "#111" }}>50 bunz</strong> por cada amigo que se una.</p>

        <div style={{ background: "linear-gradient(135deg, #E91E63 0%, #C2185B 100%)", borderRadius: 18, padding: "20px 20px 16px", marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.8px", marginBottom: 8 }}>TU CÓDIGO DE REFERIDO</p>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "4px", textAlign: "center", marginBottom: 16 }}>RABBIT2026</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 100, padding: "10px 0", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "var(--font-family-base)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="9" height="10" rx="2" stroke="#fff" strokeWidth="1.4"/><path d="M4 3V2a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1" stroke="#fff" strokeWidth="1.4"/></svg>
              Copiar
            </button>
            <button style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 100, padding: "10px 0", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "var(--font-family-base)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="11" cy="3" r="2" stroke="#fff" strokeWidth="1.4"/><circle cx="3" cy="7" r="2" stroke="#fff" strokeWidth="1.4"/><circle cx="11" cy="11" r="2" stroke="#fff" strokeWidth="1.4"/><path d="M5 6L9 4M5 8L9 10" stroke="#fff" strokeWidth="1.4"/></svg>
              Compartir
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1c1.5 0 2.5 1 2.5 2.5S8.5 6 7 6 4.5 5 4.5 3.5 5.5 1 7 1zM1 13c0-3 2.7-5 6-5s6 2 6 5" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </div>
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>3</p>
            <p style={{ fontSize: 12, color: "#AAA" }}>amigos Referidos</p>
          </div>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10L5 3L8 8L10 5L12 10" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>150</p>
            <p style={{ fontSize: 12, color: "#AAA" }}>bunz Ganado</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingLeft: 20, paddingRight: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: "0.8px", marginBottom: 10 }}>NIVELES DE RECOMPENSA</p>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 16 }}>
          {levels.map((level) => (
            <div key={level.name} style={{ flexShrink: 0, width: 100, border: level.active ? `2px solid ${level.color}` : "1px solid #F0F0F0", borderRadius: 14, padding: "12px 10px", backgroundColor: level.active ? "#FFFBF8" : "#FAFAFA" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: level.color, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12 }}>⭐</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 2 }}>{level.name}</p>
              <p style={{ fontSize: 11, color: "#AAA", marginBottom: 4 }}>{level.refs} refs necesarios</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#E91E63" }}>{level.bunz}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: "0.8px", marginBottom: 10 }}>TUS REFERIDOS</p>
        {referidos.map((r, i) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12, borderBottom: i < referidos.length - 1 ? "1px solid #F4F4F4" : "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: r.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{r.initial}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>{r.name}</p>
              <p style={{ fontSize: 12, color: "#AAA" }}>{r.time}</p>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#E91E63" }}>+50 bunz</span>
          </div>
        ))}
        <div style={{ height: 72 }} />
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTop: "1px solid #EBEBEB", padding: "14px 36px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'Georgia', serif", fontSize: 28, fontStyle: "italic", fontWeight: 700, color: "#E91E63", letterSpacing: "-1px" }}>Ra</span>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 2C7.477 2 3 6.23 3 11.427c0 3.066 1.525 5.793 3.9 7.573v3l3.45-1.9c.857.237 1.765.367 2.65.367 5.523 0 10-4.23 10-9.427C23 6.23 18.523 2 13 2Z" stroke="#999" strokeWidth="1.8"/></svg>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><rect x="3" y="3" width="20" height="20" rx="2" stroke="#999" strokeWidth="1.8"/><rect x="7" y="7" width="12" height="12" rx="1" stroke="#999" strokeWidth="1.8"/></svg>
        <svg width="24" height="26" viewBox="0 0 24 26" fill="none"><path d="M4 8h16l-1.5 14H5.5L4 8Z" stroke="#999" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="#999" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </div>
    </div>
  );
}
