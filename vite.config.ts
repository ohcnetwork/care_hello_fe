import { defineConfig } from "vite";
import federation from "@originjs/vite-plugin-federation";
import path from "path";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    federation({
      name: "care_hello_fe", // must equal the plugin slug
      filename: "remoteEntry.js",
      exposes: {
        "./manifest": "./src/manifest.tsx",
      },
      // Share every host singleton the plugin consumes, or React/router/query context
      // breaks at runtime with "Should have a queue" hook-order errors.
      shared: ["react", "react-dom", "react-i18next", "@tanstack/react-query", "raviger"],
    }),
    tailwindcss(),
    react(),
  ],
  build: {
    target: "es2022",
    minify: true,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      external: [],
      input: { main: "./index.html" },
      output: { format: "esm" },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  preview: {
    port: 4173,
    allowedHosts: true,
    host: "0.0.0.0",
    cors: true,
  },
});
