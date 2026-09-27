// Demo data (CLAUDE.md section 7). Synthetic, every name marked "(דוגמה)". Used by the demo adapter only,
// deleted in stage 7. Field names follow the logical ERD. The IDs match supabase/migrations/20260928000005_demo_data.sql,
// so a screen on the demo adapter and a screen on the Endpoint (stage 3 onward) point at the same trainee and exercise.
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

export const coach = { CoachID: "d0000000-0000-4000-8000-000000000001", fullName: "המאמן (דוגמה)" };

export const trainees = [
  { TraineeID: "d0000000-0000-4000-8000-000000001001", fullName: "נועה (דוגמה)", isActive: true, joined: true },
  { TraineeID: "d0000000-0000-4000-8000-000000001002", fullName: "איתי (דוגמה)", isActive: true, joined: true },
  { TraineeID: "d0000000-0000-4000-8000-000000001003", fullName: "מאיה (דוגמה)", isActive: true, joined: true },
  { TraineeID: "d0000000-0000-4000-8000-000000001004", fullName: "רון (דוגמה)", isActive: true, joined: false },
];

export const invites = [{ InviteID: "d0000000-0000-4000-8000-00000000b001", inviteeName: "רון (דוגמה)", status: "open", expiresAt: addDays(TODAY, 6), TraineeID: "d0000000-0000-4000-8000-000000001004" }];

export const exercises = [
  { ExerciseID: "d0000000-0000-4000-8000-000000002001", exerciseName: "סקוואט", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "d0000000-0000-4000-8000-000000002002", exerciseName: "לחיצת חזה", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "d0000000-0000-4000-8000-000000002003", exerciseName: "חתירה בכבל", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "d0000000-0000-4000-8000-000000002004", exerciseName: "מכרעים", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "d0000000-0000-4000-8000-000000002005", exerciseName: "שכיבות סמיכה", isBodyweight: true, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "d0000000-0000-4000-8000-000000002006", exerciseName: "דדליפט רומני", isBodyweight: false, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
  { ExerciseID: "d0000000-0000-4000-8000-000000002007", exerciseName: "לחיצת כתפיים", isBodyweight: false, videoType: null as string | null, videoUrl: null as string | null },
  { ExerciseID: "d0000000-0000-4000-8000-000000002008", exerciseName: "מתח", isBodyweight: true, videoType: "youtube", videoUrl: "https://www.youtube.com/ (דוגמה)" },
];

export interface Item { WorkoutItemID: string; ExerciseID: string; targetSets: number; targetReps: number; targetWeight: number }
export interface Workout { WorkoutID: string; workoutName: string; items: Item[] }
export interface Program { ProgramID: string; TraineeID: string; programName: string; isActive: boolean; createdAt: Date; workouts: Workout[] }

export const programs: Program[] = [
  { ProgramID: "d0000000-0000-4000-8000-000000003001", TraineeID: "d0000000-0000-4000-8000-000000001001", programName: "תוכנית קודמת", isActive: false, createdAt: addDays(TODAY, -70), workouts: [] },
  { ProgramID: "d0000000-0000-4000-8000-000000003002", TraineeID: "d0000000-0000-4000-8000-000000001001", programName: "תוכנית אימון", isActive: true, createdAt: addDays(TODAY, -30), workouts: [
    { WorkoutID: "d0000000-0000-4000-8000-000000004001", workoutName: "אימון A", items: [
      { WorkoutItemID: "d0000000-0000-4000-8000-000000005001", ExerciseID: "d0000000-0000-4000-8000-000000002001", targetSets: 3, targetReps: 8, targetWeight: 60 },
      { WorkoutItemID: "d0000000-0000-4000-8000-000000005002", ExerciseID: "d0000000-0000-4000-8000-000000002002", targetSets: 3, targetReps: 8, targetWeight: 40 },
      { WorkoutItemID: "d0000000-0000-4000-8000-000000005003", ExerciseID: "d0000000-0000-4000-8000-000000002005", targetSets: 3, targetReps: 12, targetWeight: 0 }] },
    { WorkoutID: "d0000000-0000-4000-8000-000000004002", workoutName: "אימון B", items: [
      { WorkoutItemID: "d0000000-0000-4000-8000-000000005004", ExerciseID: "d0000000-0000-4000-8000-000000002006", targetSets: 3, targetReps: 10, targetWeight: 50 },
      { WorkoutItemID: "d0000000-0000-4000-8000-000000005005", ExerciseID: "d0000000-0000-4000-8000-000000002003", targetSets: 3, targetReps: 10, targetWeight: 35 },
      { WorkoutItemID: "d0000000-0000-4000-8000-000000005006", ExerciseID: "d0000000-0000-4000-8000-000000002008", targetSets: 3, targetReps: 6, targetWeight: 0 }] }] },
  { ProgramID: "d0000000-0000-4000-8000-000000003003", TraineeID: "d0000000-0000-4000-8000-000000001002", programName: "תוכנית אימון", isActive: true, createdAt: addDays(TODAY, -20), workouts: [
    { WorkoutID: "d0000000-0000-4000-8000-000000004003", workoutName: "אימון מלא", items: [
      { WorkoutItemID: "d0000000-0000-4000-8000-000000005007", ExerciseID: "d0000000-0000-4000-8000-000000002004", targetSets: 3, targetReps: 10, targetWeight: 12 },
      { WorkoutItemID: "d0000000-0000-4000-8000-000000005008", ExerciseID: "d0000000-0000-4000-8000-000000002002", targetSets: 4, targetReps: 6, targetWeight: 55 }] }] },
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
    logs.push({ WorkoutLogID: `d0000000-0000-4000-8000-00000000600${i}`, TraineeID: "d0000000-0000-4000-8000-000000001001", WorkoutID: w.WorkoutID, workoutName: w.workoutName, performedAt: addDays(TODAY, -i * 3), sets, coachNote: i === 1 ? "שיא יפה בסקוואט (דוגמה)" : null });
  }
})();

