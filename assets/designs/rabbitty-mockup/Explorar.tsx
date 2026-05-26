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

const categories = [
  { icon: "☕", label: "Cafés", count: 12, color: "#FFE0EC", iconColor: "#E91E63" },
  { icon: "🍕", label: "Restaurantes", count: 8, color: "#FFF4E0", iconColor: "#FF9800" },
  { icon: "⭐", label: "Gimnasios", count: 5, color: "#E0F0FF", iconColor: "#2196F3" },
  { icon: "🛍", label: "Retail", count: 15, color: "#F0E0FF", iconColor: "#9C27B0" },
  { icon: "✨", label: "Belleza", count: 7, color: "#FFE0EC", iconColor: "#E91E63" },
  { icon: "💻", label: "Tecnología", count: 4, color: "#E0FFE8", iconColor: "#4CAF50" },
];

const trending = [
  { name: "Café Cultura", desc: "Café y desayunos", dist: "120m", stars: 4.8, bunz: "+50 bunz", img: "☕" },
  { name: "Pizza Napoli", desc: "Restaurante italiano", dist: "350m", stars: 4.6, bunz: "+30 bunz", img: "🍕" },
  { name: "Gimnasio Power", desc: "Fitness y bienestar", dist: "500m", stars: 4.9, bunz: "+100 bunz", img: "💪" },
];

export function Explorar() {
  return (
    <div style={{ width: 390, height: 844, fontFamily: "var(--font-family-base)", backgroundColor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ paddingTop: 52, paddingBottom: 12, paddingLeft: 20, paddingRight: 20, borderBottom: "1px solid #F0F0F0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none"><path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <RabbitIcon size={36} />
          <div style={{ width: 18 }} />
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="#AAA" strokeWidth="1.5"/>
            <path d="M11 11L14 14" stroke="#AAA" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input placeholder="Buscar negocios..." style={{ width: "100%", backgroundColor: "#F4F4F4", border: "none", borderRadius: 100, padding: "12px 16px 12px 38px", fontSize: 15, color: "#111", outline: "none", fontFamily: "var(--font-family-base)" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {["Lista", "Mapa"].map((tab, i) => (
            <button key={tab} style={{ flex: 1, padding: "9px 0", borderRadius: 100, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", backgroundColor: i === 0 ? "#111" : "#F0F0F0", color: i === 0 ? "#fff" : "#888", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "var(--font-family-base)" }}>
              {i === 1 && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="#888" strokeWidth="1.4"/><path d="M1 5h12M5 1v12" stroke="#888" strokeWidth="1.4"/></svg>}
              {i === 0 && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h10M2 10h6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg>}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 14 }}>Categorías</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
          {categories.map((cat) => (
            <div key={cat.label} style={{ backgroundColor: "#FAFAFA", border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 10px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: cat.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {cat.icon}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{cat.label}</span>
              <span style={{ fontSize: 11, color: "#AAA" }}>{cat.count} negocios</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L6 3L10 10L12 6L14 13" stroke="#E91E63" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>Tendencias</h2>
          </div>
          <span style={{ fontSize: 13, color: "#E91E63", fontWeight: 500 }}>Ver todo &rsaquo;</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {trending.map((b, i) => (
            <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 14, paddingBottom: 14, borderBottom: i < trending.length - 1 ? "1px solid #F4F4F4" : "none" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {b.img}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>{b.name}</p>
                <p style={{ fontSize: 12, color: "#AAA", marginBottom: 4 }}>{b.desc} — {b.dist}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 14 }}>⭐</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{b.stars}</span>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#E91E63", flexShrink: 0 }}>{b.bunz}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#E91E63" strokeWidth="1.5"/><path d="M8 5v4l2 2" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>Cerca de ti</h2>
          </div>
        </div>

        <div style={{ height: 68 }} />
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
