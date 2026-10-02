// S23 restores a kept sign-in once, also under React StrictMode (found closing stage 4e, in the cloud: two restores at
// once raced, and the one that failed signed the other out). Synthetic values, no network.
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { isRecoveryReturn, requestPasswordReset, restoreSession, setPassword, takeSessionFromAddress } from "../identity/auth";
import { NavContext, type Nav } from "../nav";
import S23 from "./S23SignIn";

vi.mock("../identity/auth", async (original) => {
  const real = await original<typeof import("../identity/auth")>();
  return {
    identityConfigured: vi.fn(() => true), restoreSession: vi.fn(async () => "wrong"),
    signInWithPassword: vi.fn(), signOutIdentity: vi.fn(), accessToken: vi.fn(() => null),
    // Stage 7 plan, task 14: the password reset.
    isRecoveryReturn: vi.fn(() => false), takeSessionFromAddress: vi.fn(() => true), setPassword: vi.fn(async () => "ok"),
    requestPasswordReset: vi.fn(async () => "ok"), PASSWORD_RULE: real.PASSWORD_RULE, passwordOK: real.passwordOK,
  };
});

const nav: Nav = {
  role: null, roles: [], tab: null, depth: 1, go: () => {}, replace: () => {}, back: () => {}, setTab: () => {},
  signIn: () => {}, switchRole: () => {}, signOut: () => {}, toast: () => {},
};

afterEach(cleanup);

test("a kept sign-in is restored once, under StrictMode too", async () => {
  render(<StrictMode><NavContext.Provider value={nav}><S23 /></NavContext.Provider></StrictMode>);
  await waitFor(() => expect(restoreSession).toHaveBeenCalled());
  expect(restoreSession).toHaveBeenCalledTimes(1);
});

// ---- Stage 7 plan, task 14 (design review, finding 24; prototype 3.2): the password reset ----
const toasts: string[] = [];
const navWith = { ...nav, toast: (t: string) => toasts.push(t), back: vi.fn(), go: vi.fn() };

test("S23 offers \"שכחתי סיסמה\", and the forgot screen asks for an email and says the same whatever the answer", async () => {
  render(<NavContext.Provider value={navWith}><S23 /></NavContext.Provider>);
  fireEvent.click(screen.getByRole("button", { name: "שכחתי סיסמה" }));
  expect(navWith.go).toHaveBeenCalledWith("S23", { forgot: true });
  cleanup();
  render(<NavContext.Provider value={navWith}><S23 forgot /></NavContext.Provider>);
  fireEvent.change(document.getElementById("forgotEmail")!, { target: { value: "not-an-email" } });
  fireEvent.click(screen.getByRole("button", { name: "שליחת קישור לסיסמה חדשה" }));
  await waitFor(() => expect(toasts.at(-1)).toBe("פרט הקשר לא תקין. כדאי לבדוק ולנסות שוב"));
  expect(requestPasswordReset).not.toHaveBeenCalled();
  fireEvent.change(document.getElementById("forgotEmail")!, { target: { value: "dana@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "שליחת קישור לסיסמה חדשה" }));
  await waitFor(() => expect(toasts.at(-1)).toBe("אם המייל רשום, נשלח אליו קישור"));
  expect(requestPasswordReset).toHaveBeenCalledWith("dana@example.com");
});

test("back from the reset link, S23 asks for a new password first, says the rule, and refuses a weak one before sending", async () => {
  vi.mocked(isRecoveryReturn).mockReturnValue(true);
  vi.mocked(restoreSession).mockClear();
  render(<NavContext.Provider value={navWith}><S23 /></NavContext.Provider>);
  expect(await screen.findByRole("heading", { level: 1, name: "סיסמה חדשה" })).toBeTruthy();
  expect(takeSessionFromAddress).toHaveBeenCalled();
  expect(restoreSession).not.toHaveBeenCalled();
  expect(screen.getByText("לפחות 8 תווים, עם אותיות באנגלית וספרות.")).toBeTruthy();
  fireEvent.change(document.getElementById("newPassword")!, { target: { value: "short1" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה וכניסה" }));
  await waitFor(() => expect(toasts.at(-1)).toBe("הסיסמה צריכה להיות לפחות 8 תווים, עם אותיות באנגלית וספרות."));
  expect(setPassword).not.toHaveBeenCalled();
  fireEvent.change(document.getElementById("newPassword")!, { target: { value: "abcd1234" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה וכניסה" }));
  await waitFor(() => expect(setPassword).toHaveBeenCalledWith("abcd1234"));
  vi.mocked(isRecoveryReturn).mockReturnValue(false);
});

// Stage 7c, found in the phone test: the identity service refuses a new password equal to the old one, and the screen
// said only "something went wrong". Prototype 3.4.
test("back from the reset link, a new password equal to the old one is refused with its own text", async () => {
  vi.mocked(isRecoveryReturn).mockReturnValue(true);
  vi.mocked(setPassword).mockResolvedValueOnce("same");
  render(<NavContext.Provider value={navWith}><S23 /></NavContext.Provider>);
  await screen.findByRole("heading", { level: 1, name: "סיסמה חדשה" });
  fireEvent.change(document.getElementById("newPassword")!, { target: { value: "abcd1234" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה וכניסה" }));
  await waitFor(() => expect(toasts.at(-1)).toBe("הסיסמה החדשה צריכה להיות שונה מהקודמת"));
  expect(screen.getByRole("heading", { level: 1, name: "סיסמה חדשה" })).toBeTruthy(); // still asking
  vi.mocked(isRecoveryReturn).mockReturnValue(false);
});
