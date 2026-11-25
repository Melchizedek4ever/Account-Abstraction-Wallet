import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Wallet",
  description: "A smart contract wallet on Stacks with spending limits and recovery",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
