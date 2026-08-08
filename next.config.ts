import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['preview-*.space-z.ai'],
  // توصية 13: HTTP Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            // أُزيل 'unsafe-eval' من script-src — إنتاج Next.js لا يحتاجه.
            // ملاحظة: 'unsafe-inline' للسكربتات ما زال مطلوباً لأن Next.js يحقن
            // سكربتات bootstrap مضمّنة؛ استبداله بـ nonce يتطلب middleware يولّد
            // nonce لكل طلب ويمرره للـ layout — يُرجى تنفيذه كخطوة لاحقة.
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none';",
          },
        ],
      },
    ]
  },
};

export default nextConfig;
