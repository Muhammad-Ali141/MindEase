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
        <div style={{
          height: "100%",
          backgroundColor: "var(--primary)",
          borderRadius: 2,
          animation: "me-bar 1.4s ease-in-out infinite",
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
        @keyframes me-bar {
          0% { width: 0%; margin-left: 0; }
          50% { width: 75%; margin-left: 0; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}
