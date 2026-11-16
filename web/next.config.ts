import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Domain tunnel sementara untuk demo klien (lihat README bagian menjalankan).
  allowedDevOrigins: ["dream-online-bent-thereafter.trycloudflare.com"],
};

export default nextConfig;
