import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@workspace/ui": path.resolve(import.meta.dirname, "../../packages/ui/src"),
      "@workspace/database": path.resolve(import.meta.dirname, "../../packages/database/src"),
    },
  },
});
