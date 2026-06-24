import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/config/branding";

export const metadata: Metadata = {
  title: `${BRAND.name} Admin`,
  description: `Super admin panel for ${BRAND.name}`,
  applicationName: BRAND.name,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
