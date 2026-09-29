// Structural tests for stage 2 (stage 2 plan, task 8; CLAUDE.md rules 1, 11; module map section 4).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEMO_ACTIONS } from "../demo/adapter";

const root = join(__dirname, "..");
const screenFiles = readdirSync(join(root, "screens")).filter((f) => /^S\d\d.*\.tsx$/.test(f) && !f.includes(".test."));
const read = (f: string) => readFileSync(join(root, "screens", f), "utf8");

// The screen-actions table of doc-module-map section 4 (version 3), parsed from the approved document itself.
const map = readFileSync(join(root, "..", "..", "project-docs", "doc-module-map.md"), "utf8");
const table = map.slice(map.indexOf("### טבלת פעולות המסכים"), map.indexOf("### קודי השגיאה"));
const allowed: Record<string, Set<string>> = {};
for (const line of table.split("\n")) {
  const m = line.match(/^\| (S\d\d) \| (.+) \|$/);
  if (!m || m[2].startsWith("(")) continue;
  // A note in parentheses after an action, like S06's "(noteMaxLength)" in map v8, is not an action.
  // Map v9 and v10: S23 lists its actions joined by "ו-", and S22 a note after a comma.
  m[2] = m[2].replace(/^שירות הזהות; /, "").replace(/, (פעם אחת|לפני).*$/, "").replace(/ ו-/g, ", ").replace(/\s*\([^)]*\)/g, "");
  let mod = "";
  allowed[m[1]] = new Set(m[2].split(/[;,]\s*/).map((p) => { p = p.trim(); if (p.includes(".")) { const [a, b] = p.split("."); mod = a; return `${a}.${b}`; } return `${mod}.${p}`; }));
}


const usedBy = (f: string) =>
  [...read(f).matchAll(/(?:call|useCall)\(\s*"(S\d\d)",\s*"(\w+)",\s*"(\w+)"/g)].map((m) => ({ caller: m[1], action: `${m[2]}.${m[3]}` }));

test("there are 23 screen files, S01 to S23", () => {
  expect(screenFiles.map((f) => f.slice(0, 3)).sort()).toEqual(Array.from({ length: 23 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`));
});

test.each(screenFiles)("%s declares itself as the caller and uses only its own actions", (f: string) => {
  const id = f.slice(0, 3);
  for (const u of usedBy(f)) {
    expect(u.caller).toBe(id);
    expect([...(allowed[id] ?? [])]).toContain(u.action);
  }
});

test("every action in the map's screen table exists in the demo adapter", () => {
  for (const acts of Object.values(allowed)) for (const a of acts) expect(DEMO_ACTIONS).toContain(a);
});

test.each(screenFiles)("%s makes no network call and defines no color of its own", (f: string) => {
  const src = read(f);
  expect(src).not.toMatch(/\bfetch\(/);
  expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});
