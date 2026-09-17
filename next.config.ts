import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sleeper manager avatars (public CDN) for the team chip, picker and losers bracket.
    remotePatterns: [{ protocol: "https", hostname: "sleepercdn.com" }],
  },
};

export default nextConfig;
