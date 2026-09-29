// I03 Invite Channel: sends an invite by email (module map sections 3, 9). Version one uses the invite service of
// Supabase Auth, whose email opens the invite link; another mail provider replaces only this file.
// Requirement 19 (usecase-04 step 3, alternative c; stage 5 plan, decisions 8, 11).
// Acceptance (UC4 section 13): a sent invite reaches the trainee's mailbox with the link; a channel that did not
// confirm, including an email the identity service already knows, is INVITE_DELIVERY_FAILED, and the invite stays open.
import { fail, ok } from "../errors.ts";
import type { ModuleDef } from "../orchestrator.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANSWER_MS = 10_000; // how long to wait for the service

// Sends one invite; true when the service confirmed it.
export type Sender = (invite: { name: string; email: string; link: string }) => Promise<boolean>;

// The invite service of Supabase Auth. It needs the service key (CLAUDE.md v6, section 3: the Repository and I03), and
// creates no database client (rule 5). The email's button returns to the invite link, signed in.
export const supabaseInviteSender: Sender = async ({ name, email, link }) => {
  const url = `${Deno.env.get("SUPABASE_URL")}/auth/v1/invite?redirect_to=${encodeURIComponent(link)}`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, data: { fullName: name } }),
    signal: AbortSignal.timeout(ANSWER_MS),
  });
  await res.body?.cancel();
  return res.ok;
};

export function inviteChannel(send: Sender = supabaseInviteSender): ModuleDef {
  return {
    id: "I03",
    actions: {
      async send_invite(_ctx, payload) {
        const { name, email, link } = payload;
        if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !EMAIL.test(email) || typeof link !== "string") {
          return fail("INVITE_INVALID");
        }
        try {
          return (await send({ name: name.trim(), email, link })) ? ok(null) : fail("INVITE_DELIVERY_FAILED");
        } catch {
          return fail("INVITE_DELIVERY_FAILED"); // no answer, or no connection
        }
      },
    },
  };
}

export const invite_channel = inviteChannel();
