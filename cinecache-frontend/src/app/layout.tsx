import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CineCache - Memorystore Movies Showcase",
  description: "A fast React + Next.js movie catalog app communicating securely with a private Cloud Run Go backend cached by Memorystore.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
