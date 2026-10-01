// Unit tests for M07 coins, against an in-memory Repository (synthetic data) that keeps the database's rules: one award
// per event (unique eventType and eventRef) and an atomic redemption. The real settings module is behind the Orchestrator.
// Sources: usecase-07 sections 4, 6, 13; doc-module-map v5 section 4 and section 6 (the M07 example); stage 4b plan,
// decisions 4, 6, 7 and execution decisions 1-3; Business Logic rules 4, 5, 7; CLAUDE.md rule 8.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { coins } from "../modules/coins.ts";
import { settings } from "../modules/settings.ts";
import {
  type Actor, type CoinTransaction, type Exercise, type PersonalGoal, type Redemption, type Reward, StorageUnavailable, type WorkoutLog,
} from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2), TRAINEE = U(11), OTHER_TRAINEE = U(12);
const SQUAT = U(21), PUSHUP = U(22), FOREIGN = U(23);
const coach: Actor = { role: "coach", businessID: COACH, coachID: COACH, traineeID: null };
const otherCoach: Actor = { role: "coach", businessID: OTHER_COACH, coachID: OTHER_COACH, traineeID: null };
const trainee: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: TRAINEE };
const AMOUNTS = { coinsWorkout: "10", coinsGoal: "30", coinsChallenge: "50", coinsAttendance: "5" };

let seq = 800;
const workout = (traineeID: string, sets: [exerciseID: string, reps: number, weight: number][]): WorkoutLog => ({
  WorkoutLogID: U(seq++), TraineeID: traineeID, WorkoutID: U(41), workoutName: "אימון A", performedAt: "2026-09-28",
  sets: sets.map(([ExerciseID, reps, weight], i) =>
    ({ SetResultID: U(seq++), ExerciseID, setNumber: i + 1, reps, weight, isDone: true, isCorrected: false, exerciseName: "x" })),
});

function world(opts: { settings?: Record<string, string>; logs?: WorkoutLog[]; goal?: Partial<PersonalGoal>; storageDown?: boolean } = {}) {
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const ledger: (CoinTransaction & { TraineeID: string })[] = [];
  const goals: (PersonalGoal & { status: string })[] = opts.goal
    ? [{ PersonalGoalID: U(70), TraineeID: TRAINEE, ExerciseID: SQUAT, exerciseName: "סקוואט", isBodyweight: false, targetWeight: 65, status: "active", ...opts.goal }]
    : [];
  const rewards: (Reward & { CoachID: string })[] = [
    { RewardID: U(71), CoachID: COACH, rewardName: "בקבוק (test)", priceCoins: 60, isActive: true },
    { RewardID: U(72), CoachID: OTHER_COACH, rewardName: "של אחר (test)", priceCoins: 1, isActive: true },
  ];
  const redemptions: (Redemption & { CoachID: string })[] = [];
  const logs = opts.logs ?? [];
  const exercises: (Exercise & { CoachID: string | null })[] = [
    { ExerciseID: SQUAT, CoachID: null, exerciseName: "סקוואט", isBodyweight: false, videoType: null, videoUrl: null },
    { ExerciseID: PUSHUP, CoachID: COACH, exerciseName: "שכיבות סמיכה", isBodyweight: true, videoType: null, videoUrl: null },
    { ExerciseID: FOREIGN, CoachID: OTHER_COACH, exerciseName: "של אחר", isBodyweight: false, videoType: null, videoUrl: null },
  ];
  const balance = (t: string) => ledger.filter((x) => x.TraineeID === t).reduce((s, x) => s + x.amount, 0);
  const active = (t: string) => goals.find((g) => g.TraineeID === t && g.status === "active");

  const w = fakeRepo({
    isActiveTraineeOfCoach: async (t, c) => (down(), c === COACH && [TRAINEE, OTHER_TRAINEE].includes(t)),
    getBusinessSettings: async () => (down(), opts.settings ?? AMOUNTS),
    getWorkoutLog: async (id) => (down(), structuredClone(logs.find((l) => l.WorkoutLogID === id) ?? null)),
    getExerciseInReach: async (id, c) => (down(), exercises.find((e) => e.ExerciseID === id && (e.CoachID === null || e.CoachID === c)) ?? null),
    awardCoins: async (TraineeID, eventType, eventRef, amount) => {
      down();
      if (ledger.some((x) => x.eventType === eventType && x.eventRef === eventRef)) return false;
      ledger.push({ TraineeID, eventType, eventRef, amount, createdAt: "2026-09-28" });
      return true;
    },
    listCoinTransactions: async (t) => (down(), ledger.filter((x) => x.TraineeID === t).map(({ TraineeID: _, ...x }) => x)),
    getActiveGoal: async (t) => { down(); const g = active(t); if (!g) return null; const { status: _, ...rest } = g; return rest; },
    setPersonalGoal: async (TraineeID, ExerciseID, targetWeight) => {
      down();
      const g = active(TraineeID);
      if (g) Object.assign(g, { ExerciseID, targetWeight });
      else goals.push({ PersonalGoalID: U(seq++), TraineeID, ExerciseID, exerciseName: "x", isBodyweight: false, targetWeight, status: "active" });
    },
    // As coins_achieve_goal in migration 0009.
    achieveGoal: async (id, amount) => {
      down();
      const g = goals.find((x) => x.PersonalGoalID === id && x.status === "active");
      if (!g) return false;
      g.status = "achieved";
      ledger.push({ TraineeID: g.TraineeID, eventType: "goal", eventRef: id, amount, createdAt: "2026-09-28" });
      return true;
    },
    listRewards: async (c) => (down(), rewards.filter((r) => r.CoachID === c && r.isActive).map(({ CoachID: _, ...r }) => r)),
    addReward: async (CoachID, rewardName, priceCoins) => { down(); rewards.push({ RewardID: U(seq++), CoachID, rewardName, priceCoins, isActive: true }); },
    listRedemptions: async (c) => (down(), redemptions.filter((r) => r.CoachID === c).map(({ CoachID: _, ...r }) => r)),
    // As coins_redeem in migration 0009.
    redeemReward: async (t, rewardID) => {
      down();
      const r = rewards.find((x) => x.RewardID === rewardID && x.CoachID === COACH && x.isActive);
      if (!r) return { status: "no_reward" };
      if (balance(t) < r.priceCoins) return { status: "insufficient", balance: balance(t) };
      const RedemptionID = U(seq++);
      ledger.push({ TraineeID: t, eventType: "redeem", eventRef: RedemptionID, amount: -r.priceCoins, createdAt: "2026-09-28" });
      redemptions.push({ RedemptionID, CoachID: COACH, TraineeID: t, fullName: "מתאמן (test)", RewardID: r.RewardID, rewardName: r.rewardName,
        status: "pending", deliveredAt: null, createdAt: "2026-09-28" });
      return { status: "ok", balance: balance(t) };
    },
    markRewardDelivered: async (id, c) => {
      down();
      const r = redemptions.find((x) => x.RedemptionID === id && x.CoachID === c);
      if (!r) return false;
      r.status = "delivered";
      return true;
    },
  });
  return { ...w, ledger, goals, rewards, redemptions, balance };
}

