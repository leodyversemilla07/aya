/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@workspace/ui'],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
