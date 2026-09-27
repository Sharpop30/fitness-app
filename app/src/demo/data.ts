// Demo data (CLAUDE.md section 7). Synthetic, every name marked "(דוגמה)". Used by the demo adapter only,
// removed from use in stage 3 and deleted in stage 7. Field names follow the logical ERD.
export const TODAY = new Date(2026, 8, 28, 12, 0); // Monday 28.09.2026, noon
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sundayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };

export const settings: Record<string, string> = {
  coinsWorkout: "10", coinsGoal: "30", coinsChallenge: "50", coinsAttendance: "5",
  priceMonthly: "350", pricePack10: "600",
  cancelHours: "24", streakGapDays: "3", videoMaxSeconds: "60", spotOfferHours: "2", inviteValidDays: "7", noteMaxLength: "280",
  feedbackFull: "כל הכבוד! השלמת את כל הסטים לפי התוכנית.",
  feedbackPartial: "עבודה טובה. כל סט נחשב, ממשיכים באימון הבא.",
  feedbackRecord: "שיא אישי חדש! ההתקדמות שלך נראית.",
  reminderText: "יום טוב! הנה מה שמחכה לך היום.",
};

// The human text of every error code, as in the error_codes table (doc-module-map v2).
export const errorTexts: Record<string, string> = {
  CALLER_MISSING: "משהו השתבש. נסה שוב", CALLER_INVALID: "משהו השתבש. נסה שוב",
  ACTION_NOT_ALLOWED: "הפעולה הזו אינה זמינה כאן", AUDIT_FAILED: "הפעולה לא בוצעה. נסה שוב בעוד רגע",
  UNEXPECTED_ERROR: "משהו השתבש. נסה שוב", NOT_ALLOWED: "אין לך גישה לזה",
  STORAGE_UNAVAILABLE: "השינוי לא נשמר כרגע. נסה שוב", VALUE_NOT_SET: "הערך עוד לא הוגדר בהגדרות",
  PROGRAM_INVALID: "חסר מידע בתרגיל. השלם סטים, חזרות ומשקל", NO_ACTIVE_PROGRAM: "התוכנית שלך בהכנה אצל המאמן",
  RESULT_INVALID: "יש ערך לא תקין באחד הסטים", NOTE_INVALID: "ההערה ריקה או ארוכה מדי",
  INVITE_INVALID: "פרט הקשר לא תקין", INVITE_EXPIRED: "ההזמנה כבר לא בתוקף. בקש חדשה",
  INVITE_DELIVERY_FAILED: "ההזמנה לא נשלחה. אפשר לשלוח שוב או להעתיק קישור",
  VIDEO_INVALID: "זה לא נראה כמו סרטון", VIDEO_TOO_LONG: "אפשר להעלות סרטון של עד דקה", UPLOAD_FAILED: "הסרטון לא עלה. נסה שוב",
  PAYMENT_ALREADY_PAID: "הבקשה הזו כבר שולמה", PAYMENT_GATEWAY_UNAVAILABLE: "התשלום לא הושלם. לא בוצע חיוב",
  COINS_INSUFFICIENT: "אין מספיק מטבעות", COINS_ALREADY_AWARDED: "",
  CHALLENGE_EXISTS: "כבר יש אתגר השבוע", CHALLENGE_INVALID: "חסר יעד לאתגר",
  CLASS_INVALID: "חסרים פרטים בשיעור", ALREADY_REGISTERED: "אתה כבר רשום לשיעור הזה",
  CANCEL_TOO_LATE: "אפשר לבטל עד 24 שעות לפני. אפשר לבקש חריגה", SPOT_OFFER_EXPIRED: "המקום כבר הוצע לבא בתור",
};

export const coach = { CoachID: "c1", fullName: "המאמן (דוגמה)" };

export const trainees = [
  { TraineeID: "t1", fullName: "נועה (דוגמה)", isActive: true, joined: true },
  { TraineeID: "t2", fullName: "איתי (דוגמה)", isActive: true, joined: true },
  { TraineeID: "t3", fullName: "מאיה (דוגמה)", isActive: true, joined: true },
  { TraineeID: "t4", fullName: "רון (דוגמה)", isActive: true, joined: false },
];

export const invites = [{ InviteID: "i1", inviteeName: "רון (דוגמה)", status: "open", expiresAt: addDays(TODAY, 6), TraineeID: "t4" }];

