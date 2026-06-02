import path from "node:path";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/lib": path.join(root, "backend/lib"),
      "@/frontend": path.join(root, "frontend"),
      "@": root,
    },
  },
  test: {
    root,
    include: ["app/**/*.test.ts", "backend/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
