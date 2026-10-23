import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.SOLACE_BUILD_DIR ?? ".next",
  typedRoutes: true,
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
