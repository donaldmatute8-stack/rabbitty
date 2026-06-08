import "./_group.css";

export function SignupEmail() {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        fontFamily: "var(--font-family-base)",
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "56px 28px 40px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M1 1L17 17M17 1L1 17" stroke="#999" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <h1 style={{
        fontSize: 34,
        fontWeight: 800,
        color: "var(--text-dark)",
        letterSpacing: "-0.5px",
        lineHeight: 1.2,
        marginBottom: 52,
      }}>
        What's your<br/>email address?
      </h1>

      <div style={{ flex: 1 }}>
        <input
          type="email"
          placeholder="Enter your email"
          style={{
            width: "100%",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: "1px solid #DCDCDC",
            padding: "12px 0",
            fontSize: 17,
            color: "var(--text-dark)",
            outline: "none",
            fontFamily: "var(--font-family-base)",
          }}
        />
      </div>

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
  );
}
