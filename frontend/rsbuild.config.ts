import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    exclude: [
      /\.spec\.(tsx?|jsx?)$/,
      /\.test\.(tsx?|jsx?)$/,
      /__tests__/,
      /\.stories\.(tsx?|jsx?)$/,
    ],
    alias: {
      '@': './src',
    },
  },
  html: {
    meta: {
      viewport: "initial-scale=1, width=device-width",
    },
  },
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
