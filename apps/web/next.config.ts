import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mango/shared"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
