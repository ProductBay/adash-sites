import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: ["@adash/site-core", "@adash/site-config", "@adash/site-auth"],
  experimental: {
    // The application enforces the real 8 MB image limit after multipart parsing.
    // Leave a little room for the multipart envelope so valid 8 MB files reach it.
    serverActions: { bodySizeLimit: "9mb" }
  }
};
export default nextConfig;
