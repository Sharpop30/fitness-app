// Unit tests for M08 challenges, against an in-memory Repository (synthetic data), with the real coins and settings
// modules behind the Orchestrator. Sources: usecase-08 sections 4, 6, 13; stage 4b plan, decision 8 and execution
// decisions 3, 5, 7; Business Logic rule 5.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { challenges } from "../modules/challenges.ts";
import { coins } from "../modules/coins.ts";
import { settings } from "../modules/settings.ts";
import {
  type Actor, type Challenge, type ChallengeCompletion, type CoinTransaction, type Exercise, type Program, StorageUnavailable, type WorkoutLog,
} from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2), TRAINEE = U(11), MAYA = U(12);
const SQUAT = U(21), PUSHUP = U(22), FOREIGN = U(23);
const coach: Actor = { role: "coach", businessID: COACH, coachID: COACH, traineeID: null };
const otherCoach: Actor = { role: "coach", businessID: OTHER_COACH, coachID: OTHER_COACH, traineeID: null };
const trainee: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: TRAINEE };
const maya: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: MAYA };

// The week of today in Israel, as the module counts it.
const ISRAEL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
const TODAY = ISRAEL_DAY.format(new Date());
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10);
const SUNDAY = addDays(TODAY, -new Date(TODAY).getUTCDay());
const LAST_SATURDAY = addDays(SUNDAY, -1);

const exercises: (Exercise & { CoachID: string | null })[] = [
  { ExerciseID: SQUAT, CoachID: null, exerciseName: "סקוואט", isBodyweight: false, videoType: null, videoUrl: null },
  { ExerciseID: PUSHUP, CoachID: null, exerciseName: "שכיבות סמיכה", isBodyweight: true, videoType: null, videoUrl: null },
  { ExerciseID: FOREIGN, CoachID: OTHER_COACH, exerciseName: "של אחר", isBodyweight: false, videoType: null, videoUrl: null },
];
const programWith = (traineeID: string, ids: string[]): Program => ({
  ProgramID: U(30), TraineeID: traineeID, programName: "תוכנית", isActive: true, createdAt: "2026-09-01",
  workouts: [{ WorkoutID: U(41), workoutName: "אימון A", sortOrder: 0, items: ids.map((ExerciseID, i) =>
    ({ WorkoutItemID: U(50 + i), ExerciseID, sortOrder: i, targetSets: 1, targetReps: 8, targetWeight: 0, exerciseName: "x", hasVideo: false })) }],
});

let seq = 900;
// Noon in Israel on the given day.
const log = (traineeID: string, day: string, sets: [exerciseID: string, reps: number, weight: number][] = [[SQUAT, 8, 60]]): WorkoutLog => ({
  WorkoutLogID: U(seq++), TraineeID: traineeID, WorkoutID: U(41), workoutName: "אימון A", performedAt: `${day}T09:00:00+00:00`,
  sets: sets.map(([ExerciseID, reps, weight], i) =>
    ({ SetResultID: U(seq++), ExerciseID, setNumber: i + 1, reps, weight, isDone: true, isCorrected: false, exerciseName: "x" })),
});

function world(opts: { logs?: WorkoutLog[]; challenge?: Partial<Challenge>; programs?: Program[]; storageDown?: boolean } = {}) {
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const list: (Challenge & { CoachID: string })[] = opts.challenge
    ? [{ ChallengeID: U(80), CoachID: COACH, challengeName: "שלושה אימונים (test)", challengeType: "count", targetValue: 3, ExerciseID: null,
      exerciseName: null, extraPrize: "חולצה (test)", weekStart: SUNDAY, ...opts.challenge }]
    : [];
  const completions: (ChallengeCompletion & { ChallengeID: string; ChallengeCompletionID: string })[] = [];
  const ledger: (CoinTransaction & { TraineeID: string })[] = [];
  const logs = opts.logs ?? [];
  const w = fakeRepo({
    isActiveTraineeOfCoach: async (t, c) => (down(), c === COACH && [TRAINEE, MAYA].includes(t)),
    getBusinessSettings: async () => (down(), { coinsChallenge: "50" }),
    listResults: async (t) => (down(), structuredClone(logs.filter((l) => l.TraineeID === t))),
    getActiveProgram: async (t) => (down(), structuredClone((opts.programs ?? []).find((p) => p.TraineeID === t) ?? null)),
    getExercisesByID: async (ids) => (down(), exercises.filter((e) => ids.includes(e.ExerciseID))),
    getExerciseInReach: async (id, c) => (down(), exercises.find((e) => e.ExerciseID === id && (e.CoachID === null || e.CoachID === c)) ?? null),
    getChallengeForWeek: async (c, week) => {
      down();
      const found = list.find((x) => x.CoachID === c && x.weekStart === week);
      if (!found) return null;
      const { CoachID: _, ...rest } = found;
      return rest;
    },
    // The database's unique (CoachID, weekStart).
    createChallenge: async (CoachID, n) => {
      down();
      if (list.some((x) => x.CoachID === CoachID && x.weekStart === n.weekStart)) return null;
      const ChallengeID = U(seq++);
      list.push({ ChallengeID, CoachID, exerciseName: null, ...n });
      return ChallengeID;
    },
    listCompletions: async (id) => (down(), completions.filter((x) => x.ChallengeID === id).map(({ ChallengeID: _, ChallengeCompletionID: __, ...x }) => x)),
    // The database's unique (ChallengeID, TraineeID).
    addCompletion: async (ChallengeID, TraineeID) => {
      down();
      if (completions.some((x) => x.ChallengeID === ChallengeID && x.TraineeID === TraineeID)) return null;
      const ChallengeCompletionID = U(seq++);
      completions.push({ ChallengeID, ChallengeCompletionID, TraineeID, fullName: "מתאמן (test)", completedAt: TODAY, prizeDeliveredAt: null });
      return ChallengeCompletionID;
    },
    markPrizeDelivered: async (id, t) => {
      down();
      const x = completions.find((y) => y.ChallengeID === id && y.TraineeID === t);
      if (!x) return false;
      x.prizeDeliveredAt ??= TODAY;
      return true;
    },
    awardCoins: async (TraineeID, eventType, eventRef, amount) => {
      down();
      if (ledger.some((x) => x.eventType === eventType && x.eventRef === eventRef)) return false;
      ledger.push({ TraineeID, eventType, eventRef, amount, createdAt: TODAY });
      return true;
    },
  });
  return { ...w, list, completions, ledger, logs };
}

