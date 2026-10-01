// Demo adapter (stage 2): answers every action in doc-module-map section 4 from demo data, with the rules of
// the approved use cases, so the screens can be reviewed without a server. It is replaced in stage 3 by the
// real Endpoint in client.ts; the Business Logic that counts is the server's, never this file's.
import type { Adapter, Reply, Session } from "../api/client";
import * as D from "./data";

const ok = (data: unknown): Reply => ({ ok: true, data, error: null });
const fail = (code: string): Reply => ({ ok: false, data: null, error: { code, message: D.errorTexts[code] ?? "" } });
const num = (k: string) => Number(D.settings[k]);
const uid = () => Math.random().toString(36).slice(2, 9);
const tname = (id: string) => D.trainees.find((t) => t.TraineeID === id)?.fullName ?? "";
const ex = (id: string) => D.exercises.find((e) => e.ExerciseID === id)!;
const dayKey = (d: Date) => d.toDateString();

// ---- derived values: computed, never stored (Business Logic rule 7) ----
const activeProgram = (tid: string) => D.programs.find((p) => p.TraineeID === tid && p.isActive) ?? null;
const balance = (tid: string) => D.coinTx.filter((c) => c.TraineeID === tid).reduce((a, c) => a + c.amount, 0);
function award(tid: string, eventType: string, eventRef: string): number {
  if (D.coinTx.some((c) => c.eventType === eventType && c.eventRef === eventRef)) return 0; // one award per event
  const amount = num({ workout: "coinsWorkout", goal: "coinsGoal", challenge: "coinsChallenge", attendance: "coinsAttendance" }[eventType]!);
  D.coinTx.push({ TraineeID: tid, eventType, eventRef, amount, createdAt: new Date(D.TODAY) });
  return amount;
}
function points(tid: string, exID: string) {
  const bw = ex(exID).isBodyweight;
  return D.logs.filter((l) => l.TraineeID === tid && l.sets.some((s) => s.ExerciseID === exID))
    .sort((a, b) => +a.performedAt - +b.performedAt)
    .map((l) => {
      const ss = l.sets.filter((s) => s.ExerciseID === exID && s.isDone);
      return { date: l.performedAt, value: Math.max(0, ...ss.map((s) => (bw ? s.reps : s.weight))), corrected: l.sets.some((s) => s.isCorrected) };
    });
}
function streak(tid: string) {
  const days = [...new Set(D.logs.filter((l) => l.TraineeID === tid).map((l) => dayKey(l.performedAt)))].map((s) => new Date(s)).sort((a, b) => +b - +a);
  const gap = num("streakGapDays");
  if (!days.length || (+D.TODAY - +days[0]) / 864e5 > gap + 1) return 0;
  let n = 1;
  for (let i = 1; i < days.length; i++) { if ((+days[i - 1] - +days[i]) / 864e5 <= gap + 1) n++; else break; }
  return n;
}
const currentChallenge = () => D.challenges.find((c) => +c.weekStart === +D.sundayOf(D.TODAY)) ?? null;
function challengeProgress(tid: string) {
  const c = currentChallenge();
  if (!c) return null;
  const end = D.addDays(c.weekStart, 7);
  const weekLogs = D.logs.filter((l) => l.TraineeID === tid && l.performedAt >= c.weekStart && l.performedAt < end);
  if (c.challengeType === "exercise") {
    const inPlan = activeProgram(tid)?.workouts.some((w) => w.items.some((i) => i.ExerciseID === c.ExerciseID));
    if (!inPlan) return { exempt: true, value: 0, target: c.targetValue };
    return { exempt: false, value: Math.max(0, ...weekLogs.flatMap((l) => l.sets.filter((s) => s.ExerciseID === c.ExerciseID).map((s) => s.weight))), target: c.targetValue };
  }
  return { exempt: false, value: weekLogs.length, target: c.targetValue };
}
function notify(tid: string, messageText: string) {
  D.notifications.unshift({ NotificationID: uid(), TraineeID: tid, messageText, createdAt: new Date(D.TODAY), readAt: null });
}
function offerNext(k: D.Klass) {
  const taken = k.regs.filter((r) => r.status === "registered" || r.status === "offered").length;
  const next = k.regs.find((r) => r.status === "waitlist");
  if (next && taken < k.capacity) {
    next.status = "offered";
    next.offerExpiresAt = new Date(+D.TODAY + num("spotOfferHours") * 36e5);
    notify(next.TraineeID, `התפנה מקום בשיעור ב-${k.startsAt.toLocaleDateString("he-IL")}`);
  }
}
const classView = (k: D.Klass, tid: string | null) => ({
  ClassID: k.ClassID, startsAt: k.startsAt, place: k.place, capacity: k.capacity, status: k.status,
  registered: k.regs.filter((r) => r.status === "registered").map((r) => ({ TraineeID: r.TraineeID, fullName: tname(r.TraineeID), attended: r.attended })),
  waitlist: k.regs.filter((r) => r.status === "waitlist" || r.status === "offered").map((r) => ({ TraineeID: r.TraineeID, fullName: tname(r.TraineeID) })),
  myStatus: tid ? k.regs.find((r) => r.TraineeID === tid)?.status ?? null : null,
  myWaitPosition: tid ? k.regs.filter((r) => r.status === "waitlist").findIndex((r) => r.TraineeID === tid) + 1 : 0,
});

