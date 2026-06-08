import "./_group.css";

function RabbitIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.25)} viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
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

export function Feed() {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        fontFamily: "var(--font-family-base)",
        backgroundColor: "#EFEFEF",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{
        backgroundColor: "#fff",
        paddingTop: 52,
        paddingLeft: 20,
        paddingRight: 20,
        borderBottom: "1px solid #E8E8E8",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button style={{ padding: 4 }}>
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
              <path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <RabbitIcon size={36} />
          <div style={{ width: 18 }} />
        </div>

        <div style={{ display: "flex", gap: 32, paddingLeft: 4 }}>
          <div style={{
            paddingBottom: 12,
            borderBottom: "2.5px solid var(--primary-color)",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-dark)",
          }}>
            bunz'in
          </div>
          <div style={{ paddingBottom: 12, fontSize: 15, fontWeight: 500, color: "#AAA" }}>
            Stock
          </div>
          <div style={{ paddingBottom: 12, fontSize: 15, fontWeight: 500, color: "#AAA" }}>
            Freehands
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", backgroundColor: "#DDD" }}>
            <img
              src="/assets/showcase.jpg"
              alt="Conejito post"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          <div style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginBottom: 2 }}>Conejito</p>
              <p style={{ fontSize: 12, color: "#AAA" }}>iPhone X · 1 minute ago</p>
            </div>
            <button style={{ padding: 4, color: "#AAA" }}>
              <svg width="20" height="5" viewBox="0 0 20 5" fill="none">
                <circle cx="2.5" cy="2.5" r="2.5" fill="#AAA"/>
                <circle cx="10" cy="2.5" r="2.5" fill="#AAA"/>
                <circle cx="17.5" cy="2.5" r="2.5" fill="#AAA"/>
              </svg>
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", backgroundColor: "#DDD" }}>
            <img
              src="/assets/showcase.jpg"
              alt="Conejito post 2"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          <div style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginBottom: 2 }}>Conejito</p>
              <p style={{ fontSize: 12, color: "#AAA" }}>iPhone X · 3 minutes ago</p>
            </div>
            <button style={{ padding: 4, color: "#AAA" }}>
              <svg width="20" height="5" viewBox="0 0 20 5" fill="none">
                <circle cx="2.5" cy="2.5" r="2.5" fill="#AAA"/>
                <circle cx="10" cy="2.5" r="2.5" fill="#AAA"/>
                <circle cx="17.5" cy="2.5" r="2.5" fill="#AAA"/>
              </svg>
            </button>
          </div>
        </div>

        <div style={{ height: 72 }} />
      </div>

      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTop: "1px solid #EBEBEB",
        padding: "14px 36px 28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{
          fontFamily: "'Georgia', serif",
          fontSize: 28,
          fontStyle: "italic",
          fontWeight: 700,
          color: "var(--primary-color)",
          letterSpacing: "-1px",
          lineHeight: 1,
        }}>Ra</span>

        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path d="M13 2C7.477 2 3 6.23 3 11.427c0 3.066 1.525 5.793 3.9 7.573v3l3.45-1.9c.857.237 1.765.367 2.65.367 5.523 0 10-4.23 10-9.427C23 6.23 18.523 2 13 2Z" stroke="#999" strokeWidth="1.8" fill="none"/>
        </svg>

        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <rect x="3" y="3" width="20" height="20" rx="2" stroke="#999" strokeWidth="1.8"/>
          <rect x="7" y="7" width="12" height="12" rx="1" stroke="#999" strokeWidth="1.8"/>
        </svg>

        <svg width="24" height="26" viewBox="0 0 24 26" fill="none">
          <path d="M4 8h16l-1.5 14H5.5L4 8Z" stroke="#999" strokeWidth="1.8" strokeLinejoin="round"/>
          <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="#999" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}
