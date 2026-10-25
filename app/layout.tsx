import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import { isExplicitTheme } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Nystara", template: "%s · Nystara" },
  description: "Nystara is a blog for long-form writing that lasts. Read deep dives, publish your own stories and build an audience.",
  applicationName: "Nystara",
  icons: {
    icon: [
      { url: "/brand/favicon/light/favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon/dark/favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Nystara", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app draw under the iPhone home indicator; the bottom navigation pads itself with the safe-area inset.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeCookie = (await cookies()).get("theme")?.value;
  // "system" or unset: no attribute, CSS media queries follow the OS.
  const theme = isExplicitTheme(themeCookie) ? themeCookie : undefined;

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
