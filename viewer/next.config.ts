import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable streaming metadata for all bots
  // This ensures OG tags are in initial HTML for WhatsApp, Telegram, etc.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
