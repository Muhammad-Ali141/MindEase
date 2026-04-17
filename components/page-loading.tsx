"use client"

const sans = { fontFamily: "var(--font-dm-sans, var(--font-inter), system-ui, sans-serif)" }
const serif = { fontFamily: "var(--font-cormorant, Georgia, serif)" }

interface PageLoadingProps {
  message?: string
}

export function PageLoading({ message }: PageLoadingProps) {
  return (
    <div style={{
      ...sans,
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      backgroundColor: "var(--background)",
      gap: "1.25rem",
      zIndex: 9999,
    }}>
      {/* Logo mark */}
      <img src="/logo.svg" alt="MindEase" style={{
        width: 52, height: 52, borderRadius: 14, objectFit: "contain",
        boxShadow: "0 4px 24px rgba(166,124,82,0.35)",
        animation: "me-pulse 2s ease-in-out infinite",
      }} />

      {/* Wordmark */}
      <span style={{ ...serif, fontSize: "1.25rem", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.01em", opacity: 0.9 }}>
        MindEase
      </span>

      {/* Subtle progress bar */}
      <div style={{
        width: 120, height: 2, borderRadius: 2,
        backgroundColor: "var(--border)",
        overflow: "hidden",
        marginTop: "0.25rem",
      }}>
        <div className="me-bar-snake" style={{
          height: "100%", width: "30%",
          backgroundColor: "var(--primary)",
          borderRadius: 2,
          opacity: 0.7,
        }} />
      </div>

      {message && (
        <p style={{ ...sans, fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
          {message}
        </p>
      )}

      <style>{`
        @keyframes me-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.82; transform: scale(0.96); }
        }
        .me-bar-snake {
          animation: me-bar-ltr 1.4s linear infinite;
        }
        html[lang="ur"] .me-bar-snake {
          animation: me-bar-rtl 1.4s linear infinite;
        }
        @keyframes me-bar-ltr {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(433%); }
        }
        @keyframes me-bar-rtl {
          0%   { transform: translateX(433%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
