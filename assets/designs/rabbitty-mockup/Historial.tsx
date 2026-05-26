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

const filters = ["Todos", "Ganado", "Gastado", "Comida", "Fitness", "Tecnología"];

const transactions = [
  { icon: "☕", color: "#FFF0F0", iconColor: "#E91E63", name: "Café Cultura", sub: "Desayuno — Hoy, 10:30 AM", amount: "+50", positive: true },
  { icon: "🍕", color: "#FFF4E0", iconColor: "#FF9800", name: "Pizza Napoli", sub: "Cena — Ayer, 7:00 PM", amount: "-100", positive: false },
  { icon: "💪", color: "#E8FFE8", iconColor: "#4CAF50", name: "Gimnasio Power", sub: "Membresía — Ayer, 9:00 AM", amount: "+30", positive: true },
  { icon: "💻", color: "#E8F0FF", iconColor: "#2196F3", name: "TechZone", sub: "Audífonos — 22 Ene, 3:45 PM", amount: "+75", positive: true },
  { icon: "✨", color: "#F5E8FF", iconColor: "#9C27B0", name: "Spa Relax", sub: "Masaje — 20 Ene, 2:00 PM", amount: "-200", positive: false },
];

export function Historial() {
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
        <h1 style={{ fontSize: 34, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", marginBottom: 16 }}>Historial</h1>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v6m0 0l-3-3m3 3l3-3" stroke="#4CAF50" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 12, color: "#4CAF50", fontWeight: 600 }}>Ganado</span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>155</span>
            <span style={{ fontSize: 13, color: "#AAA", marginLeft: 4 }}>bunz</span>
          </div>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 13V7m0 0l-3 3m3-3l3 3" stroke="#E91E63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 12, color: "#E91E63", fontWeight: 600 }}>Gastado</span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>300</span>
            <span style={{ fontSize: 13, color: "#AAA", marginLeft: 4 }}>bunz</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }}>
          {filters.map((f, i) => (
            <button key={f} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", backgroundColor: i === 0 ? "#111" : "#F0F0F0", color: i === 0 ? "#fff" : "#666", fontFamily: "var(--font-family-base)" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingLeft: 20, paddingRight: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: "0.8px", marginBottom: 4, marginTop: 8 }}>ENERO 2026</p>

        {transactions.map((tx, i) => (
          <div key={tx.name + i} style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 14, paddingBottom: 14, borderBottom: i < transactions.length - 1 ? "1px solid #F4F4F4" : "none" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tx.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
              {tx.icon}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>{tx.name}</p>
              <p style={{ fontSize: 12, color: "#AAA" }}>{tx.sub}</p>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: tx.positive ? "#4CAF50" : "#E91E63", flexShrink: 0 }}>
              {tx.amount}
            </span>
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
