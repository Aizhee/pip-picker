/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure Turbopack knows the correct workspace root so it can resolve `next`.
  // This helps when Next infers an incorrect root in unusual workspace setups.
  experimental: {
    turbopack: true,
  },
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
