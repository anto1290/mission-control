/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Environment variables exposed to client
  env: {
    HERMES_DASHBOARD_URL: process.env.HERMES_DASHBOARD_URL || 'http://localhost:9119',
  },
};

module.exports = nextConfig;