import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: the site is served from https://sharpop30.github.io/fitness-app/ (GitHub Pages, stage 7).
export default defineConfig({
  plugins: [react()],
  base: "/fitness-app/",
  test: { environment: "jsdom", globals: true },
});
