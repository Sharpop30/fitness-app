// S22, after stage 5b (as the reset link in S23): an invite email whose link no longer works returns with an error after
// the # and no sign-in. It shows the expired invite's message, and not the sign-up form. Synthetic values, no network.
import { cleanup, render, screen } from "@testing-library/react";
import { setAdapter, type Adapter } from "../api/client";
import { demoAdapter } from "../demo/adapter";
import { errorTexts } from "../demo/data";
import { takeLinkError, takeSessionFromAddress } from "../identity/auth";
import { NavContext, type Nav } from "../nav";
import S22 from "./S22JoinInvite";

vi.mock("../identity/auth", async (original) => {
  const real = await original<typeof import("../identity/auth")>();
  return {
    ...real, identityConfigured: vi.fn(() => true), accessToken: vi.fn(() => null),
    takeLinkError: vi.fn(() => null), takeSessionFromAddress: vi.fn(() => false),
  };
});

const nav: Nav = {
  role: null, roles: [], tab: null, depth: 2, go: () => {}, replace: () => {}, back: () => {}, setTab: () => {},
  signIn: () => {}, switchRole: () => {}, signOut: () => {}, toast: () => {},
};
const asked: string[] = [];
const fake: Adapter = async (e) => {
  asked.push(`${e.module}.${e.action}`);
  if (e.action === "get_error_texts") return { ok: true, data: errorTexts, error: null };
  if (e.action === "check_invite") return { ok: true, data: { fullName: "רון (דוגמה)" }, error: null };
  return { ok: false, data: null, error: { code: "UNEXPECTED_ERROR", message: "" } };
};

beforeEach(() => { vi.stubEnv("VITE_API_URL", ""); setAdapter(fake); asked.length = 0; });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); setAdapter(demoAdapter); });

test("an invite email link that no longer works shows the expired invite's message, with no form and no sign-in", async () => {
  vi.mocked(takeLinkError).mockReturnValueOnce("otp_expired");
  vi.mocked(takeSessionFromAddress).mockClear();
  render(<NavContext.Provider value={nav}><S22 inviteToken="t" /></NavContext.Provider>);
  expect(await screen.findByText("ההזמנה כבר לא בתוקף. אפשר לבקש הזמנה חדשה")).toBeTruthy();
  expect(document.getElementById("joinPassword")).toBeNull();
  expect(screen.queryByRole("button", { name: "הצטרפות" })).toBeNull();
  expect(takeSessionFromAddress).not.toHaveBeenCalled();
  expect(asked).not.toContain("trainees.check_invite");
});

test("a working invite link still opens the form", async () => {
  render(<NavContext.Provider value={nav}><S22 inviteToken="t" /></NavContext.Provider>);
  expect(await screen.findByRole("button", { name: "הצטרפות" })).toBeTruthy();
  expect(asked).toContain("trainees.check_invite");
});