const ask = (w: ReturnType<typeof world>, actor: Actor, caller: string, action: string, payload: Record<string, unknown> = {}) =>
  handle({ caller, module: "coins", action, payload }, actor, w.repo, { coins, settings });
// As results asks after saving a workout (module map v4, "referrals from results.log_workout").
const awardWorkout = (w: ReturnType<typeof world>, l: WorkoutLog, caller = "M04") =>
  ask(w, trainee, caller, "award", { workoutLogID: l.WorkoutLogID, traineeID: TRAINEE, reason: "workout", eventRef: l.WorkoutLogID });

// ---- award (UC7 steps 3-5) ----

Deno.test("module map section 6, M07 example: the same eventRef twice gives one credit, then COINS_ALREADY_AWARDED", async () => {
  const l = workout(TRAINEE, [[SQUAT, 8, 60]]);
  const w = world({ logs: [l] });
  assertEquals(await awardWorkout(w, l), ok({ coins: 10, goal: false }));
  assertEquals(await awardWorkout(w, l), fail("COINS_ALREADY_AWARDED"));
  assertEquals(w.balance(TRAINEE), 10);
});

Deno.test("UC7 section 13: saving a workout grows the balance by coinsWorkout from SETTINGS", async () => {
  const [a, b] = [workout(TRAINEE, [[SQUAT, 8, 60]]), workout(TRAINEE, [[SQUAT, 8, 60]])];
  const w = world({ logs: [a, b], settings: { ...AMOUNTS, coinsWorkout: "15" } });
  await awardWorkout(w, a);
  await awardWorkout(w, b);
  assertEquals(w.balance(TRAINEE), 30);
});

Deno.test("UC7 c, rule 8: no coinsWorkout in SETTINGS is VALUE_NOT_SET, and nothing is credited", async () => {
  const l = workout(TRAINEE, [[SQUAT, 8, 60]]);
  const w = world({ logs: [l], settings: { coinsGoal: "30" } });
  assertEquals(await awardWorkout(w, l), fail("VALUE_NOT_SET"));
  assertEquals(w.ledger.length, 0);
});

