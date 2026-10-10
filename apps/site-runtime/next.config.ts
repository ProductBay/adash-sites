import type { NextConfig } from "next";
const nextConfig: NextConfig = { transpilePackages: ["@adash/site-core", "@adash/site-config", "@adash/site-templates", "@adash/site-themes", "@adash/site-components"] };
export default nextConfig;
