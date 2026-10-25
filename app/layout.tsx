import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Venice — Foot-traffic growth agent for bakeries",
  description: "Analyze foot traffic & sales, then auto-generate posters, a Google Business profile, a website, and TikTok videos to fill your empty hours.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
