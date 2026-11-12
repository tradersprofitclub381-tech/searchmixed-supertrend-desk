import { fileURLToPath, URL } from "node:url";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

function flattenSiteHtml(): Plugin {
  return {
    name: "flatten-site-html",
    apply: "build",
    closeBundle() {
      const nested = here("./docs/site/index.html");
      const html = readFileSync(nested, "utf8").replaceAll("../assets/", "./assets/");
      writeFileSync(here("./docs/index.html"), html);
      rmSync(here("./docs/site"), { recursive: true, force: true });
    },
  };
}

/** Static site for GitHub Pages. Relative URLs so the desk opens from any folder. */
export default defineConfig({
  base: "./",
  publicDir: here("./site/public"),
  plugins: [react(), tailwindcss(), flattenSiteHtml()],
  resolve: {
    alias: {
      "@": here("./src"),
    },
  },
  build: {
    outDir: here("./docs"),
    emptyOutDir: true,
    assetsDir: "assets",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: here("./site/index.html"),
      external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
    },
  },
});
