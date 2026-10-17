import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/lego-art-remix/" : "/",
  plugins: [react()],
  publicDir: path.resolve(root, "public"),
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: "node",
  },
});
