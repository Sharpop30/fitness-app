// I01 Identity Connector, browser side (CLAUDE.md section 5). Stage 3 builds email and password sign-in only
// (stage 3 plan, decision 5); joining by invite and the other identity flows come in stage 5.
// It talks to the identity service alone, never to the database. The token is kept in memory only.
let token: string | null = null;

const env = () => ({ url: import.meta.env.VITE_SUPABASE_URL as string | undefined, key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined });

export const identityConfigured = () => !!(env().url && env().key);

export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const { url, key } = env();
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    token = res.ok && typeof body?.access_token === "string" ? body.access_token : null;
  } catch {
    token = null;
  }
  return token !== null;
}

export const accessToken = () => token;

export function signOutIdentity() {
  token = null;
}
