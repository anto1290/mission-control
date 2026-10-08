/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Reduce build memory usage
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-*'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
        },
      };
    }
    return config;
  },
  // Environment variables exposed to client
  env: {
    HERMES_DASHBOARD_URL: process.env.HERMES_DASHBOARD_URL || 'http://localhost:9119',
  },
};

module.exports = nextConfig;