import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sleeper manager avatars (public CDN) for the team chip and picker.
    remotePatterns: [{ protocol: "https", hostname: "sleepercdn.com" }],
  },
};

export default nextConfig;
