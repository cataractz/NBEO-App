import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this project from https://<user>.github.io/NBEO-App/,
// so built asset URLs need that subpath. Local dev stays at "/".
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/NBEO-App/" : "/",
  plugins: [react()],
});