const ask = (w: ReturnType<typeof world>, actor: Actor, caller: string, action: string, payload: Record<string, unknown> = {}) =>
  handle({ caller, module: "challenges", action, payload }, actor, w.repo, { challenges, coins, settings });
const check = (w: ReturnType<typeof world>, who: Actor = trainee) =>
  ask(w, who, "M04", "check_progress", { workoutLogID: U(1), traineeID: who.traineeID });
const create = (w: ReturnType<typeof world>, payload: Record<string, unknown>, actor: Actor = coach) =>
  ask(w, actor, "S09", "create_challenge", { challengeName: "חמישה אימונים (test)", challengeType: "count", targetValue: 5, extraPrize: "", ...payload });

// ---- create_challenge (UC8 steps 1-3) ----

Deno.test("UC8 step 3: a challenge is saved for the week that starts on this Sunday", async () => {
  const w = world();
  assertEquals(await create(w, {}), ok(null));
  assertEquals([w.list[0].weekStart, w.list[0].extraPrize, new Date(w.list[0].weekStart).getUTCDay()], [SUNDAY, null, 0]);
});

Deno.test("UC8 a: a second challenge in the same week is CHALLENGE_EXISTS", async () => {
  const w = world({ challenge: {} });
  assertEquals(await create(w, {}), fail("CHALLENGE_EXISTS"));
  assertEquals(w.list.length, 1);
});

Deno.test("UC8 e: a missing or non-positive target, a missing name or type, or an exercise challenge without an exercise, is CHALLENGE_INVALID", async () => {
  const w = world();
  for (const bad of [{ targetValue: 0 }, { targetValue: -2 }, { targetValue: undefined }, { targetValue: 2.5 }, { challengeName: " " },
    { challengeType: "streak" }, { challengeType: "exercise", exerciseID: null }]) {
    assertEquals(await create(w, bad), fail("CHALLENGE_INVALID"));
  }
  assertEquals(w.list.length, 0);
});

Deno.test("rule 5: an exercise of another coach is NOT_ALLOWED, and a trainee cannot create a challenge", async () => {
  const w = world();
  assertEquals(await create(w, { challengeType: "exercise", exerciseID: FOREIGN, targetValue: 50 }), fail("NOT_ALLOWED"));
  assertEquals(await create(w, {}, trainee), fail("NOT_ALLOWED"));
  assertEquals(await create(w, { challengeType: "exercise", exerciseID: SQUAT, targetValue: 62.5 }), ok(null));
});

// ---- get_current_challenge (UC8 step 4, alternative b) ----

Deno.test("UC8 step 4: every trainee sees the challenge with their own progress; the coach sees it with no progress", async () => {
  const w = world({ challenge: {}, logs: [log(TRAINEE, SUNDAY), log(TRAINEE, TODAY), log(TRAINEE, LAST_SATURDAY)] });
  const mine = (await ask(w, trainee, "S20", "get_current_challenge")).data as Record<string, unknown>;
  assertEquals([mine.end, mine.coins, mine.progress], [addDays(SUNDAY, 6), 50, { value: 2, target: 3, exempt: false }]);
  const hers = (await ask(w, maya, "S20", "get_current_challenge")).data as Record<string, unknown>;
  assertEquals(hers.progress, { value: 0, target: 3, exempt: false });
  assertEquals(((await ask(w, coach, "S09", "get_current_challenge")).data as Record<string, unknown>).progress, null);
});

