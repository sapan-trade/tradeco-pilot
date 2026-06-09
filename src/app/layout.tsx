import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Clearwise — Tariff codes you can defend",
  description:
    "Broker-verified HS tariff classification for importers and exporters. AI-fast, human-checked, audit-defensible — so your codes hold up at the border.",
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
