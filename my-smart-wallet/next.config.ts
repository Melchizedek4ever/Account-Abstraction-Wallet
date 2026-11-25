import type { NextConfig } from "next";

// No third-party scripts, no framing: this page asks users to sign transactions.
const dev = process.env.NODE_ENV === "development";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  `connect-src 'self' https://api.testnet.hiro.so${dev ? " ws:" : ""}`,
  "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  headers: async () => [{
    source: "/:path*",
    headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ],
  }],
};

export default nextConfig;
