import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build for Docker deployment: copies just the deps the app
  // actually uses into .next/standalone, no node_modules in the image needed.
  output: "standalone",

  // Allow the VPS subdomain (and any custom domain you wire up later) to
  // request from this server during dev. Adjust as needed in production.
  allowedDevOrigins: [
    "agentic-os-*.srv1344233.hstgr.cloud",
    "*.srv1344233.hstgr.cloud",
  ],
};

export default nextConfig;
