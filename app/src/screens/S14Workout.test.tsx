// S14, code review in stage 7c, finding 1: opening the demo video of an exercise and coming back keeps the results typed
// so far, and saving sends them. On demo data, synthetic only.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { setAdapter, setSession, type Adapter } from "../api/client";
import { demoAdapter } from "../demo/adapter";
import { NavContext, type Nav } from "../nav";
import S14Workout from "./S14Workout";

vi.mock("../identity/auth", async (original) => ({ ...(await original<object>()), accessToken: vi.fn(() => null), identityConfigured: vi.fn(() => false) }));

const NOA = "d0000000-0000-4000-8000-000000001001";
const WORKOUT_A = "d0000000-0000-4000-8000-000000004001"; // squat 3x8 at 60, bench, pushups
const go = vi.fn();
const nav: Nav = {
  role: "trainee", roles: ["trainee"], tab: null, depth: 2, go, replace: () => {}, back: () => {}, setTab: () => {},
  signIn: () => {}, switchRole: () => {}, signOut: () => {}, toast: () => {},
};

afterEach(() => { cleanup(); setAdapter(demoAdapter); go.mockReset(); });

test("the video opens over the workout, and the way back keeps the typed results", async () => {
  const sent: any[] = [];
  setAdapter(((e, s) => { if (e.action === "log_workout") sent.push(e.payload); return demoAdapter(e, s); }) as Adapter);
  setSession({ role: "trainee", traineeID: NOA });
  render(<NavContext.Provider value={nav}><S14Workout workoutID={WORKOUT_A} /></NavContext.Provider>);

  const reps = await screen.findByLabelText("סקוואט, סט 1, חזרות");
  fireEvent.change(reps, { target: { value: "5" } });
  fireEvent.click(screen.getAllByRole("button", { name: "סרטון הדגמה" })[0]);
  expect(await screen.findByText("סרטון הדגמה")).toBeTruthy(); // the video view, in the same screen
  expect(go).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("חזרה"));
  expect(((await screen.findByLabelText("סקוואט, סט 1, חזרות")) as HTMLInputElement).value).toBe("5");
  fireEvent.click(screen.getByText("שמירת האימון"));
  await vi.waitFor(() => expect(sent.length).toBe(1));
  expect(sent[0].sets.find((s: any) => s.ExerciseID.endsWith("2001") && s.setNumber === 1).reps).toBe(5);
});

// Stage 5b, task 2: the new look of S14 (prototype 4) shows the sets done and still to do, and sends what it sent before.
test("stage 5b: \"X מתוך Y סטים\" counts the sets done, a set not done is marked to do, and the saved sets are unchanged", async () => {
  const sent: any[] = [];
  setAdapter(((e, s) => { if (e.action === "log_workout") sent.push(e.payload); return demoAdapter(e, s); }) as Adapter);
  setSession({ role: "trainee", traineeID: NOA });
  const replace = vi.fn();
  render(<NavContext.Provider value={{ ...nav, replace }}><S14Workout workoutID={WORKOUT_A} /></NavContext.Provider>);

  expect(await screen.findByText("9 מתוך 9 סטים")).toBeTruthy(); // prefilled from the target: every set done
  const check = screen.getByRole("button", { name: "לחיצת חזה, סט 3 בוצע" });
  fireEvent.click(check);
  expect(screen.getByText("8 מתוך 9 סטים")).toBeTruthy();
  expect(check.getAttribute("aria-pressed")).toBe("false");
  expect(check.closest(".setrow")?.className).toContain("todo");
  expect(screen.getByRole("button", { name: "לחיצת חזה, סט 2 בוצע" }).closest(".setrow")?.className).toContain("done");

  fireEvent.click(screen.getByText("שמירת האימון"));
  await vi.waitFor(() => expect(sent.length).toBe(1));
  // The same payload as before the refresh: the workout and nine sets, one marked not done.
  expect(Object.keys(sent[0]).sort()).toEqual(["sets", "workoutID"]);
  expect(sent[0].workoutID).toBe(WORKOUT_A);
  expect(sent[0].sets.length).toBe(9);
  expect(Object.keys(sent[0].sets[0]).sort()).toEqual(["ExerciseID", "isCorrected", "isDone", "reps", "setNumber", "weight"]);
  expect(sent[0].sets.filter((s: any) => !s.isDone).length).toBe(1);
});
