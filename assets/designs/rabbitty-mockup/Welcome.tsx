import "./_group.css";

function RabbitIcon({ size = 38 }: { size?: number }) {
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

export function Welcome() {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--background-light)",
      }}
      className="relative overflow-hidden flex flex-col"
    >
      <div style={{ paddingTop: 56, paddingLeft: 24, paddingRight: 24 }} className="flex items-center justify-between">
        <button style={{ padding: 4 }}>
          <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
            <rect width="24" height="2.5" rx="1.25" fill="#111111"/>
            <rect y="7.5" width="24" height="2.5" rx="1.25" fill="#111111"/>
            <rect y="15" width="24" height="2.5" rx="1.25" fill="#111111"/>
          </svg>
        </button>
        <RabbitIcon size={38} />
        <div style={{ width: 32 }} />
      </div>

      <div style={{ marginTop: 28, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 38, fontWeight: 700, color: "var(--text-dark)", letterSpacing: "-0.5px", lineHeight: 1.15 }}>
          Welcome, Bruce.
        </h1>
        <p style={{ marginTop: 16, fontSize: 15, color: "#666", lineHeight: 1.55, paddingLeft: 16, paddingRight: 16 }}>
          Rabbitty is about Sharing Experiences,<br/>
          simply and efficiently use your time and<br/>
          social life. Benefit yourself with bunz.
        </p>
      </div>

      <div style={{ marginTop: 32, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>
          You don't have any accounts
        </p>
      </div>

      <div style={{ marginTop: 16, paddingLeft: 24, paddingRight: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          border: "1px solid var(--border-light)",
          padding: "24px 24px 20px",
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>
            Become a member.
          </p>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
            Enter de Rabbitty Experience
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--primary-color)", fontSize: 16 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--primary-color)" }}>Open an account</span>
          </div>
        </div>

        <div style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          border: "1px solid var(--border-light)",
          padding: "24px 24px 20px",
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginBottom: 14 }}>
            Own a Business? Affiliate now.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--primary-color)", fontSize: 16 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--primary-color)" }}>Open an account</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 40, textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#999" }}>No activity</p>
      </div>

      <div style={{ marginTop: "auto", paddingBottom: 32, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#bbb" }}>© Rabbitty</p>
      </div>
    </div>
  );
}
