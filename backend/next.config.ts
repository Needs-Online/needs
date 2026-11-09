import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "ioredis", "bullmq", "pino", "pino-pretty", "bcryptjs"],
  experimental: {},
  // Disable react strict mode double renders for purely backend API if preferred, or leave true
  reactStrictMode: true,
};

export default nextConfig;
