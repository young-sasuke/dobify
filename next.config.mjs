/** @type {import('next').NextConfig} */
const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'production'

const nextConfig = {
  eslint: { ignoreDuringBuilds: !isCI },
  typescript: { ignoreBuildErrors: !isCI },

  images: { unoptimized: true }, // aap <img> use kar rahe ho, ye OK hai
  trailingSlash: true,
  basePath: '',
}

export default nextConfig
