import type { NextConfig } from "next";
const nextConfig: NextConfig = { transpilePackages: ["@adash/site-core", "@adash/site-config", "@adash/site-auth"] };
export default nextConfig;
