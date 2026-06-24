import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { BRAND } from "@/config/branding";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: BRAND.meta.metaTitle,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.meta.metaDescription,
  keywords: [...BRAND.meta.keywords],
  applicationName: BRAND.name,
  appleWebApp: {
    title: BRAND.shortName,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
