import "./_group.css";

const interests = [
  "Food", "Travel", "Fashion", "Music",
  "Sports", "Tech", "Art", "Books",
  "Gaming", "Fitness", "Film", "Nature",
];

export function RabbitBot() {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        fontFamily: "var(--font-family-base)",
        backgroundColor: "#F4F4F4",
        display: "flex",
        flexDirection: "column",
        paddingTop: 56,
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E91E63" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E91E63", opacity: 0.55 }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E91E63", opacity: 0.25 }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginLeft: 4 }}>RabbitBot</span>
        </div>
        <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M1 1L17 17M17 1L1 17" stroke="#999" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "18px 18px 18px 4px",
          padding: "14px 18px",
          maxWidth: "84%",
          fontSize: 15,
          color: "var(--text-dark)",
          lineHeight: 1.5,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          Hi, Bruce. Let's get started by understanding what you want.
        </div>

        <div style={{
          backgroundColor: "#fff",
          borderRadius: "18px 18px 18px 4px",
          padding: "14px 18px",
          maxWidth: "84%",
          fontSize: 15,
          color: "var(--text-dark)",
          lineHeight: 1.5,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>What are you interested in?</p>
          <p style={{ fontSize: 13, color: "#AAA" }}>Select all that apply</p>
        </div>

        <div style={{
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}>
            {interests.map((label, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "1",
                  backgroundColor: "#F7F7F7",
                  border: "1px solid #EBEBEB",
                  borderRadius: 14,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  gap: 4,
                }}
              >
                <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#E5E5E5" }} />
                <span style={{ fontSize: 9, color: "#AAA", fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px 36px" }}>
        <button style={{
          width: "100%",
          backgroundColor: "var(--background-light)",
          color: "#888",
          fontSize: 16,
          fontWeight: 500,
          padding: "17px 0",
          borderRadius: 100,
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-family-base)",
        }}>
          Continue
        </button>
      </div>
    </div>
  );
}
