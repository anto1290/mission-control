/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API proxy to local server (Ruang port 3001)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
  // Environment variables exposed to client
  env: {
    HERMES_DASHBOARD_URL: process.env.HERMES_DASHBOARD_URL || 'http://localhost:9119',
  },
};

module.exports = nextConfig;