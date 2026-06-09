import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #0f766e 0%, #0b3b37 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
              <path d="M8 11.5h16" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
              <path d="M9.5 17.5l4 4 9-9.5" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{BRAND.name}</div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>
            {BRAND.tagline}
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.82)", maxWidth: 900 }}>
            Broker-verified HS tariff classification — AI-fast, human-checked, audit-defensible.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 28, fontSize: 24, color: "rgba(255,255,255,0.85)" }}>
          <div style={{ display: "flex" }}>HS codes in seconds</div>
          <div style={{ display: "flex" }}>·</div>
          <div style={{ display: "flex" }}>Licensed-broker review</div>
          <div style={{ display: "flex" }}>·</div>
          <div style={{ display: "flex" }}>Tariff-change alerts</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
