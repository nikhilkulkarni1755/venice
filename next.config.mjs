/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow the cloudflare tunnel host to talk to the dev server.
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};
export default nextConfig;
