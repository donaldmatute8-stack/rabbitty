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

const menuItems = [
  { icon: "💳", label: "Historial de transacciones", badge: null },
  { icon: "👥", label: "Programa de referidos", badge: null },
  { icon: "🔔", label: "Notificaciones", badge: 3 },
  { icon: "🛡", label: "Seguridad y Privacidad", badge: null },
  { icon: "❓", label: "Ayuda y Soporte", badge: null },
];

export function Perfil() {
  return (
    <div style={{ width: 390, height: 844, fontFamily: "var(--font-family-base)", backgroundColor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ paddingTop: 52, paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none"><path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <RabbitIcon size={36} />
          <div style={{ width: 18 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "#E91E63", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>B</span>
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 2 }}>Bruce</p>
            <p style={{ fontSize: 13, color: "#AAA", marginBottom: 6 }}>@bruce_wayne</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#E91E63", backgroundColor: "#FFF0F5", border: "1px solid #FFD0E0", borderRadius: 100, padding: "3px 10px" }}>Member</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#E91E63" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>1,250</p>
            <p style={{ fontSize: 12, color: "#AAA", marginTop: 2 }}>Bunz ganados</p>
          </div>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L6 3L10 10L12 6L14 13" stroke="#E91E63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>23</p>
            <p style={{ fontSize: 12, color: "#AAA", marginTop: 2 }}>Negocios visitados</p>
          </div>
        </div>

        <div style={{ backgroundColor: "#111", borderRadius: 14, padding: "12px 16px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 2 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>¿Tienes un negocio?</p>
          <p style={{ fontSize: 11, color: "#888" }}>Afíliate y otorga bunz</p>
        </div>

        <button style={{ width: "100%", backgroundColor: "#FFE8F0", border: "1.5px solid #FFBCD4", borderRadius: 14, padding: "14px 0", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#E91E63" }}>Invitar amigos</span>
          <span style={{ fontSize: 11, color: "#E91E63", opacity: 0.7 }}>Gana 50 bunz por ref</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingLeft: 20, paddingRight: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: "0.8px", marginBottom: 4, marginTop: 4 }}>CONFIGURACIÓN</p>
        {menuItems.map((item, i) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 15, paddingBottom: 15, borderBottom: i < menuItems.length - 1 ? "1px solid #F4F4F4" : "none", cursor: "pointer" }}>
            <span style={{ fontSize: 20, width: 24, textAlign: "center" }}>{item.icon}</span>
            <span style={{ flex: 1, fontSize: 15, color: "#111" }}>{item.label}</span>
            {item.badge && (
              <span style={{ backgroundColor: "#E91E63", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.badge}</span>
            )}
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="#CCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
