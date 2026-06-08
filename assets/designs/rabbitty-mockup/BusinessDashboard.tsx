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

function QRCode() {
  const cells: boolean[][] = [];
  const seed = [1,0,1,1,0,1,0,1, 0,1,0,0,1,0,1,0, 1,1,1,0,1,1,0,1, 0,0,1,1,0,0,1,1, 1,0,0,1,1,0,1,0, 0,1,1,0,0,1,0,1, 1,0,1,0,1,1,1,0, 0,1,0,1,0,0,1,1];
  for (let i = 0; i < 8; i++) {
    cells.push(seed.map(v => !!v));
  }
  return (
    <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(8, 10px)", gap: 2 }}>
      {cells.flat().map((on, i) => (
        <div key={i} style={{ width: 10, height: 10, backgroundColor: on ? "#111" : "transparent", borderRadius: 1 }} />
      ))}
    </div>
  );
}

const stats = [
  { value: "156", label: "TRANSACCIONES", delta: "↑ +12%", color: "#E91E63" },
  { value: "89", label: "CLIENTES", delta: "↑ +5%", color: "#E91E63" },
  { value: "2,340", label: "BUNZ DADOS", delta: "↑ +8%", color: "#E91E63" },
];

export function BusinessDashboard() {
  return (
    <div style={{ width: 390, height: 844, fontFamily: "var(--font-family-base)", backgroundColor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ paddingTop: 52, paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none"><path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <RabbitIcon size={32} />
          <div style={{ width: 18 }} />
        </div>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>Café Cultura</h1>
          <p style={{ fontSize: 13, color: "#AAA", marginTop: 2 }}>Restaurante y Café</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>{s.value}</p>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#AAA", letterSpacing: "0.5px", margin: "4px 0" }}>{s.label}</p>
              <p style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.delta}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ backgroundColor: "#111", borderRadius: 18, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.3"/>
                  <rect x="9" y="1" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.3"/>
                  <rect x="1" y="9" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.3"/>
                  <rect x="11" y="11" width="4" height="4" fill="#fff" rx="0.5"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Generar código QR</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Para registrar consumos de clientes</p>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 10 }}>
            <QRCode />
          </div>
        </div>

        <div style={{ border: "1px solid #F0F0F0", borderRadius: 18, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>Línea de crédito</p>
              <p style={{ fontSize: 13, color: "#AAA" }}>$75,000 disponible</p>
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>$100,000</p>
          </div>
          <div style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "25%", backgroundColor: "#E91E63", borderRadius: 100 }} />
          </div>
          <p style={{ fontSize: 11, color: "#AAA", marginTop: 6 }}>25% usado</p>
        </div>

        <div style={{ border: "1px solid #F0F0F0", borderRadius: 18, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>Tasa de recompensa</p>
              <p style={{ fontSize: 12, color: "#AAA" }}>Otorga 21% en bunz por consumo</p>
            </div>
            <p style={{ fontSize: 24, fontWeight: 900, color: "#E91E63" }}>21%</p>
          </div>
          <div style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "21%", backgroundColor: "#E91E63", borderRadius: 100 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#CCC" }}>10% Mínimo</span>
            <span style={{ fontSize: 11, color: "#CCC" }}>100% Máximo</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[
            { icon: "📊", label: "Analíticas" },
            { icon: "👥", label: "Clientes" },
            { icon: "⚙️", label: "Ajustes" },
          ].map((item) => (
            <button key={item.label} style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", cursor: "pointer", fontFamily: "var(--font-family-base)" }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{item.label}</span>
            </button>
          ))}
        </div>

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