Deno.test("execution decision 1: a reason from the wrong module, or a workout of another trainee, is NOT_ALLOWED", async () => {
  const mine = workout(TRAINEE, [[SQUAT, 8, 60]]);
  const theirs = workout(OTHER_TRAINEE, [[SQUAT, 8, 60]]);
  const w = world({ logs: [mine, theirs] });
  assertEquals(await awardWorkout(w, mine, "M08"), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, trainee, "M04", "award", { traineeID: TRAINEE, reason: "workout", eventRef: theirs.WorkoutLogID }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, trainee, "M04", "award", { traineeID: TRAINEE, reason: "bonus", eventRef: mine.WorkoutLogID }), fail("NOT_ALLOWED"));
  assertEquals(w.ledger.length, 0);
});

Deno.test("UC8 step 8: challenges credits a completion with coinsChallenge, once", async () => {
  const w = world();
  const payload = { traineeID: TRAINEE, reason: "challenge", eventRef: U(90) };
  assertEquals(await ask(w, trainee, "M08", "award", payload), ok({ coins: 50, goal: false }));
  assertEquals(await ask(w, trainee, "M08", "award", payload), fail("COINS_ALREADY_AWARDED"));
  assertEquals(w.balance(TRAINEE), 50);
});

Deno.test("UC7 section 13: passing the personal goal credits coinsGoal once, closes the goal, and says goal", async () => {
  const hit = workout(TRAINEE, [[SQUAT, 5, 67.5]]);
  const again = workout(TRAINEE, [[SQUAT, 5, 70]]);
  const w = world({ logs: [hit, again], goal: {} });
  assertEquals(await awardWorkout(w, hit), ok({ coins: 10, goal: true }));
  assertEquals(w.goals[0].status, "achieved");
  // Execution decision 2: the feedback shows the workout's coins; the goal's are in the balance.
  assertEquals(w.balance(TRAINEE), 40);
  // A closed goal waits for the coach to set a new one (UC7, team decision): no second goal credit.
  assertEquals(await awardWorkout(w, again), ok({ coins: 10, goal: false }));
  assertEquals(w.balance(TRAINEE), 50);
});

Deno.test("UC7 step 1: below the goal, the goal stays open; a bodyweight goal is measured in reps (decision 6)", async () => {
  const below = workout(TRAINEE, [[SQUAT, 8, 60]]);
  const w = world({ logs: [below], goal: {} });
  assertEquals(await awardWorkout(w, below), ok({ coins: 10, goal: false }));
  assertEquals(w.goals[0].status, "active");

  const reps = workout(TRAINEE, [[PUSHUP, 20, 0]]);
  const bw = world({ logs: [reps], goal: { ExerciseID: PUSHUP, isBodyweight: true, targetWeight: 20 } });
  assertEquals(await awardWorkout(bw, reps), ok({ coins: 10, goal: true }));
});

// ---- get_balance (UC7 step 6; rule 7) ----

