import { defineConfig, lazyPlugins } from "vite-plus";
import { localGhApiPlugin } from "./src/server/local-gh-api-plugin.ts";

export default defineConfig({
  plugins: lazyPlugins(async () => {
    const [{ default: react }, { vanillaExtractPlugin }] = await Promise.all([
      import("@vitejs/plugin-react"),
      import("@vanilla-extract/vite-plugin"),
    ]);

    return [react(), vanillaExtractPlugin(), localGhApiPlugin()];
  }),
  server: {
    host: true,
    port: 5174,
    strictPort: true,
  },
  preview: {
    host: true,
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
