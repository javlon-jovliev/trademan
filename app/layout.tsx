import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ERTA · Portfolio Risk",
  description: "Portfolio monitoring and risk management",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
