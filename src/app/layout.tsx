import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "TradeCo-Pilot — AI customs classifier for SMBs",
  description:
    "Classify any product to a 10-digit HS code in 60 seconds. Confidence-scored, reasoning shown, audit-defensible. Built for SMB importers and exporters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