export const goals = [{ PersonalGoalID: "d0000000-0000-4000-8000-000000007001", TraineeID: "d0000000-0000-4000-8000-000000001001", ExerciseID: "d0000000-0000-4000-8000-000000002001", targetWeight: 65, status: "active" }];

export const coinTx = [
  { TraineeID: "d0000000-0000-4000-8000-000000001001", eventType: "challenge", eventRef: "ch0-t1", amount: 50, createdAt: addDays(TODAY, -8) },
  { TraineeID: "d0000000-0000-4000-8000-000000001001", eventType: "workout", eventRef: "d0000000-0000-4000-8000-000000006002", amount: 10, createdAt: addDays(TODAY, -6) },
  { TraineeID: "d0000000-0000-4000-8000-000000001001", eventType: "attendance", eventRef: "k0-t1", amount: 5, createdAt: addDays(TODAY, -5) },
  { TraineeID: "d0000000-0000-4000-8000-000000001001", eventType: "workout", eventRef: "d0000000-0000-4000-8000-000000006001", amount: 10, createdAt: addDays(TODAY, -3) },
  { TraineeID: "d0000000-0000-4000-8000-000000001002", eventType: "workout", eventRef: "x-t2", amount: 80, createdAt: addDays(TODAY, -4) },
];

export const rewards = [
  { RewardID: "d0000000-0000-4000-8000-000000007101", rewardName: "כרטיסייה בהנחה", priceCoins: 120, isActive: true },
  { RewardID: "d0000000-0000-4000-8000-000000007102", rewardName: "אימון אישי חינם", priceCoins: 200, isActive: true },
  { RewardID: "d0000000-0000-4000-8000-000000007103", rewardName: "בקבוק מים ממותג", priceCoins: 60, isActive: true },
];
export const redemptions = [{ RedemptionID: "d0000000-0000-4000-8000-000000007201", TraineeID: "d0000000-0000-4000-8000-000000001002", RewardID: "d0000000-0000-4000-8000-000000007103", status: "pending", createdAt: addDays(TODAY, -1) }];

