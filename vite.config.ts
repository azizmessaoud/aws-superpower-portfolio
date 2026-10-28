import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { target: "es2020", sourcemap: false },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
