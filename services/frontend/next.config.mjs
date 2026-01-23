/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `http://backend:3000/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
