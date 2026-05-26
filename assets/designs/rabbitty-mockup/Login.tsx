import "./_group.css";

export function Login() {
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
      <div style={{ marginBottom: 28 }}>
        <button style={{ padding: 4, background: "none", border: "none", cursor: "pointer" }}>
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <h1 style={{
        fontSize: 36,
        fontWeight: 800,
        color: "var(--text-dark)",
        letterSpacing: "-0.5px",
        lineHeight: 1.15,
        marginBottom: 52,
      }}>
        Welcome back
      </h1>

      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 32 }}>
          <input
            type="email"
            placeholder="Email address"
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
        <div>
          <input
            type="password"
            placeholder="Password"
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
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <button style={{
          width: "100%",
          backgroundColor: "var(--background-light)",
          color: "#555",
          fontSize: 16,
          fontWeight: 500,
          padding: "17px 0",
          borderRadius: 100,
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-family-base)",
        }}>
          Login
        </button>
        <button style={{
          background: "none",
          border: "none",
          color: "var(--primary-color)",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "var(--font-family-base)",
        }}>
          Forgot password?
        </button>
      </div>
    </div>
  );
}
