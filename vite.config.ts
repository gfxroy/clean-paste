/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves the build from /clean-paste/ (set via VITE_BASE in build:pages).
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  build: { target: "es2022" },
  test: { environment: "node", globals: true, include: ["src/**/*.test.ts"] },
});