type H = (p: any, s: Session) => Reply;
const me = (s: Session) => s.traineeID!;
const mine = (s: Session, tid: string) => s.role === "coach" || s.traineeID === tid;

const actions: Record<string, H> = {
  // ---- M01 trainees ----
  "trainees.list_trainees": () => ok(D.trainees.filter((t) => t.isActive).map((t) => ({ ...t, hasProgram: !!activeProgram(t.TraineeID) }))),
  "trainees.invite_trainee": (p) => {
    const name = String(p.name ?? "").trim(), email = String(p.email ?? "").trim();
    if (!name || (p.channel === "email" && !/^\S+@\S+\.\S+$/.test(email))) return fail("INVITE_INVALID");
    const TraineeID = "t" + uid();
    D.trainees.push({ TraineeID, fullName: name + " (דוגמה)", isActive: true, joined: false });
    D.invites.push({ InviteID: uid(), inviteeName: name, status: "open", expiresAt: D.addDays(D.TODAY, num("inviteValidDays")), TraineeID });
    return ok({ link: `https://sharpop30.github.io/fitness-app/#join-${TraineeID} (דוגמה)` });
  },
  "trainees.accept_invite": (p) => {
    if (p.expired) return fail("INVITE_EXPIRED");
    const t = D.trainees.find((x) => x.TraineeID === (p.traineeID ?? "d0000000-0000-4000-8000-000000001004"));
    if (!t) return fail("INVITE_INVALID");
    t.joined = true;
    return ok({ TraineeID: t.TraineeID });
  },
  "trainees.get_me": (_p, s) => ok({ roles: s.role === "trainee" ? ["trainee"] : ["owner", "coach"], role: s.role, traineeID: s.traineeID,
    fullName: s.role === "trainee" ? D.trainees.find((t) => t.TraineeID === s.traineeID)?.fullName ?? "" : "מאמן (דוגמה)" }),
  "trainees.get_trainee_card": (p) => {
    const tid = String(p.traineeID);
    const t = D.trainees.find((x) => x.TraineeID === tid);
    if (!t) return fail("NOT_ALLOWED");
    const prog = activeProgram(tid);
    const goal = D.goals.find((g) => g.TraineeID === tid && g.status === "active") ?? null; // the active goal only, as the server
    return ok({ trainee: t, coins: balance(tid), streak: streak(tid), openPayments: D.payments.filter((q) => q.TraineeID === tid && q.status === "open").length,
      workouts: prog?.workouts.length ?? 0, payments: D.payments.filter((q) => q.TraineeID === tid).length,
      goal: goal && { PersonalGoalID: goal.PersonalGoalID, ExerciseID: goal.ExerciseID, exerciseName: ex(goal.ExerciseID).exerciseName, targetWeight: goal.targetWeight } });
  },
  // ---- M02 exercises ----
  "exercises.list_exercises": () => ok(D.exercises),
  "exercises.get_exercise": (p) => ok(ex(String(p.exerciseID))),
  "exercises.create_exercise": (p) => {
    const name = String(p.name ?? "").trim();
    if (!name) return fail("PROGRAM_INVALID");
    const e = { ExerciseID: "e" + uid(), exerciseName: name, isBodyweight: !!p.isBodyweight, videoType: null, videoUrl: null };
    D.exercises.push(e);
    return ok(e);
  },
  // Stage 5 (map v9): on demo data there is no store; the demo upload goes through.
  "exercises.prepare_upload": (p) => (Number(p.seconds) > num("videoMaxSeconds") ? fail("VIDEO_TOO_LONG") : ok({ uploadUrl: "demo", path: "demo" })),
  "exercises.attach_video": (p) => {
    const e = ex(String(p.exerciseID));
    if (p.kind === "upload") {
      if (Number(p.seconds) > num("videoMaxSeconds")) return fail("VIDEO_TOO_LONG");
      e.videoType = "upload"; e.videoUrl = "upload (דוגמה)"; return ok(e);
    }
    if (!/^https?:\/\//.test(String(p.url ?? ""))) return fail("VIDEO_INVALID");
    e.videoType = "youtube"; e.videoUrl = String(p.url); return ok(e);
  },
  // ---- M03 programs ----
  "programs.get_active_program": (p, s) => {
    const tid = String(p.traineeID ?? me(s));
    if (!mine(s, tid)) return fail("NOT_ALLOWED");
    const prog = activeProgram(tid);
    if (!prog) return fail("NO_ACTIVE_PROGRAM");
    const workouts = prog.workouts.map((w) => ({ ...w, items: w.items.map((i) => ({ ...i, exerciseName: ex(i.ExerciseID).exerciseName, hasVideo: !!ex(i.ExerciseID).videoType })) }));
    return ok({ ...prog, workouts, inactive: D.programs.filter((x) => x.TraineeID === tid && !x.isActive).map((x) => ({ programName: x.programName, createdAt: x.createdAt })) });
  },
  "programs.start_new_program": (p) => {
    const tid = String(p.traineeID);
    D.programs.forEach((x) => { if (x.TraineeID === tid) x.isActive = false; }); // the previous one is kept, inactive
    D.programs.push({ ProgramID: "p" + uid(), TraineeID: tid, programName: "תוכנית אימון", isActive: true, createdAt: new Date(D.TODAY), workouts: [{ WorkoutID: "w" + uid(), workoutName: "אימון A", items: [] }] });
    return ok(null);
  },
  "programs.save_program": (p) => {
    const prog = activeProgram(String(p.traineeID));
    if (!prog) return fail("NO_ACTIVE_PROGRAM");
    const workouts = p.workouts as D.Workout[];
    for (const w of workouts) {
      if (!w.items.length) return fail("PROGRAM_INVALID");
      for (const i of w.items) if (!(i.targetSets > 0 && i.targetReps > 0 && i.targetWeight >= 0)) return fail("PROGRAM_INVALID");
    }
    prog.workouts = workouts;
    return ok(null);
  },
  "programs.swap_exercise": (p) => {
    const prog = activeProgram(String(p.traineeID));
    const item = prog?.workouts.flatMap((w) => w.items).find((i) => i.WorkoutItemID === p.workoutItemID);
    if (!item) return fail("PROGRAM_INVALID");
    item.ExerciseID = String(p.exerciseID); // same place in the order (Business Logic rule 2)
    return ok(item);
  },
  // ---- M04 results ----
  "results.list_results": (p, s) => {
    const tid = String(p.traineeID ?? me(s));
    if (!mine(s, tid)) return fail("NOT_ALLOWED");
    // Each set with its exercise's name, as the server gives it (repository SetResult).
    return ok(D.logs.filter((l) => l.TraineeID === tid).sort((a, b) => +b.performedAt - +a.performedAt)
      .map((l) => ({ ...l, sets: l.sets.map((x) => ({ ...x, exerciseName: ex(x.ExerciseID).exerciseName })) })));
  },
  "results.log_workout": (p, s) => {
    const tid = me(s);
    const sets = p.sets as D.SetResult[];
    if (sets.some((x) => !(Number.isFinite(x.reps) && x.reps >= 0 && Number.isFinite(x.weight) && x.weight >= 0))) return fail("RESULT_INVALID");
    const w = activeProgram(tid)?.workouts.find((x) => x.WorkoutID === p.workoutID);
    if (!w) return fail("NO_ACTIVE_PROGRAM");
    const records = [...new Set(sets.map((x) => x.ExerciseID))].filter((id) => {
      const prev = points(tid, id).map((q) => q.value);
      const bw = ex(id).isBodyweight;
      const v = Math.max(0, ...sets.filter((x) => x.ExerciseID === id && x.isDone).map((x) => (bw ? x.reps : x.weight)));
      return prev.length > 0 && v > Math.max(...prev);
    }).map((id) => ex(id).exerciseName);
    const log: D.WorkoutLog = { WorkoutLogID: "l" + uid(), TraineeID: tid, WorkoutID: w.WorkoutID, workoutName: w.workoutName, performedAt: new Date(D.TODAY), sets: sets.map((x) => ({ ...x, isCorrected: false })), coachNote: null };
    D.logs.push(log);
    // feedback, coins and challenge, as the server does through the Orchestrator (UC3 step 7, UC6, UC7, UC8)
    const coins = award(tid, "workout", log.WorkoutLogID);
    let goal = false;
    const g = D.goals.find((x) => x.TraineeID === tid && x.status === "active");
    if (g && Math.max(0, ...sets.filter((x) => x.ExerciseID === g.ExerciseID).map((x) => x.weight)) >= g.targetWeight) { g.status = "achieved"; award(tid, "goal", g.PersonalGoalID); goal = true; }
    let challenge = false;
    const c = currentChallenge(), cp = challengeProgress(tid);
    if (c && cp && !cp.exempt && cp.value >= cp.target && !c.completions.some((x) => x.TraineeID === tid)) {
      c.completions.push({ TraineeID: tid, completedAt: new Date(D.TODAY), prizeDeliveredAt: null }); award(tid, "challenge", c.ChallengeID + tid); challenge = true;
    }
    const done = sets.filter((x) => x.isDone).length;
    return ok({ WorkoutLogID: log.WorkoutLogID, feedback: { done, total: sets.length, records, coins, goal, challenge,
      text: records.length ? D.settings.feedbackRecord : done === sets.length ? D.settings.feedbackFull : D.settings.feedbackPartial } });
  },
  "results.correct_result": (p, s) => {
    const log = D.logs.find((l) => l.WorkoutLogID === p.workoutLogID && l.TraineeID === me(s));
    if (!log) return fail("NOT_ALLOWED");
    const fixed = p.sets as D.SetResult[];
    if (fixed.some((x) => !(x.reps >= 0 && x.weight >= 0))) return fail("RESULT_INVALID");
    fixed.forEach((f, i) => { const o = log.sets[i]; if (o.reps !== f.reps || o.weight !== f.weight) { o.reps = f.reps; o.weight = f.weight; o.isCorrected = true; } });
    return ok(null); // coins are not changed by a correction
  },
  // ---- M05 progress ----
  "progress.get_progress_chart": (p, s) => {
    const tid = String(p.traineeID ?? me(s));
    if (!mine(s, tid)) return fail("NOT_ALLOWED");
    const ids = [...new Set(D.logs.filter((l) => l.TraineeID === tid).flatMap((l) => l.sets.map((x) => x.ExerciseID)))];
    const plan = activeProgram(tid)?.workouts.flatMap((w) => w.items.map((i) => i.ExerciseID)).filter((id) => ids.includes(id)) ?? [];
    const sel = (p.exerciseID && ids.includes(String(p.exerciseID))) ? String(p.exerciseID) : plan[0] ?? ids[0] ?? null;
    return ok({ exercises: ids.map((id) => ({ ExerciseID: id, exerciseName: ex(id).exerciseName })), selected: sel,
      isBodyweight: sel ? ex(sel).isBodyweight : false, points: sel ? points(tid, sel) : [] });
  },
  // ---- M06 feedback ----
  "feedback.get_workout_notes": (p, s) => {
    const tid = String(p.traineeID ?? me(s));
    if (!mine(s, tid)) return fail("NOT_ALLOWED");
    return ok(D.logs.filter((l) => l.TraineeID === tid && l.coachNote).map((l) => ({ WorkoutLogID: l.WorkoutLogID, noteText: l.coachNote })));
  },
  "feedback.add_coach_note": (p) => {
    const text = String(p.noteText ?? "").trim();
    if (!text || text.length > num("noteMaxLength")) return fail("NOTE_INVALID");
    const log = D.logs.find((l) => l.WorkoutLogID === p.workoutLogID);
    if (!log) return fail("NOT_ALLOWED");
    log.coachNote = text;
    notify(log.TraineeID, "המאמן הוסיף הערה לאימון שלך");
    return ok(null);
  },
  // ---- M07 coins ----
  "coins.get_balance": (_p, s) => ok({ balance: balance(me(s)), history: D.coinTx.filter((c) => c.TraineeID === me(s)).slice().reverse(),
    rewards: D.rewards.filter((r) => r.isActive) }),
  "coins.set_personal_goal": (p) => {
    const v = Number(p.targetWeight);
    if (!(v > 0)) return fail("PROGRAM_INVALID");
    D.goals.forEach((g) => { if (g.TraineeID === p.traineeID) g.status = "achieved"; });
    D.goals.push({ PersonalGoalID: "g" + uid(), TraineeID: String(p.traineeID), ExerciseID: String(p.exerciseID), targetWeight: v, status: "active" });
    return ok(null);
  },
  "coins.manage_rewards": (p) => {
    if (p.op === "add") {
      const name = String(p.rewardName ?? "").trim(), price = Number(p.priceCoins);
      if (!name || !(price > 0)) return fail("VALUE_NOT_SET");
      D.rewards.push({ RewardID: "r" + uid(), rewardName: name, priceCoins: price, isActive: true });
    }
    return ok({ rewards: D.rewards.filter((r) => r.isActive),
      redemptions: D.redemptions.map((r) => ({ ...r, fullName: tname(r.TraineeID), rewardName: D.rewards.find((x) => x.RewardID === r.RewardID)?.rewardName })) });
  },
  "coins.redeem_reward": (p, s) => {
    const r = D.rewards.find((x) => x.RewardID === p.rewardID)!;
    if (balance(me(s)) < r.priceCoins) return fail("COINS_INSUFFICIENT");
    const ref = "d" + uid();
    D.coinTx.push({ TraineeID: me(s), eventType: "redeem", eventRef: ref, amount: -r.priceCoins, createdAt: new Date(D.TODAY) });
    D.redemptions.push({ RedemptionID: ref, TraineeID: me(s), RewardID: r.RewardID, status: "pending", createdAt: new Date(D.TODAY) });
    return ok({ balance: balance(me(s)) });
  },
  "coins.mark_reward_delivered": (p) => { const r = D.redemptions.find((x) => x.RedemptionID === p.redemptionID)!; r.status = "delivered"; return ok(null); },
  // ---- M08 challenges ----
  "challenges.get_current_challenge": (_p, s) => {
    const c = currentChallenge();
    if (!c) return ok(null);
    return ok({ ...c, end: D.addDays(c.weekStart, 6), coins: num("coinsChallenge"), progress: s.role === "trainee" ? challengeProgress(me(s)) : null });
  },
  "challenges.list_completions": () => ok((currentChallenge()?.completions ?? []).map((c) => ({ ...c, fullName: tname(c.TraineeID) }))),
  "challenges.create_challenge": (p) => {
    if (currentChallenge()) return fail("CHALLENGE_EXISTS");
    if (!(Number(p.targetValue) > 0)) return fail("CHALLENGE_INVALID");
    D.challenges.push({ ChallengeID: "ch" + uid(), challengeName: String(p.challengeName), challengeType: String(p.challengeType), targetValue: Number(p.targetValue),
      ExerciseID: (p.exerciseID as string) ?? null, extraPrize: (p.extraPrize as string) || "", weekStart: D.sundayOf(D.TODAY), completions: [] });
    return ok(null);
  },
  "challenges.mark_prize_delivered": (p) => { const c = currentChallenge()!.completions.find((x) => x.TraineeID === p.traineeID)!; c.prizeDeliveredAt = new Date(D.TODAY); return ok(null); },
  // ---- M09 payments, M10 invoices (demo: no card data anywhere) ----
  "payments.list_payments": (p, s) => {
    const tid = s.role === "trainee" ? me(s) : (p.traineeID as string | undefined);
    return ok(D.payments.filter((q) => !tid || q.TraineeID === tid).sort((a, b) => +b.createdAt - +a.createdAt).map((q) => ({ ...q, fullName: tname(q.TraineeID) })));
  },
  "payments.create_payment_request": (p) => {
    const amount = num(p.paymentType === "monthly" ? "priceMonthly" : "pricePack10");
    if (!(amount > 0)) return fail("VALUE_NOT_SET");
    D.payments.push({ PaymentRequestID: "q" + uid(), TraineeID: String(p.traineeID), paymentType: String(p.paymentType), amount, status: "open", createdAt: new Date(D.TODAY), invoiceNumber: null });
    return ok(null);
  },
  "payments.pay_demo": (p, s) => {
    const q = D.payments.find((x) => x.PaymentRequestID === p.paymentRequestID && x.TraineeID === me(s));
    if (!q) return fail("NOT_ALLOWED");
    if (q.status === "paid") return fail("PAYMENT_ALREADY_PAID");
    q.status = "paid";
    q.invoiceNumber = 1000 + D.payments.filter((x) => x.invoiceNumber).length + 1; // the invoice comes with the payment
    return ok({ invoiceNumber: q.invoiceNumber });
  },
  "invoices.list_invoices": (p, s) => {
    const tid = s.role === "trainee" ? me(s) : (p.traineeID as string | undefined);
    return ok(D.payments.filter((q) => q.invoiceNumber && (!tid || q.TraineeID === tid)).map((q) => ({ invoiceNumber: q.invoiceNumber, amount: q.amount,
      paymentType: q.paymentType, fullName: tname(q.TraineeID), issuedAt: q.createdAt, isDemo: true })));
  },
  // ---- M11 classes ----
  "classes.list_upcoming_classes": (_p, s) => {
    const from = s.role === "coach" ? D.addDays(D.TODAY, -3) : D.TODAY;
    return ok({ classes: D.classes.filter((k) => k.startsAt >= new Date(from.toDateString())).sort((a, b) => +a.startsAt - +b.startsAt).map((k) => classView(k, s.role === "trainee" ? me(s) : null)),
      cancelHours: num("cancelHours"),
      lateRequests: s.role === "coach" ? D.lateRequests.filter((r) => r.status === "pending").map((r) => ({ ...r, fullName: tname(r.TraineeID), startsAt: D.classes.find((k) => k.ClassID === r.ClassID)!.startsAt })) : [] });
  },
  "classes.list_registrations": (p) => ok(classView(D.classes.find((k) => k.ClassID === p.classID)!, null)),
  "classes.publish_class": (p) => {
    const capacity = Number(p.capacity);
    if (!(capacity > 0) || !String(p.place ?? "").trim() || !p.startsAt) return fail("CLASS_INVALID");
    D.classes.push({ ClassID: "k" + uid(), startsAt: new Date(String(p.startsAt)), place: String(p.place), capacity, status: "active", regs: [] });
    return ok(null);
  },
  "classes.cancel_class": (p) => {
    const k = D.classes.find((x) => x.ClassID === p.classID)!;
    k.status = "cancelled";
    k.regs.forEach((r) => notify(r.TraineeID, `השיעור ב-${k.startsAt.toLocaleDateString("he-IL")} בוטל בידי המאמן`));
    return ok(null);
  },
  "classes.mark_attendance": (p) => {
    const k = D.classes.find((x) => x.ClassID === p.classID)!;
    const present = p.present as string[];
    let n = 0;
    k.regs.filter((r) => r.status === "registered").forEach((r) => { r.attended = present.includes(r.TraineeID); if (r.attended && award(r.TraineeID, "attendance", k.ClassID + r.TraineeID)) n++; });
    return ok({ awarded: n });
  },
  "classes.register": (p, s) => {
    const k = D.classes.find((x) => x.ClassID === p.classID)!;
    const existing = k.regs.find((r) => r.TraineeID === me(s) && r.status !== "cancelled");
    if (existing) return fail("ALREADY_REGISTERED");
    const taken = k.regs.filter((r) => r.status === "registered" || r.status === "offered").length;
    const status = taken < k.capacity ? "registered" : "waitlist";
    k.regs = k.regs.filter((r) => r.TraineeID !== me(s));
    k.regs.push({ TraineeID: me(s), status, attended: null, offerExpiresAt: null });
    return ok({ status, position: k.regs.filter((r) => r.status === "waitlist").length });
  },
  "classes.cancel_registration": (p, s) => {
    const k = D.classes.find((x) => x.ClassID === p.classID)!;
    if ((+k.startsAt - +D.TODAY) / 36e5 < num("cancelHours")) return fail("CANCEL_TOO_LATE");
    const r = k.regs.find((x) => x.TraineeID === me(s))!;
    r.status = "cancelled";
    offerNext(k);
    return ok(null);
  },
  "classes.request_late_cancel": (p, s) => {
    if (!D.lateRequests.some((r) => r.ClassID === p.classID && r.TraineeID === me(s) && r.status === "pending"))
      D.lateRequests.push({ LateCancelRequestID: uid(), ClassID: String(p.classID), TraineeID: me(s), status: "pending" });
    return ok(null);
  },
  "classes.decide_late_cancel": (p) => {
    const r = D.lateRequests.find((x) => x.LateCancelRequestID === p.requestID)!;
    r.status = p.approve ? "approved" : "rejected";
    if (p.approve) { const k = D.classes.find((x) => x.ClassID === r.ClassID)!; k.regs.find((x) => x.TraineeID === r.TraineeID)!.status = "cancelled"; offerNext(k); }
    notify(r.TraineeID, p.approve ? "בקשת הביטול שלך אושרה" : "בקשת הביטול שלך נדחתה");
    return ok(null);
  },
  "classes.respond_to_spot_offer": (p, s) => {
    const k = D.classes.find((x) => x.ClassID === p.classID)!;
    const r = k.regs.find((x) => x.TraineeID === me(s) && x.status === "offered");
    if (!r) return fail("SPOT_OFFER_EXPIRED");
    if (p.accept) { r.status = "registered"; r.offerExpiresAt = null; } else { r.status = "cancelled"; offerNext(k); }
    return ok(null);
  },
  // ---- M12 notifications ----
  "notifications.list_notifications": (_p, s) => ok(D.notifications.filter((n) => n.TraineeID === me(s) && !n.readAt)),
  "notifications.mark_read": (p) => { const n = D.notifications.find((x) => x.NotificationID === p.notificationID); if (n) n.readAt = new Date(D.TODAY); return ok(null); },
  // ---- M13 home ----
  "home.get_coach_home": () => ok({
    activeTrainees: D.trainees.filter((t) => t.isActive && t.joined).length,
    openPayments: D.payments.filter((q) => q.status === "open").length,
    classesToday: D.classes.filter((k) => k.status === "active" && dayKey(k.startsAt) === dayKey(D.TODAY)).length,
    lateRequests: D.lateRequests.filter((r) => r.status === "pending").length,
    rewardsToDeliver: D.redemptions.filter((r) => r.status === "pending").length,
    challenge: currentChallenge() && { challengeName: currentChallenge()!.challengeName, completions: currentChallenge()!.completions.length },
  }),
  "home.get_trainee_home": (_p, s) => {
    const tid = me(s), prog = activeProgram(tid);
    const count = D.logs.filter((l) => l.TraineeID === tid).length;
    const nextClass = D.classes.filter((k) => k.status === "active" && k.startsAt >= D.TODAY && k.regs.some((r) => r.TraineeID === tid && r.status === "registered")).sort((a, b) => +a.startsAt - +b.startsAt)[0];
    const c = currentChallenge();
    return ok({ reminder: D.settings.reminderText, streak: streak(tid), streakGapDays: num("streakGapDays"), coins: balance(tid),
      nextWorkout: prog?.workouts.length ? prog.workouts[count % prog.workouts.length] : null,
      nextClass: nextClass ? { startsAt: nextClass.startsAt, place: nextClass.place } : null,
      challenge: c && { challengeName: c.challengeName, ...challengeProgress(tid)! },
      offers: D.classes.flatMap((k) => k.regs.filter((r) => r.TraineeID === tid && r.status === "offered").map(() => ({ ClassID: k.ClassID, startsAt: k.startsAt, hours: num("spotOfferHours") }))) });
  },
  // ---- M13 home, the owner; M15 business (usecase-12; the demo business has one coach, its owner) ----
  "home.get_owner_home": () => {
    const month = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const paid = D.payments.filter((q) => q.status === "paid" && month(q.createdAt) === month(D.TODAY));
    const open = D.payments.filter((q) => q.status === "open");
    const from = D.sundayOf(D.TODAY), to = D.addDays(from, 7);
    const week = D.classes.filter((k) => k.status === "active" && k.startsAt >= from && k.startsAt < to);
    return ok({
      incomeMonth: paid.reduce((a, q) => a + q.amount, 0), paidMonth: paid.length,
      openPayments: open.length, openAmount: open.reduce((a, q) => a + q.amount, 0),
      coaches: 1, pendingCoaches: D.coachInvites.filter((i) => i.status === "open").length,
      activeTrainees: D.trainees.filter((t) => t.isActive && t.joined).length,
      classesWeek: { registered: week.reduce((a, k) => a + k.regs.filter((r) => r.status === "registered").length, 0), capacity: week.reduce((a, k) => a + k.capacity, 0) },
      rewardsToDeliver: D.redemptions.filter((r) => r.status === "pending").length,
    });
  },
  "business.list_coaches": () => ok([
    { CoachID: D.coach.CoachID, CoachInviteID: null, fullName: D.coach.fullName, joined: true, trainees: D.trainees.filter((t) => t.joined).length },
    ...D.coachInvites.filter((i) => i.status === "open").map((i) => ({ CoachID: null, CoachInviteID: i.CoachInviteID, fullName: i.inviteeName, joined: false, trainees: 0 })),
  ]),
  "business.invite_coach": (p) => {
    const name = String(p.name ?? "").trim();
    if (!name || (p.channel !== "link" && p.channel !== "email")) return fail("INVITE_INVALID");
    D.coachInvites.push({ CoachInviteID: uid(), inviteeName: name, status: "open", expiresAt: D.addDays(D.TODAY, num("inviteValidDays")) });
    return ok({ link: `https://sharpop30.github.io/fitness-app/?coach=${uid()} (דוגמה)` });
  },
  "business.accept_coach_invite": (p) => (p.expired ? fail("INVITE_EXPIRED") : ok({ CoachID: D.coach.CoachID })),
  "business.get_coach_card": (p) => {
    if (p.coachID !== D.coach.CoachID) return fail("NOT_ALLOWED");
    const joined = D.trainees.filter((t) => t.joined);
    return ok({
      coach: D.coach,
      trainees: joined.map((t) => ({ TraineeID: t.TraineeID, fullName: t.fullName, hasProgram: !!activeProgram(t.TraineeID), streak: streak(t.TraineeID) })),
      income: D.payments.filter((q) => q.status === "paid").reduce((a, q) => a + q.amount, 0),
      upcomingClasses: D.classes.filter((k) => k.status === "active" && k.startsAt > D.TODAY).length,
    });
  },
  "business.get_kpis": () => {
    const active = D.trainees.filter((t) => t.isActive && t.joined);
    const weekAgo = D.addDays(D.TODAY, -7);
    return ok({
      activeTrainees: active.length,
      withProgram: active.filter((t) => activeProgram(t.TraineeID)).length,
      invoicedPayments: D.payments.filter((q) => q.invoiceNumber !== null).length, allPayments: D.payments.length,
      challengeCompletions: currentChallenge()?.completions.length ?? 0,
      loggedThisWeek: active.filter((t) => D.logs.some((l) => l.TraineeID === t.TraineeID && l.performedAt >= weekAgo)).length,
    });
  },
  // ---- M14 settings ----
  // As the server (map v13, rule 9): a screen that names its keys gets those keys only.
  "settings.get_settings": (p, s) => {
    const keys = Array.isArray(p.keys) ? (p.keys as string[]) : typeof p.key === "string" ? [p.key] : null;
    if (!keys) return ok({ ...D.settings, canEdit: s.role === "owner" });
    return keys.every((k) => k in D.settings) ? ok(Object.fromEntries(keys.map((k) => [k, D.settings[k]]))) : fail("VALUE_NOT_SET");
  },
  "settings.get_error_texts": () => ok({ ...D.errorTexts }),
  "settings.update_settings": (p) => { Object.assign(D.settings, p.values as Record<string, string>); return ok(null); },
};

export const demoAdapter: Adapter = async (envelope, session) => {
  const h = actions[`${envelope.module}.${envelope.action}`];
  if (!h) return fail("ACTION_NOT_ALLOWED");
  try {
    return h(envelope.payload, session);
  } catch {
    return fail("UNEXPECTED_ERROR");
  }
};

export const DEMO_ACTIONS = Object.keys(actions);
