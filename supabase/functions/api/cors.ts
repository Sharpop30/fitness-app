// C01, part of the Endpoint: who may read a reply in a browser (security review 1, finding 6; stage 7 plan, task 10).
// The site's own origin, the origin of SITE_URL, or a development server on this computer (localhost, 127.0.0.1). Any
// other origin gets no Allow-Origin, so the browser keeps the reply from it. The identity is a token in a header, not a
// cookie, so there is no CSRF either way; a request with no Origin (a server, the tests) is not a browser's.
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function originOf(siteUrl: string | undefined): string | null {
  try { return new URL(siteUrl ?? "").origin; } catch { return null; }
}

export function corsFor(origin: string | null, siteUrl: string | undefined): Record<string, string> {
  const allowed = origin !== null && (origin === originOf(siteUrl) || DEV_ORIGIN.test(origin));
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
