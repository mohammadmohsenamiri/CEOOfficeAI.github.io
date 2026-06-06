import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEO Office AI Coordinator",
  description: "RTL CEO office task, meeting and messenger coordinator"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
