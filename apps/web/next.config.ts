import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mango/shared"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    return [
      { source: "/login", destination: "/auth/login", permanent: false },
      { source: "/register", destination: "/auth/signup", permanent: false },
      { source: "/forgot-password", destination: "/auth/forgot-password", permanent: false },
      { source: "/reset-password", destination: "/auth/reset-password", permanent: false },
      { source: "/knowledge-base", destination: "/knowledge", permanent: false },
      { source: "/torio-brain", destination: "/settings/brain", permanent: false },
      { source: "/products", destination: "/dashboard", permanent: false },
      { source: "/orders", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
