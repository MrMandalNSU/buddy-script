import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
if (!URL.canParse(backendUrl)) throw new Error("BACKEND_URL must be an absolute URL");
const scriptPolicy = process.env.NODE_ENV === "development" ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: { formats: ["image/avif", "image/webp"], remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" }] },
  async rewrites() { return [{ source: "/api/v1/:path*", destination: `${backendUrl.replace(/\/$/, "")}/api/v1/:path*` }]; },
  async headers() { return [{ source: "/(.*)", headers: [
    { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' blob: data: https://res.cloudinary.com; connect-src 'self' https://api.cloudinary.com; ${scriptPolicy}; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "X-Content-Type-Options", value: "nosniff" },
  ] }]; },
};

export default nextConfig;