export const exercises = [
  { ExerciseID: "e1", exerciseName: "סקוואט", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "e2", exerciseName: "לחיצת חזה", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "e3", exerciseName: "חתירה בכבל", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "e4", exerciseName: "מכרעים", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "e5", exerciseName: "שכיבות סמיכה", isBodyweight: true, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "e6", exerciseName: "דדליפט רומני", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "e7", exerciseName: "לחיצת כתפיים", isBodyweight: false, videoType: null as string | null, videoUrl: null as string | null },
  { ExerciseID: "e8", exerciseName: "מתח", isBodyweight: true, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
];

export interface Item { WorkoutItemID: string; ExerciseID: string; targetSets: number; targetReps: number; targetWeight: number }
export interface Workout { WorkoutID: string; workoutName: string; items: Item[] }
export interface Program { ProgramID: string; TraineeID: string; programName: string; isActive: boolean; createdAt: Date; workouts: Workout[] }

export const programs: Program[] = [
  { ProgramID: "p1", TraineeID: "t1", programName: "תוכנית קודמת", isActive: false, createdAt: addDays(TODAY, -70), workouts: [] },
  { ProgramID: "p2", TraineeID: "t1", programName: "תוכנית אימון", isActive: true, createdAt: addDays(TODAY, -30), workouts: [
    { WorkoutID: "w1", workoutName: "אימון A", items: [
      { WorkoutItemID: "wi1", ExerciseID: "e1", targetSets: 3, targetReps: 8, targetWeight: 60 },
      { WorkoutItemID: "wi2", ExerciseID: "e2", targetSets: 3, targetReps: 8, targetWeight: 40 },
      { WorkoutItemID: "wi3", ExerciseID: "e5", targetSets: 3, targetReps: 12, targetWeight: 0 }] },
    { WorkoutID: "w2", workoutName: "אימון B", items: [
      { WorkoutItemID: "wi4", ExerciseID: "e6", targetSets: 3, targetReps: 10, targetWeight: 50 },
      { WorkoutItemID: "wi5", ExerciseID: "e3", targetSets: 3, targetReps: 10, targetWeight: 35 },
      { WorkoutItemID: "wi6", ExerciseID: "e8", targetSets: 3, targetReps: 6, targetWeight: 0 }] }] },
  { ProgramID: "p3", TraineeID: "t2", programName: "תוכנית אימון", isActive: true, createdAt: addDays(TODAY, -20), workouts: [
    { WorkoutID: "w3", workoutName: "אימון מלא", items: [
      { WorkoutItemID: "wi7", ExerciseID: "e4", targetSets: 3, targetReps: 10, targetWeight: 12 },
      { WorkoutItemID: "wi8", ExerciseID: "e2", targetSets: 4, targetReps: 6, targetWeight: 55 }] }] },
];

export interface SetResult { ExerciseID: string; setNumber: number; reps: number; weight: number; isDone: boolean; isCorrected: boolean }
export interface WorkoutLog { WorkoutLogID: string; TraineeID: string; WorkoutID: string; workoutName: string; performedAt: Date; sets: SetResult[]; coachNote: string | null }

export const logs: WorkoutLog[] = [];
(function seed() {
  const base: Record<string, number> = { e1: 50, e2: 32, e6: 40, e3: 28 };
  const p = programs[1];
  for (let i = 8; i >= 1; i--) {
    const w = p.workouts[i % 2 ? 0 : 1];
    const sets: SetResult[] = [];
    w.items.forEach((it) => {
      const bw = it.targetWeight === 0;
      for (let s = 1; s <= it.targetSets; s++) {
        sets.push({ ExerciseID: it.ExerciseID, setNumber: s, reps: bw ? it.targetReps - Math.round(i / 2) : it.targetReps,
          weight: bw ? 0 : Math.round(base[it.ExerciseID] + (8 - i) * 1.5) + (s === it.targetSets ? 2.5 : 0), isDone: true, isCorrected: false });
      }
    });
    logs.push({ WorkoutLogID: `l${i}`, TraineeID: "t1", WorkoutID: w.WorkoutID, workoutName: w.workoutName, performedAt: addDays(TODAY, -i * 3), sets, coachNote: i === 1 ? "שיא יפה בסקוואט (דוגמה)" : null });
  }
})();

export const goals = [{ PersonalGoalID: "g1", TraineeID: "t1", ExerciseID: "e1", targetWeight: 65, status: "active" }];

export const coinTx = [
  { TraineeID: "t1", eventType: "challenge", eventRef: "ch0-t1", amount: 50, createdAt: addDays(TODAY, -8) },
  { TraineeID: "t1", eventType: "workout", eventRef: "l2", amount: 10, createdAt: addDays(TODAY, -6) },
  { TraineeID: "t1", eventType: "attendance", eventRef: "k0-t1", amount: 5, createdAt: addDays(TODAY, -5) },
  { TraineeID: "t1", eventType: "workout", eventRef: "l1", amount: 10, createdAt: addDays(TODAY, -3) },
  { TraineeID: "t2", eventType: "workout", eventRef: "x-t2", amount: 80, createdAt: addDays(TODAY, -4) },
];

export const rewards = [
  { RewardID: "r1", rewardName: "כרטיסייה בהנחה", priceCoins: 120, isActive: true },
  { RewardID: "r2", rewardName: "אימון אישי חינם", priceCoins: 200, isActive: true },
  { RewardID: "r3", rewardName: "בקבוק מים ממותג", priceCoins: 60, isActive: true },
];
export const redemptions = [{ RedemptionID: "d1", TraineeID: "t2", RewardID: "r3", status: "pending", createdAt: addDays(TODAY, -1) }];

export const challenges = [{ ChallengeID: "ch1", challengeName: "שלושה אימונים השבוע", challengeType: "count", targetValue: 3,
  ExerciseID: null as string | null, extraPrize: "בקבוק מים ממותג", weekStart: sundayOf(TODAY),
  completions: [{ TraineeID: "t2", completedAt: addDays(TODAY, -1), prizeDeliveredAt: null as Date | null }] }];

export const payments = [
  { PaymentRequestID: "q1", TraineeID: "t1", paymentType: "monthly", amount: 350, status: "paid", createdAt: addDays(TODAY, -20), invoiceNumber: 1001 as number | null },
  { PaymentRequestID: "q2", TraineeID: "t2", paymentType: "pack10", amount: 600, status: "paid", createdAt: addDays(TODAY, -10), invoiceNumber: 1002 as number | null },
  { PaymentRequestID: "q3", TraineeID: "t1", paymentType: "pack10", amount: 600, status: "open", createdAt: addDays(TODAY, -1), invoiceNumber: null as number | null },
];

export interface Registration { TraineeID: string; status: "registered" | "waitlist" | "offered" | "cancelled"; attended: boolean | null; offerExpiresAt: Date | null }
export interface Klass { ClassID: string; startsAt: Date; place: string; capacity: number; status: "active" | "cancelled"; regs: Registration[] }
const at = (d: Date, hh: number, mm = 0) => { const x = new Date(d); x.setHours(hh, mm, 0, 0); return x; };
const reg = (TraineeID: string, status: Registration["status"] = "registered"): Registration => ({ TraineeID, status, attended: null, offerExpiresAt: null });

export const classes: Klass[] = [
  { ClassID: "k0", startsAt: at(addDays(TODAY, -2), 18, 30), place: "פארק הירקון", capacity: 8, status: "active", regs: [reg("t1"), reg("t2"), reg("t3")] },
  { ClassID: "k1", startsAt: at(TODAY, 18, 30), place: "פארק הירקון", capacity: 8, status: "active", regs: [reg("t1"), reg("t2"), reg("t3")] },
  { ClassID: "k2", startsAt: at(addDays(TODAY, 2), 7), place: "סטודיו", capacity: 3, status: "active", regs: [reg("t2"), reg("t3"), reg("t4"), reg("t1", "waitlist")] },
  { ClassID: "k3", startsAt: at(addDays(TODAY, 4), 19), place: "סטודיו", capacity: 10, status: "active", regs: [reg("t2")] },
];

export const lateRequests: { LateCancelRequestID: string; ClassID: string; TraineeID: string; status: "pending" | "approved" | "rejected" }[] = [];

export const notifications = [{ NotificationID: "n1", TraineeID: "t1", messageText: "המאמן הוסיף הערה לאימון האחרון שלך", createdAt: addDays(TODAY, -1), readAt: null as Date | null }];
