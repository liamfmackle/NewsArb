import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@newsarb/shared"],
  output: "standalone",
  webpack: (config, { isServer }) => {
    // Handle node modules that shouldn't be bundled
    config.externals.push("pino-pretty", "encoding");

    // Handle react-native modules from MetaMask SDK
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    return config;
  },
};

export default nextConfig;