Deno.test("UC8 b: a challenge of last week is closed: there is no current challenge", async () => {
  const w = world({ challenge: { weekStart: addDays(SUNDAY, -7) } });
  assertEquals(await ask(w, trainee, "S20", "get_current_challenge"), ok(null));
  assertEquals(await check(w), ok({ challenge: false }));
});

Deno.test("UC8 step 4, team decision: in an exercise challenge, a trainee whose program lacks the exercise is exempt", async () => {
  const w = world({ challenge: { challengeType: "exercise", ExerciseID: SQUAT, targetValue: 70 },
    programs: [programWith(TRAINEE, [SQUAT]), programWith(MAYA, [PUSHUP])], logs: [log(TRAINEE, TODAY, [[SQUAT, 5, 67.5]])] });
  assertEquals(((await ask(w, trainee, "S20", "get_current_challenge")).data as Record<string, unknown>).progress, { value: 67.5, target: 70, exempt: false });
  assertEquals(((await ask(w, maya, "S20", "get_current_challenge")).data as Record<string, unknown>).progress, { value: 0, target: 70, exempt: true });
});

// ---- check_progress (UC8 steps 5-8) ----

Deno.test("UC8 section 13: reaching the target marks the trainee complete and credits coinsChallenge, with no report", async () => {
  const w = world({ challenge: {}, logs: [log(TRAINEE, SUNDAY), log(TRAINEE, TODAY)] });
  assertEquals(await check(w), ok({ challenge: false }));
  w.logs.push(log(TRAINEE, TODAY));
  assertEquals(await check(w), ok({ challenge: true, coins: 50 }));
  assertEquals(w.completions.length, 1);
  // Execution decision 3: the credit's eventRef is the ChallengeCompletionID.
  assertEquals(w.ledger.map((x) => [x.eventType, x.eventRef, x.amount]), [["challenge", w.completions[0].ChallengeCompletionID, 50]]);
  // Completed once: the next workout adds nothing.
  w.logs.push(log(TRAINEE, TODAY));
  assertEquals(await check(w), ok({ challenge: false }));
  assertEquals(w.ledger.length, 1);
});

Deno.test("UC8 c: workouts of last week do not count toward this week's challenge", async () => {
  const w = world({ challenge: {}, logs: [log(TRAINEE, LAST_SATURDAY), log(TRAINEE, addDays(SUNDAY, -2)), log(TRAINEE, TODAY)] });
  assertEquals(await check(w), ok({ challenge: false }));
});

Deno.test("execution decision 5: a bodyweight exercise challenge counts reps; an exempt trainee never completes", async () => {
  const w = world({ challenge: { challengeType: "exercise", ExerciseID: PUSHUP, targetValue: 20 },
    programs: [programWith(TRAINEE, [PUSHUP]), programWith(MAYA, [SQUAT])], logs: [log(TRAINEE, TODAY, [[PUSHUP, 21, 0]]), log(MAYA, TODAY, [[PUSHUP, 99, 0]])] });
  assertEquals(await check(w), ok({ challenge: true, coins: 50 }));
  assertEquals(await check(w, maya), ok({ challenge: false }));
});

Deno.test("UC8 d: when the credit fails, the completion is kept", async () => {
  const w = world({ challenge: {}, logs: [log(TRAINEE, TODAY), log(TRAINEE, TODAY), log(TRAINEE, TODAY)] });
  w.repo.getBusinessSettings = async () => ({}); // coinsChallenge missing: coins.award refuses
  assertEquals(await check(w), ok({ challenge: true, coins: 0 }));
  assertEquals([w.completions.length, w.ledger.length], [1, 0]);
});

// ---- list_completions, mark_prize_delivered (UC8 step 9) ----

Deno.test("UC8 step 9: the coach sees who completed, and marks the extra prize delivered", async () => {
  const w = world({ challenge: {}, logs: [log(TRAINEE, TODAY), log(TRAINEE, TODAY), log(TRAINEE, TODAY)] });
  await check(w);
  assertEquals(((await ask(w, coach, "S09", "list_completions")).data as ChallengeCompletion[]).map((x) => x.TraineeID), [TRAINEE]);
  assertEquals(await ask(w, coach, "S09", "mark_prize_delivered", { traineeID: TRAINEE }), ok(null));
  assertEquals(w.completions[0].prizeDeliveredAt, TODAY);
  assertEquals(await ask(w, coach, "S09", "mark_prize_delivered", { traineeID: MAYA }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, otherCoach, "S09", "mark_prize_delivered", { traineeID: TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, trainee, "S09", "list_completions"), fail("NOT_ALLOWED"));
});

Deno.test("the database failing gives STORAGE_UNAVAILABLE, without throwing", async () => {
  assertEquals(await ask(world({ storageDown: true }), trainee, "S20", "get_current_challenge"), fail("STORAGE_UNAVAILABLE"));
});
