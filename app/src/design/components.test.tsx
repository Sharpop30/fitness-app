// D01, version 2 (design stage, task 1): the shared components behave as prototype version 2 shows them.
// Synthetic data only.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NavContext, type Nav } from "../nav";
import {
  Button, Check, Empty, ErrorState, Field, Load, Screen, Signed, StatusToggle, Tile,
  fmtDateYear, fmtDay, fmtNum, greeting, initTheme, initials,
} from "./components";

const nav = (over: Partial<Nav> = {}): Nav => ({
  role: "coach", tab: "S01", depth: 2, go: () => {}, replace: () => {}, back: () => {}, setTab: () => {}, signIn: () => {}, signOut: () => {}, toast: () => {}, ...over,
});

afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; localStorage.clear(); });

test("rule 11: no screen defines its own style, color or font", () => {
  const dir = join(__dirname, "../screens");
  const files = [...readdirSync(dir).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx")).map((f) => join(dir, f)), join(__dirname, "../App.tsx")];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    expect([f, /style=\{/.test(src)]).toEqual([f, false]);
    expect([f, /#[0-9a-fA-F]{3,8}\b/.test(src)]).toEqual([f, false]);
    expect([f, /font-?family/i.test(src)]).toEqual([f, false]);
  }
});

test("finding 7: Hebrew in the mono stack falls back to Heebo", () => {
  const css = readFileSync(join(__dirname, "tokens.css"), "utf8");
  expect(css).toMatch(/--mono:\s*"Geist Mono",\s*Heebo/);
});

test("finding 38: back points right and says so; the tab bar has icons and marks the current tab", () => {
  render(<NavContext.Provider value={nav()}><Screen eyebrow="א" title="כותרת">x</Screen></NavContext.Provider>);
  const back = screen.getByRole("button", { name: "חזרה" });
  expect(back.querySelector("path")?.getAttribute("d")).toBe("M7.5 4l6 6-6 6");
  const tabs = screen.getByRole("navigation", { name: "ניווט ראשי" });
  expect(tabs.querySelectorAll("svg").length).toBe(4);
  expect(screen.getByRole("button", { name: "בית" }).getAttribute("aria-current")).toBe("page");
});

test("finding 27: the theme button names the mode it moves to, and the choice is kept", () => {
  render(<NavContext.Provider value={nav()}><Screen eyebrow="א" title="כותרת">x</Screen></NavContext.Provider>);
  fireEvent.click(screen.getByRole("button", { name: "מצב כהה" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("fitness-theme")).toBe("dark");
  expect(screen.getByRole("button", { name: "מצב בהיר" })).toBeTruthy();
  delete document.documentElement.dataset.theme;
  initTheme();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("finding 16: a button with a pending action says it is sending and cannot be pressed twice", async () => {
  let finish!: () => void;
  const onClick = vi.fn(() => new Promise<void>((r) => { finish = r; }));
  render(<Button onClick={onClick}>שמירה</Button>);
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
  const busy = await screen.findByRole("button", { name: "שולח..." });
  expect((busy as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(busy);
  expect(onClick).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "שמירה" })).toBeTruthy();
});

test("finding 18: a label names its field, with the field's own id or a made one; ✓ has a name and a pressed state", () => {
  render(<>
    <Field label="מייל"><input id="email" type="email" /></Field>
    <Field label="שם"><input /></Field>
    <Check on label="סקוואט, סט 2 בוצע" onClick={() => {}} />
    <StatusToggle on={false} name="נועה (דוגמה)" onClick={() => {}} />
  </>);
  expect(screen.getByLabelText("מייל").id).toBe("email");
  expect(screen.getByLabelText("שם").tagName).toBe("INPUT");
  expect(screen.getByRole("button", { name: "סקוואט, סט 2 בוצע" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "נועה (דוגמה): לא סומן/ה" }).getAttribute("aria-pressed")).toBe("false");
});

test("findings 2 and 6: loading, then an error with a retry, and content only when it arrived", () => {
  const reload = vi.fn();
  const { rerender } = render(<Load state={{ data: null, error: null, loading: true, reload }}>{() => "תוכן"}</Load>);
  expect(screen.getByRole("status").textContent).toBe("טוען...");
  rerender(<Load state={{ data: null, error: { code: "STORAGE_UNAVAILABLE", message: "" }, loading: false, reload }}>{() => "תוכן"}</Load>);
  expect(screen.getByRole("alert").textContent).toContain("אין חיבור כרגע");
  expect(screen.queryByText("תוכן")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "לנסות שוב" }));
  expect(reload).toHaveBeenCalled();
  rerender(<Load state={{ data: [] as string[], error: null, loading: false, reload }}>{(d) => (d.length ? "תוכן" : <Empty title="עוד אין אימונים" />)}</Load>);
  expect(screen.getByText("עוד אין אימונים")).toBeTruthy();
});

test("an error that is not the connection shows its own text", () => {
  render(<ErrorState error={{ code: "NOT_ALLOWED", message: "אין לך גישה לזה" }} onRetry={() => {}} />);
  expect(screen.getByRole("alert").textContent).toContain("אין לך גישה לזה");
});

test("findings 8, 31, 32: signed numbers left to right, thousands, the year, the weekday, and the greeting by the hour", () => {
  render(<><Signed n={10} /><Tile label="מטבעות" value={fmtNum(125000)} /></>);
  const plus = screen.getByText("+10");
  expect(plus.className).toContain("ltr");
  expect(screen.getByText("125,000")).toBeTruthy();
  expect(fmtDateYear(new Date(2026, 8, 8))).toBe("8.9.2026");
  expect(fmtDay(new Date(2026, 8, 30))).toBe("יום ד׳, 30.9");
  expect(greeting(new Date(2026, 8, 30, 8))).toBe("בוקר טוב");
  expect(greeting(new Date(2026, 8, 30, 14))).toBe("צהריים טובים");
  expect(greeting(new Date(2026, 8, 30, 19))).toBe("ערב טוב");
  expect(greeting(new Date(2026, 8, 30, 23))).toBe("לילה טוב");
  expect(initials("נועה (דוגמה)")).toBe("נ");
});
