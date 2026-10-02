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
};

module.exports = nextConfig;