export const challenges = [{ ChallengeID: "d0000000-0000-4000-8000-000000008001", challengeName: "שלושה אימונים השבוע", challengeType: "count", targetValue: 3,
  ExerciseID: null as string | null, extraPrize: "בקבוק מים ממותג", weekStart: sundayOf(TODAY),
  completions: [{ TraineeID: "d0000000-0000-4000-8000-000000001002", completedAt: addDays(TODAY, -1), prizeDeliveredAt: null as Date | null }] }];

export const payments = [
  { PaymentRequestID: "d0000000-0000-4000-8000-000000009001", TraineeID: "d0000000-0000-4000-8000-000000001001", paymentType: "monthly", amount: 350, status: "paid", createdAt: addDays(TODAY, -20), invoiceNumber: 1001 as number | null },
  { PaymentRequestID: "d0000000-0000-4000-8000-000000009002", TraineeID: "d0000000-0000-4000-8000-000000001002", paymentType: "pack10", amount: 600, status: "paid", createdAt: addDays(TODAY, -10), invoiceNumber: 1002 as number | null },
  { PaymentRequestID: "d0000000-0000-4000-8000-000000009003", TraineeID: "d0000000-0000-4000-8000-000000001001", paymentType: "pack10", amount: 600, status: "open", createdAt: addDays(TODAY, -1), invoiceNumber: null as number | null },
];

export interface Registration { TraineeID: string; status: "registered" | "waitlist" | "offered" | "cancelled"; attended: boolean | null; offerExpiresAt: Date | null }
export interface Klass { ClassID: string; startsAt: Date; place: string; capacity: number; status: "active" | "cancelled"; regs: Registration[] }
const at = (d: Date, hh: number, mm = 0) => { const x = new Date(d); x.setHours(hh, mm, 0, 0); return x; };
const reg = (TraineeID: string, status: Registration["status"] = "registered"): Registration => ({ TraineeID, status, attended: null, offerExpiresAt: null });

export const classes: Klass[] = [
  { ClassID: "d0000000-0000-4000-8000-00000000a000", startsAt: at(addDays(TODAY, -2), 18, 30), place: "פארק הירקון", capacity: 8, status: "active", regs: [reg("d0000000-0000-4000-8000-000000001001"), reg("d0000000-0000-4000-8000-000000001002"), reg("d0000000-0000-4000-8000-000000001003")] },
  { ClassID: "d0000000-0000-4000-8000-00000000a001", startsAt: at(TODAY, 18, 30), place: "פארק הירקון", capacity: 8, status: "active", regs: [reg("d0000000-0000-4000-8000-000000001001"), reg("d0000000-0000-4000-8000-000000001002"), reg("d0000000-0000-4000-8000-000000001003")] },
  { ClassID: "d0000000-0000-4000-8000-00000000a002", startsAt: at(addDays(TODAY, 2), 7), place: "סטודיו", capacity: 3, status: "active", regs: [reg("d0000000-0000-4000-8000-000000001002"), reg("d0000000-0000-4000-8000-000000001003"), reg("d0000000-0000-4000-8000-000000001004"), reg("d0000000-0000-4000-8000-000000001001", "waitlist")] },
  { ClassID: "d0000000-0000-4000-8000-00000000a003", startsAt: at(addDays(TODAY, 4), 19), place: "סטודיו", capacity: 10, status: "active", regs: [reg("d0000000-0000-4000-8000-000000001002")] },
];

export const lateRequests: { LateCancelRequestID: string; ClassID: string; TraineeID: string; status: "pending" | "approved" | "rejected" }[] = [];

export const notifications = [{ NotificationID: "d0000000-0000-4000-8000-00000000e001", TraineeID: "d0000000-0000-4000-8000-000000001001", messageText: "המאמן הוסיף הערה לאימון האחרון שלך", createdAt: addDays(TODAY, -1), readAt: null as Date | null }];