Deno.test("UC7 step 6, rule 7: the balance is the sum of the ledger, with the history, the catalog and the active goal", async () => {
  const l = workout(TRAINEE, [[SQUAT, 8, 60]]);
  const w = world({ logs: [l], goal: {} });
  await awardWorkout(w, l);
  const r = await ask(w, trainee, "S18", "get_balance");
  const d = r.data as { balance: number; history: unknown[]; rewards: { RewardID: string }[]; goal: { ExerciseID: string; targetWeight: number } };
  assertEquals(d.balance, 10);
  assertEquals(d.history.length, 1);
  assertEquals(d.rewards.map((x) => x.RewardID), [U(71)]);
  assertEquals([d.goal.ExerciseID, d.goal.targetWeight], [SQUAT, 65]);
  // The coach of the trainee sees the same; another coach does not (rule 5).
  assertEquals(await ask(w, coach, "M13", "get_balance", { traineeID: TRAINEE }), r);
  assertEquals(await ask(w, otherCoach, "M13", "get_balance", { traineeID: TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, trainee, "S18", "get_balance", { traineeID: OTHER_TRAINEE }), fail("NOT_ALLOWED"));
});

// ---- set_personal_goal (UC7 step 1; decision 6) ----

Deno.test("decision 6: setting a goal creates one; changing it updates the same goal", async () => {
  const w = world();
  assertEquals(await ask(w, coach, "S07", "set_personal_goal", { traineeID: TRAINEE, exerciseID: SQUAT, targetWeight: 70 }), ok(null));
  assertEquals(await ask(w, coach, "S07", "set_personal_goal", { traineeID: TRAINEE, exerciseID: PUSHUP, targetWeight: 25 }), ok(null));
  assertEquals(w.goals.length, 1);
  assertEquals([w.goals[0].ExerciseID, w.goals[0].targetWeight, w.goals[0].status], [PUSHUP, 25, "active"]);
});

Deno.test("module map v5: a goal with a missing or non-positive target is PROGRAM_INVALID; not the coach's is NOT_ALLOWED", async () => {
  const w = world();
  const set = (actor: Actor, payload: Record<string, unknown>) => ask(w, actor, "S07", "set_personal_goal", payload);
  assertEquals(await set(coach, { traineeID: TRAINEE, exerciseID: SQUAT, targetWeight: 0 }), fail("PROGRAM_INVALID"));
  assertEquals(await set(coach, { traineeID: TRAINEE, exerciseID: SQUAT }), fail("PROGRAM_INVALID"));
  assertEquals(await set(coach, { traineeID: TRAINEE, exerciseID: FOREIGN, targetWeight: 50 }), fail("NOT_ALLOWED"));
  assertEquals(await set(otherCoach, { traineeID: TRAINEE, exerciseID: SQUAT, targetWeight: 50 }), fail("NOT_ALLOWED"));
  assertEquals(await set(trainee, { traineeID: TRAINEE, exerciseID: SQUAT, targetWeight: 50 }), fail("NOT_ALLOWED"));
  assertEquals(w.goals.length, 0);
});

// ---- manage_rewards, redeem_reward, mark_reward_delivered (UC7 steps 2, 7-9) ----

Deno.test("UC7 step 2: the coach adds a reward and sees the catalog; a missing name or price is VALUE_NOT_SET (decision 7)", async () => {
  const w = world();
  const r = await ask(w, coach, "S10", "manage_rewards", { op: "add", rewardName: " כרטיסייה (test) ", priceCoins: 120 });
  assertEquals((r.data as { rewards: Reward[] }).rewards.map((x) => x.rewardName), ["בקבוק (test)", "כרטיסייה (test)"]);
  assertEquals(await ask(w, coach, "S10", "manage_rewards", { op: "add", rewardName: "", priceCoins: 10 }), fail("VALUE_NOT_SET"));
  assertEquals(await ask(w, coach, "S10", "manage_rewards", { op: "add", rewardName: "x", priceCoins: 0 }), fail("VALUE_NOT_SET"));
  assertEquals(await ask(w, trainee, "M13", "manage_rewards", { op: "list" }), fail("NOT_ALLOWED"));
});

Deno.test("UC7 section 13: redeeming lowers the balance; the coach sees it pending and marks it delivered", async () => {
  const w = world();
  await ask(w, trainee, "M08", "award", { traineeID: TRAINEE, reason: "challenge", eventRef: U(91) });
  await ask(w, trainee, "M08", "award", { traineeID: TRAINEE, reason: "challenge", eventRef: U(92) });
  assertEquals(await ask(w, trainee, "S18", "redeem_reward", { rewardID: U(71) }), ok({ balance: 40 }));
  const list = (await ask(w, coach, "S10", "manage_rewards", { op: "list" })).data as { redemptions: Redemption[] };
  assertEquals(list.redemptions.map((r) => r.status), ["pending"]);
  const id = list.redemptions[0].RedemptionID;
  assertEquals(await ask(w, otherCoach, "S10", "mark_reward_delivered", { redemptionID: id }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, coach, "S10", "mark_reward_delivered", { redemptionID: id }), ok(null));
  assertEquals(w.redemptions[0].status, "delivered");
});

Deno.test("UC7 a: a price above the balance is COINS_INSUFFICIENT, and nothing is debited; another coach's reward is NOT_ALLOWED", async () => {
  const w = world();
  await ask(w, trainee, "M08", "award", { traineeID: TRAINEE, reason: "challenge", eventRef: U(93) });
  assertEquals(await ask(w, trainee, "S18", "redeem_reward", { rewardID: U(71) }), fail("COINS_INSUFFICIENT"));
  assertEquals(await ask(w, trainee, "S18", "redeem_reward", { rewardID: U(72) }), fail("NOT_ALLOWED"));
  assertEquals(w.balance(TRAINEE), 50);
  assertEquals(w.redemptions.length, 0);
});

Deno.test("the database failing gives STORAGE_UNAVAILABLE, without throwing", async () => {
  assertEquals(await ask(world({ storageDown: true }), trainee, "S18", "get_balance"), fail("STORAGE_UNAVAILABLE"));
});
