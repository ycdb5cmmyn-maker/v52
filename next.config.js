/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  api: {
    responseLimit: '50mb',
  },
};

module.exports = nextConfig;
