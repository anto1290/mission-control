/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API proxy to local server
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:9120/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;