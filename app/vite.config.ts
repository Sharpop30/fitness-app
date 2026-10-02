import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The Content Security Policy of the deployed site (security review 1, finding 7; stage 7 plan, task 11). GitHub Pages
// sends no headers of our own, so it is a meta tag. Only in a build that talks to the Endpoint: the development server
// injects inline scripts of its own, and the demo build of the presentation is one page with its code inline.
// script and style from the site; the fonts from Google Fonts; the Endpoint, the identity service and the video store
// on the Supabase project; uploaded videos from the store, and a chosen file's preview (blob:); the YouTube player.
function csp(env: Record<string, string>): Plugin {
  const origins = [env.VITE_API_URL, env.VITE_SUPABASE_URL].flatMap((u) => { try { return [new URL(u).origin]; } catch { return []; } });
  const supabase = [...new Set(origins)].join(" ");
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    `connect-src 'self' ${supabase}`,
    `img-src 'self' data: ${supabase}`,
    `media-src 'self' blob: ${supabase}`,
    "frame-src https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => (env.VITE_API_URL
      ? [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" }]
      : []),
  };
}

// base: the site is served from https://sharpop30.github.io/fitness-app/ (GitHub Pages, stage 7).
export default defineConfig(({ mode }) => ({
  plugins: [react(), csp(loadEnv(mode, process.cwd(), "VITE_"))],
  base: "/fitness-app/",
  test: { environment: "jsdom", globals: true },
}));
