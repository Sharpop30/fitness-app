// Unit tests for I03 invite_channel, against its contract (module map v9, section 4).
// Sources: usecase-04 step 3, alternative c; stage 5 plan, decisions 8, 11, execution decision 3.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { inviteChannel, type Sender } from "../interfaces/invite_channel.ts";
import type { Actor } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const coach: Actor = { role: "coach", coachID: U(1), traineeID: null };
const invite = { name: "דנה", email: "dana@example.com", link: "https://site.test/fitness-app/?join=abc" };
const send = (sender: Sender, payload: Record<string, unknown> = invite) =>
  handle({ caller: "M01", module: "invite_channel", action: "send_invite", payload }, coach, fakeRepo().repo, { invite_channel: inviteChannel(sender) });

Deno.test("UC4 step 3: the service gets the name, the address and the link, and a confirmed send answers null", async () => {
  const seen: unknown[] = [];
  assertEquals(await send((i) => (seen.push(i), Promise.resolve(true))), ok(null));
  assertEquals(seen, [invite]);
});

Deno.test("UC4 c and execution decision 3: a send not confirmed (an address already known), or a failing service, is INVITE_DELIVERY_FAILED", async () => {
  assertEquals(await send(() => Promise.resolve(false)), fail("INVITE_DELIVERY_FAILED"));
  assertEquals(await send(() => Promise.reject(new Error("timeout"))), fail("INVITE_DELIVERY_FAILED"));
});

Deno.test("UC4 b: no name, a bad address, or no link reaches no service", async () => {
  const seen: unknown[] = [];
  const sender: Sender = (i) => (seen.push(i), Promise.resolve(true));
  for (const bad of [{ name: " " }, { email: "dana@" }, { email: undefined }, { link: undefined }]) {
    assertEquals(await send(sender, { ...invite, ...bad }), fail("INVITE_INVALID"));
  }
  assertEquals(seen, []);
});

Deno.test("Registry: only trainees may send; a screen is refused before the channel", async () => {
  const seen: unknown[] = [];
  const rows = fakeRepo({ isRegistered: async (caller, module) => caller === "M01" && module === "invite_channel" }).repo;
  const ask = (caller: string) => handle({ caller, module: "invite_channel", action: "send_invite", payload: invite }, coach, rows,
    { invite_channel: inviteChannel((i) => (seen.push(i), Promise.resolve(true))) });
  assertEquals(await ask("S02"), fail("ACTION_NOT_ALLOWED"));
  assertEquals(await ask("M01"), ok(null));
  assertEquals(seen.length, 1);
});
