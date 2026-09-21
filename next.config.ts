import type { NextConfig } from "next";

/**
 * Baseline browser hardening for every response. No Content-Security-Policy yet: the design
 * system uses inline styles and the map loads third-party tiles, so a policy needs its own pass.
 */
const securityHeaders = [
  // The app is never framed; blocks clickjacking of the sign-in and commissioner screens.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Private URLs (proof, review) must not leak to tile or avatar hosts in the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is the participant's check-in; nothing else on the page needs a sensor.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  images: {
    // Sleeper manager avatars (public CDN) for the team chip and picker.
    remotePatterns: [{ protocol: "https", hostname: "sleepercdn.com" }],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
