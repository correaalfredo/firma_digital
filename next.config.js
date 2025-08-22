/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [new URL('https://jjypyvrmebknhjdudbcl.supabase.co/storage/v1/object/public/**')],
  },
};

module.exports = nextConfig;
