// S23 restores a kept sign-in once, also under React StrictMode (found closing stage 4e, in the cloud: two restores at
// once raced, and the one that failed signed the other out). Synthetic values, no network.
import { StrictMode } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { restoreSession } from "../identity/auth";
import { NavContext, type Nav } from "../nav";
import S23 from "./S23SignIn";

vi.mock("../identity/auth", () => ({
  identityConfigured: vi.fn(() => true), restoreSession: vi.fn(async () => "wrong"),
  signInWithPassword: vi.fn(), signOutIdentity: vi.fn(), accessToken: vi.fn(() => null),
}));

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
