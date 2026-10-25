import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "TechScribe", template: "%s | TechScribe" },
  description: "Long-form technical articles for software engineers.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;

  let themeClass = "";
  if (themeCookie === "dark") themeClass = "dark";
  else if (themeCookie === "light") themeClass = "light";
  // "system" or unset: no class, CSS media query handles it

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${themeClass ? ` ${themeClass}` : ""}`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
