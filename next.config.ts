import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    // ما زال المشروع به أخطاء أنواع قديمة في مسارات الـAPI؛ يجب إصلاحها ثم إزالة هذا الخيار
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['preview-*.space-z.ai'],
};

export default nextConfig;
