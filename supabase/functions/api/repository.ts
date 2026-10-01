// C04 Repository: the only file that creates a database or storage client (CLAUDE.md rule 5).
// Modules and the core call it through business-named operations and never see table names.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Role = "owner" | "coach" | "trainee";

export interface Actor {
  role: Role;               // the role of this request; the Orchestrator sets it from the Registry row (map v11)
  roles?: Role[];           // every role of the identity user, owner first (rule 10)
  businessID?: string | null; // the business: the owner's, the coach's, or the trainee's coach's (rule 9)
  coachID: string;          // the coach this actor belongs to (self for a coach); empty for the owner's role
  traineeID: string | null; // set for a trainee
  fullName?: string;
  // I01: the identity user. A newcomer (signed up, not yet a trainee) has no coachID and may only join (map v9).
  authUserID?: string;
  email?: string;
}

// UC4 step 5, one action in the database (0012): joined, or why not.
export type JoinResult = { status: "joined"; traineeID: string } | { status: "expired" } | { status: "taken" };
// UC12 step 7, the same for a coach (0013).
export type CoachJoinResult = { status: "joined"; coachID: string } | { status: "expired" } | { status: "taken" };

// A coach of the business (UC12 steps 3, 8), and an open coach invite that has not expired.
export interface BusinessCoach {
  CoachID: string;
  fullName: string;
}

export interface CoachInvite {
  CoachInviteID: string;
  inviteeName: string;
}

export interface AuditRecord {
  requestID: string;
  caller: string;
  moduleName: string;
  actionName: string;
  isOk: boolean;
  errorCode: string | null;
}

export interface Exercise {
  ExerciseID: string;
  exerciseName: string;
  isBodyweight: boolean;
  videoType: string | null;
  videoUrl: string | null;
}

export interface ProgramItem {
  WorkoutItemID: string;
  ExerciseID: string;
  sortOrder: number;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  exerciseName: string;
  hasVideo: boolean;
}

export interface Program {
  ProgramID: string;
  TraineeID: string;
  programName: string;
  isActive: boolean;
  createdAt: string;
  workouts: { WorkoutID: string; workoutName: string; sortOrder: number; items: ProgramItem[] }[];
}

// What the program builder sends: IDs of rows that exist, or screen-made IDs for new ones.
export interface WorkoutDraft {
  WorkoutID: string;
  workoutName: string;
  items: { WorkoutItemID: string; ExerciseID: string; targetSets: number; targetReps: number; targetWeight: number }[];
}

// One row of the trainee list: a joined trainee, or an open invite (no TraineeID until joining; stage 4a plan, gap 3).
export interface TraineeListRow {
  TraineeID: string | null;
  InviteID: string | null;
  fullName: string;
  isActive: boolean;
  joined: boolean;
  hasProgram: boolean;
}

export interface NewInvite {
  inviteeName: string;
  inviteeEmail: string | null;
  token: string;
  expiresAt: string;
}

// One set as the trainee saves it; a set not done is kept with isDone false (UC3 alternative a).
export interface SetEntry {
  ExerciseID: string;
  setNumber: number;
  reps: number;
  weight: number;
  isDone: boolean;
}

export interface SetResult extends SetEntry {
  SetResultID: string;
  exerciseName: string;
  isCorrected: boolean;
}

export interface WorkoutLog {
  WorkoutLogID: string;
  TraineeID: string;
  WorkoutID: string;
  workoutName: string;
  performedAt: string;
  sets: SetResult[];
}

export interface SetCorrection {
  SetResultID: string;
  reps: number;
  weight: number;
  isDone: boolean;
}

// One note a coach wrote on a performed workout (UC6 steps 7-9).
export interface CoachNote {
  WorkoutLogID: string;
  noteText: string;
  createdAt: string;
}

// The active personal goal, with what the goal check needs from its exercise (UC7 step 1).
export interface PersonalGoal {
  PersonalGoalID: string;
  TraineeID: string;
  ExerciseID: string;
  exerciseName: string;
  isBodyweight: boolean;
  targetWeight: number;
}

// One line of the coins ledger; the balance is their sum and is never stored (Business Logic rule 7).
export interface CoinTransaction {
  eventType: string;
  eventRef: string;
  amount: number;
  createdAt: string;
}

export interface Reward {
  RewardID: string;
  rewardName: string;
  priceCoins: number;
  isActive: boolean;
}

export interface Redemption {
  RedemptionID: string;
  TraineeID: string;
  fullName: string;
  RewardID: string;
  rewardName: string;
  status: "pending" | "delivered";
  deliveredAt: string | null;
  createdAt: string;
}

export type RedeemResult =
  | { status: "ok"; balance: number }
  | { status: "insufficient"; balance: number }
  | { status: "no_reward" };

export interface Challenge {
  ChallengeID: string;
  challengeName: string;
  challengeType: "count" | "exercise";
  targetValue: number;
  ExerciseID: string | null;
  exerciseName: string | null;
  extraPrize: string | null;
  weekStart: string; // a Sunday, yyyy-mm-dd (UC8 step 3)
}

export interface NewChallenge {
  challengeName: string;
  challengeType: "count" | "exercise";
  targetValue: number;
  ExerciseID: string | null;
  extraPrize: string | null;
  weekStart: string;
}

export interface ChallengeCompletion {
  TraineeID: string;
  fullName: string;
  completedAt: string;
  prizeDeliveredAt: string | null;
}

// One trainee's place in a class (UC11 steps 4-9). The ERD keeps one row per class and trainee.
export interface ClassRegistration {
  ClassRegistrationID: string;
  TraineeID: string;
  fullName: string;
  status: "registered" | "waitlist" | "offered" | "cancelled";
  waitlistPosition: number | null;
  offerExpiresAt: string | null;
  attended: boolean | null;
}

export interface GroupClass {
  ClassID: string;
  CoachID: string;
  startsAt: string;
  place: string;
  capacity: number;
  status: "active" | "cancelled";
  registrations: ClassRegistration[];
}

// What the atomic registration functions return (migration 0010): offered lists the trainees who got a spot now.
export interface SpotResult {
  status: "registered" | "waitlist" | "already" | "closed" | "ok" | "none" | "expired";
  position?: number | null;
  offered: string[];
}

export interface LateCancelRequest {
  LateCancelRequestID: string;
  ClassRegistrationID: string;
  ClassID: string;
  CoachID: string;
  TraineeID: string;
  fullName: string;
  startsAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface Notification {
  NotificationID: string;
  messageText: string;
  createdAt: string;
}

// A payment request (UC2 steps 3, 7). The invoice number is read along the ERD link to INVOICES, read only (map v8).
export interface PaymentRequest {
  PaymentRequestID: string;
  TraineeID: string;
  CoachID: string;
  fullName: string;
  paymentType: string;
  amount: number;
  status: "open" | "paid";
  createdAt: string;
  paidAt: string | null;
  invoiceNumber: number | null;
}

// A demo invoice (UC2 steps 8-10). The trainee and the payment type are read along the same link, read only (map v8).
export interface Invoice {
  invoiceNumber: number;
  PaymentRequestID: string;
  TraineeID: string;
  fullName: string;
  paymentType: string;
  amount: number;
  issuedAt: string;
  isDemo: boolean;
}

export interface Repository {
  findActorByAuthUser(authUserID: string): Promise<Actor | null>;
  isRegistered(caller: string, moduleName: string, actionName: string, role: string): Promise<boolean>;
  writeAudit(entry: AuditRecord): Promise<void>;
  // SETTINGS belong to the business (rule 9; 0013).
  getBusinessSettings(businessID: string): Promise<Record<string, string>>;
  // ERROR_CODES (C05): for each code, the text for people.
  listErrorTexts(): Promise<Record<string, string>>;
  // Training (UC1): trainees, exercises, programs.
  isActiveTraineeOfCoach(traineeID: string, coachID: string): Promise<boolean>;
  listExercisesForCoach(coachID: string): Promise<Exercise[]>;
  getActiveProgram(traineeID: string): Promise<Program | null>;
  listInactivePrograms(traineeID: string): Promise<{ programName: string; createdAt: string }[]>;
  saveProgram(programID: string, workouts: WorkoutDraft[]): Promise<void>;
  swapExercise(workoutItemID: string, exerciseID: string): Promise<void>;
  startNewProgram(traineeID: string, programName: string, workoutName: string): Promise<string>;
  // Trainees and invites (UC4 steps 2, 6). hasProgram is read from the core "program" entity (stage 4a plan, decision 4).
  listTraineesForCoach(coachID: string): Promise<TraineeListRow[]>;
  createInvite(coachID: string, invite: NewInvite): Promise<string>;
  // UC4 step 5 (stage 5 plan, decision 3): the trainee is created and the invite closed together.
  acceptInvite(token: string, authUserID: string, fullName: string, email: string): Promise<JoinResult>;
  // I04 File Storage (UC10 steps 4, 5; map v9). The addresses are the ones the browser reaches. null: the store refused.
  createVideoUploadAddress(path: string): Promise<string | null>;
  // The viewing address of an uploaded file, or null when it is not in the bucket (the upload did not finish).
  uploadedVideoAddress(path: string): Promise<string | null>;
  // Exercises (UC1, UC10 step 5). In reach: active, and ready-made or the coach's own; the same for the coach's trainees.
  createExercise(coachID: string, exerciseName: string, isBodyweight: boolean): Promise<Exercise>;
  getExerciseInReach(exerciseID: string, coachID: string): Promise<Exercise | null>;
  attachVideo(exerciseID: string, videoType: "youtube" | "upload", videoUrl: string): Promise<Exercise>;
  // Results (UC3 steps 6, 9 and c2). Saving and correcting are atomic.
  logWorkout(traineeID: string, workoutID: string, sets: SetEntry[]): Promise<string>;
  getWorkoutLog(workoutLogID: string): Promise<WorkoutLog | null>;
  correctResults(workoutLogID: string, corrections: SetCorrection[]): Promise<void>;
  listResults(traineeID: string): Promise<WorkoutLog[]>;
  // Progress (UC5 step 3): the exercises of the trainee's own results, whether active or swapped out since.
  getExercisesByID(exerciseIDs: string[]): Promise<Exercise[]>;
  // Feedback (UC6 steps 7-9): the coach's notes, private to M06.
  addCoachNote(workoutLogID: string, coachID: string, noteText: string): Promise<void>;
  listCoachNotes(traineeID: string): Promise<CoachNote[]>;
  // Coins (UC7), private to M07. awardCoins is false when the event was already credited (one award per event).
  awardCoins(traineeID: string, eventType: string, eventRef: string, amount: number): Promise<boolean>;
  listCoinTransactions(traineeID: string): Promise<CoinTransaction[]>;
  getActiveGoal(traineeID: string): Promise<PersonalGoal | null>;
  setPersonalGoal(traineeID: string, exerciseID: string, targetWeight: number): Promise<void>;
  achieveGoal(personalGoalID: string, amount: number): Promise<boolean>;
  listRewards(coachID: string): Promise<Reward[]>;
  addReward(coachID: string, rewardName: string, priceCoins: number): Promise<void>;
  listRedemptions(coachID: string): Promise<Redemption[]>;
  redeemReward(traineeID: string, rewardID: string): Promise<RedeemResult>;
  markRewardDelivered(redemptionID: string, coachID: string): Promise<boolean>;
  // Challenges (UC8), private to M08. createChallenge is null when the week already has one (CHALLENGE_EXISTS).
  getChallengeForWeek(coachID: string, weekStart: string): Promise<Challenge | null>;
  createChallenge(coachID: string, challenge: NewChallenge): Promise<string | null>;
  listCompletions(challengeID: string): Promise<ChallengeCompletion[]>;
  addCompletion(challengeID: string, traineeID: string): Promise<string | null>;
  markPrizeDelivered(challengeID: string, traineeID: string): Promise<boolean>;
  // Classes (UC11), private to M11. Registering and freeing a spot are atomic (migration 0010).
  publishClass(coachID: string, startsAt: string, place: string, capacity: number): Promise<string>;
  getClass(classID: string): Promise<GroupClass | null>;
  listClasses(coachID: string, from: string): Promise<GroupClass[]>;
  cancelClass(classID: string): Promise<boolean>;
  registerForClass(classID: string, traineeID: string, offerHours: number): Promise<SpotResult>;
  releaseSpot(classID: string, traineeID: string | null, op: "cancel" | "accept" | "decline" | "expire", offerHours: number): Promise<SpotResult>;
  setAttendance(classID: string, present: string[]): Promise<{ ClassRegistrationID: string; TraineeID: string }[]>;
  addLateCancelRequest(classRegistrationID: string): Promise<void>;
  listLateCancelRequests(coachID: string): Promise<LateCancelRequest[]>;
  getLateCancelRequest(requestID: string): Promise<LateCancelRequest | null>;
  decideLateCancelRequest(requestID: string, approve: boolean): Promise<boolean>;
  // Notifications (UC11 step 7 and c, UC6 step 9), private to M12. Unread only, newest first.
  addNotification(traineeID: string, messageText: string): Promise<void>;
  listUnreadNotifications(traineeID: string): Promise<Notification[]>;
  markNotificationRead(notificationID: string, traineeID: string): Promise<boolean>;
  // Payments (UC2), private to M09. A null traineeID lists all the coach's trainees; newest first.
  createPaymentRequest(coachID: string, traineeID: string, paymentType: string, amount: number): Promise<string>;
  getPaymentRequest(paymentRequestID: string): Promise<PaymentRequest | null>;
  listPaymentRequests(coachID: string, traineeID: string | null): Promise<PaymentRequest[]>;
  // Open to paid only: false when the request was already paid (UC2 b, and two payments at once).
  markPaymentPaid(paymentRequestID: string): Promise<boolean>;
  // Invoices (UC2 steps 8-10), private to M10. One per request: a second call returns the same number (map v8).
  createInvoice(paymentRequestID: string, amount: number): Promise<number>;
  listInvoices(coachID: string, traineeID: string | null): Promise<Invoice[]>;
  // Settings (M14): the given keys in one statement, all or nothing.
  updateBusinessSettings(businessID: string, values: Record<string, string>): Promise<void>;
  // The business (UC12; 0013), private to M15 apart from the reach of the owner (rule 5).
  // The owner's reach (rule 5; stage 4e plan, decision 5): the active coaches of the business, or the one asked (coachID
  // as the request sent it) when it is one of them; null when it is not, or is not an ID (NOT_ALLOWED).
  coachesInReach(businessID: string | null | undefined, coachID: unknown): Promise<string[] | null>;
  listBusinessCoaches(businessID: string): Promise<BusinessCoach[]>;
  listOpenCoachInvites(businessID: string): Promise<CoachInvite[]>;
  createCoachInvite(businessID: string, invite: NewInvite): Promise<string>;
  // UC12 step 7: the coach is created with the invite's business and the invite closed together.
  acceptCoachInvite(token: string, authUserID: string, fullName: string, email: string): Promise<CoachJoinResult>;
  // The business of an active trainee, through their coach; null when there is none.
  businessOfTrainee(traineeID: string): Promise<string | null>;
  // How many workouts each trainee saved since the given time: counts only, no sets (rule 5, the owner).
  countWorkoutsSince(traineeIDs: string[], since: string): Promise<Record<string, number>>;
}

export class StorageUnavailable extends Error {}

export function createRepository(): Repository {
  const db: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // I04: the bucket of uploaded videos (0012). Locally SUPABASE_URL is inside Docker, so the addresses given to the
  // browser use PUBLIC_API_URL when it is set (CLAUDE.md v6, section 3).
  const videos = db.storage.from("videos");
  const internalURL = Deno.env.get("SUPABASE_URL")!;
  const publicURL = Deno.env.get("PUBLIC_API_URL") || internalURL;
  const forBrowser = (url: string) => url.startsWith(internalURL) ? publicURL + url.slice(internalURL.length) : url;

  const must = <T>(res: { data: T; error: unknown }): T => {
    if (res.error) throw new StorageUnavailable(String((res.error as { message?: string }).message ?? res.error));
    return res.data;
  };
  // An insert that a unique constraint refused is "already there" (false); any other error is the database failing.
  const inserted = (res: { error: { code?: string; message?: string } | null }): boolean => {
    if (res.error?.code === "23505") return false;
    if (res.error) throw new StorageUnavailable(String(res.error.message ?? res.error));
    return true;
  };

  return {
    // Every role of the identity user (map v11): owner, coach, trainee, in that order. An owner may also be a coach
    // in the same business (rule 10); a trainee is never either.
    async findActorByAuthUser(authUserID) {
      const [owner, coach, trainee] = await Promise.all([
        db.from("owners").select('"BusinessID","fullName"').eq("authUserID", authUserID).eq("isActive", true).maybeSingle(),
        db.from("coaches").select('"CoachID","BusinessID","fullName"').eq("authUserID", authUserID).eq("isActive", true).maybeSingle(),
        db.from("trainees").select('"TraineeID","CoachID","fullName",coaches("BusinessID")').eq("authUserID", authUserID).eq("isActive", true).maybeSingle(),
      ]);
      const o = must(owner) as { BusinessID: string; fullName: string } | null;
      const c = must(coach) as { CoachID: string; BusinessID: string; fullName: string } | null;
      const t = must(trainee) as unknown as { TraineeID: string; CoachID: string; fullName: string; coaches: { BusinessID: string } } | null;
      const roles: Role[] = [...(o ? ["owner" as const] : []), ...(c ? ["coach" as const] : []), ...(!o && !c && t ? ["trainee" as const] : [])];
      if (!roles.length) return null;
      return {
        role: roles[0],
        roles,
        businessID: o?.BusinessID ?? c?.BusinessID ?? t?.coaches.BusinessID ?? null,
        coachID: c?.CoachID ?? (roles[0] === "trainee" ? t!.CoachID : ""),
        traineeID: roles[0] === "trainee" ? t!.TraineeID : null,
        fullName: c?.fullName ?? o?.fullName ?? t?.fullName,
      };
    },

    async listErrorTexts() {
      const rows = must(await db.from("error_codes").select('"errorCode","humanText"')) as { errorCode: string; humanText: string }[];
      return Object.fromEntries(rows.map((r) => [r.errorCode, r.humanText]));
    },

    async isRegistered(caller, moduleName, actionName, role) {
      const row = must(await db.from("registry_entries").select('"RegistryEntryID"')
        .eq("caller", caller).eq("moduleName", moduleName).eq("actionName", actionName)
        .eq("allowedRole", role).eq("isActive", true).maybeSingle());
      return row !== null;
    },

    async writeAudit(entry) {
      must(await db.from("audit_entries").insert(entry));
    },

    async getBusinessSettings(businessID) {
      const rows = must(await db.from("settings").select('"settingKey","settingValue"').eq("BusinessID", businessID)) as
        { settingKey: string; settingValue: string }[];
      return Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue]));
    },

    async isActiveTraineeOfCoach(traineeID, coachID) {
      const row = must(await db.from("trainees").select('"TraineeID"')
        .eq("TraineeID", traineeID).eq("CoachID", coachID).eq("isActive", true).maybeSingle());
      return row !== null;
    },

    async listExercisesForCoach(coachID) {
      // The ready-made list (no coach) and the coach's own, active only.
      return must(await db.from("exercises").select('"ExerciseID","exerciseName","isBodyweight","videoType","videoUrl"')
        .eq("isActive", true).or(`CoachID.is.null,CoachID.eq.${coachID}`).order("exerciseName")) as Exercise[];
    },

    async getActiveProgram(traineeID) {
      type Row = Omit<Program, "workouts"> & {
        workouts: { WorkoutID: string; workoutName: string; sortOrder: number;
          workout_items: (Omit<ProgramItem, "exerciseName" | "hasVideo"> & { exercises: { exerciseName: string; videoType: string | null } })[] }[];
      };
      const row = must(await db.from("programs")
        .select('"ProgramID","TraineeID","programName","isActive","createdAt",' +
          'workouts("WorkoutID","workoutName","sortOrder",' +
          'workout_items("WorkoutItemID","ExerciseID","sortOrder","targetSets","targetReps","targetWeight",exercises("exerciseName","videoType")))')
        .eq("TraineeID", traineeID).eq("isActive", true).maybeSingle()) as Row | null;
      if (!row) return null;
      const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
      return {
        ProgramID: row.ProgramID, TraineeID: row.TraineeID, programName: row.programName, isActive: row.isActive, createdAt: row.createdAt,
        workouts: row.workouts.sort(bySort).map((w) => ({
          WorkoutID: w.WorkoutID, workoutName: w.workoutName, sortOrder: w.sortOrder,
          items: w.workout_items.sort(bySort).map(({ exercises, ...i }) => ({
            ...i, targetWeight: Number(i.targetWeight), exerciseName: exercises.exerciseName, hasVideo: exercises.videoType !== null,
          })),
        })),
      };
    },

    async listInactivePrograms(traineeID) {
      return must(await db.from("programs").select('"programName","createdAt"')
        .eq("TraineeID", traineeID).eq("isActive", false).order("createdAt", { ascending: false })) as
        { programName: string; createdAt: string }[];
    },

    async saveProgram(programID, workouts) {
      must(await db.rpc("program_save", { p_program: programID, p_workouts: workouts }));
    },

    async swapExercise(workoutItemID, exerciseID) {
      // Same row, same sortOrder (Business Logic rule 2); past results point at the exercise, not the item.
      must(await db.from("workout_items").update({ ExerciseID: exerciseID }).eq("WorkoutItemID", workoutItemID));
    },

    async startNewProgram(traineeID, programName, workoutName) {
      return must(await db.rpc("program_start_new", { p_trainee: traineeID, p_program_name: programName, p_workout_name: workoutName })) as string;
    },

    async listTraineesForCoach(coachID) {
      const trainees = must(await db.from("trainees").select('"TraineeID","fullName","isActive",programs("ProgramID")')
        .eq("CoachID", coachID).eq("programs.isActive", true).order("fullName")) as
        { TraineeID: string; fullName: string; isActive: boolean; programs: { ProgramID: string }[] }[];
      // An open invite that has not expired is a trainee in the "invited" state (map section 2).
      const invites = must(await db.from("invites").select('"InviteID","inviteeName"')
        .eq("CoachID", coachID).eq("status", "open").gt("expiresAt", new Date().toISOString()).order("createdAt")) as
        { InviteID: string; inviteeName: string }[];
      return [
        ...trainees.map((t) => ({ TraineeID: t.TraineeID, InviteID: null, fullName: t.fullName, isActive: t.isActive, joined: true, hasProgram: t.programs.length > 0 })),
        ...invites.map((i) => ({ TraineeID: null, InviteID: i.InviteID, fullName: i.inviteeName, isActive: true, joined: false, hasProgram: false })),
      ];
    },

    async createInvite(coachID, invite) {
      const row = must(await db.from("invites").insert({ CoachID: coachID, ...invite }).select('"InviteID"').single()) as { InviteID: string };
      return row.InviteID;
    },

    async acceptInvite(token, authUserID, fullName, email) {
      return must(await db.rpc("trainees_accept_invite", { p_token: token, p_auth: authUserID, p_name: fullName, p_email: email })) as JoinResult;
    },

    async createVideoUploadAddress(path) {
      const res = await videos.createSignedUploadUrl(path);
      return res.error ? null : forBrowser(res.data.signedUrl);
    },

    async uploadedVideoAddress(path) {
      const slash = path.lastIndexOf("/");
      const res = await videos.list(path.slice(0, slash), { search: path.slice(slash + 1) });
      if (res.error) return null;
      if (!res.data.some((f) => f.name === path.slice(slash + 1))) return null;
      return forBrowser(videos.getPublicUrl(path).data.publicUrl);
    },

    async createExercise(coachID, exerciseName, isBodyweight) {
      return must(await db.from("exercises").insert({ CoachID: coachID, exerciseName, isBodyweight })
        .select(EXERCISE_FIELDS).single()) as Exercise;
    },

    async getExerciseInReach(exerciseID, coachID) {
      return must(await db.from("exercises").select(EXERCISE_FIELDS)
        .eq("ExerciseID", exerciseID).eq("isActive", true).or(`CoachID.is.null,CoachID.eq.${coachID}`).maybeSingle()) as Exercise | null;
    },

    async attachVideo(exerciseID, videoType, videoUrl) {
      // One video per exercise: a new one replaces the old in every program (UC10 alternative e).
      return must(await db.from("exercises").update({ videoType, videoUrl }).eq("ExerciseID", exerciseID)
        .select(EXERCISE_FIELDS).single()) as Exercise;
    },

    async logWorkout(traineeID, workoutID, sets) {
      return must(await db.rpc("results_log_workout", { p_trainee: traineeID, p_workout: workoutID, p_sets: sets })) as string;
    },

    async getWorkoutLog(workoutLogID) {
      const row = must(await db.from("workout_logs").select(LOG_FIELDS).eq("WorkoutLogID", workoutLogID).maybeSingle()) as LogRow | null;
      return row ? toWorkoutLog(row) : null;
    },

    async correctResults(workoutLogID, corrections) {
      must(await db.rpc("results_correct", { p_log: workoutLogID, p_sets: corrections }));
    },

    async listResults(traineeID) {
      const rows = must(await db.from("workout_logs").select(LOG_FIELDS)
        .eq("TraineeID", traineeID).order("performedAt", { ascending: false })) as unknown as LogRow[];
      return rows.map(toWorkoutLog);
    },

    async getExercisesByID(exerciseIDs) {
      if (exerciseIDs.length === 0) return [];
      return must(await db.from("exercises").select(EXERCISE_FIELDS).in("ExerciseID", exerciseIDs)) as Exercise[];
    },

    async addCoachNote(workoutLogID, coachID, noteText) {
      must(await db.from("coach_notes").insert({ WorkoutLogID: workoutLogID, CoachID: coachID, noteText }));
    },

    async listCoachNotes(traineeID) {
      const rows = must(await db.from("coach_notes").select('"WorkoutLogID","noteText","createdAt",workout_logs!inner("TraineeID")')
        .eq("workout_logs.TraineeID", traineeID).order("createdAt")) as unknown as (CoachNote & { workout_logs: unknown })[];
      return rows.map(({ workout_logs: _, ...n }) => n);
    },

    async awardCoins(traineeID, eventType, eventRef, amount) {
      return inserted(await db.from("coin_transactions").insert({ TraineeID: traineeID, eventType, eventRef, amount }));
    },

    async listCoinTransactions(traineeID) {
      return must(await db.from("coin_transactions").select('"eventType","eventRef","amount","createdAt"')
        .eq("TraineeID", traineeID).order("createdAt", { ascending: false })) as CoinTransaction[];
    },

    async getActiveGoal(traineeID) {
      const row = must(await db.from("personal_goals").select('"PersonalGoalID","TraineeID","ExerciseID","targetWeight",exercises("exerciseName","isBodyweight")')
        .eq("TraineeID", traineeID).eq("status", "active").maybeSingle()) as
        (Omit<PersonalGoal, "exerciseName" | "isBodyweight"> & { exercises: { exerciseName: string; isBodyweight: boolean } }) | null;
      if (!row) return null;
      const { exercises, ...g } = row;
      return { ...g, targetWeight: Number(g.targetWeight), exerciseName: exercises.exerciseName, isBodyweight: exercises.isBodyweight };
    },

    async setPersonalGoal(traineeID, exerciseID, targetWeight) {
      // A change to the active goal updates it; a new row only when none is active (stage 4b plan, decision 6).
      const updated = must(await db.from("personal_goals").update({ ExerciseID: exerciseID, targetWeight })
        .eq("TraineeID", traineeID).eq("status", "active").select('"PersonalGoalID"')) as unknown[];
      if (updated.length === 0) must(await db.from("personal_goals").insert({ TraineeID: traineeID, ExerciseID: exerciseID, targetWeight }));
    },

    async achieveGoal(personalGoalID, amount) {
      return must(await db.rpc("coins_achieve_goal", { p_goal: personalGoalID, p_amount: amount })) as boolean;
    },

    async listRewards(coachID) {
      return must(await db.from("rewards").select('"RewardID","rewardName","priceCoins","isActive"')
        .eq("CoachID", coachID).eq("isActive", true).order("priceCoins")) as Reward[];
    },

    async addReward(coachID, rewardName, priceCoins) {
      must(await db.from("rewards").insert({ CoachID: coachID, rewardName, priceCoins }));
    },

    async listRedemptions(coachID) {
      type Row = Omit<Redemption, "fullName" | "rewardName" | "createdAt"> & {
        trainees: { fullName: string }; rewards: { rewardName: string }; coin_transactions: { createdAt: string };
      };
      const rows = must(await db.from("redemptions")
        .select('"RedemptionID","TraineeID","RewardID","status","deliveredAt",trainees!inner("fullName","CoachID"),rewards("rewardName"),coin_transactions("createdAt")')
        .eq("trainees.CoachID", coachID)) as unknown as Row[];
      return rows
        .map(({ trainees, rewards, coin_transactions, ...r }) => ({
          ...r, fullName: trainees.fullName, rewardName: rewards.rewardName, createdAt: coin_transactions.createdAt,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async redeemReward(traineeID, rewardID) {
      return must(await db.rpc("coins_redeem", { p_trainee: traineeID, p_reward: rewardID })) as RedeemResult;
    },

    async markRewardDelivered(redemptionID, coachID) {
      const row = must(await db.from("redemptions").select('"RedemptionID",trainees!inner("CoachID")')
        .eq("RedemptionID", redemptionID).eq("trainees.CoachID", coachID).maybeSingle());
      if (!row) return false;
      must(await db.from("redemptions").update({ status: "delivered", deliveredAt: new Date().toISOString() })
        .eq("RedemptionID", redemptionID).eq("status", "pending"));
      return true;
    },

    async getChallengeForWeek(coachID, weekStart) {
      const row = must(await db.from("challenges").select(CHALLENGE_FIELDS)
        .eq("CoachID", coachID).eq("weekStart", weekStart).maybeSingle()) as ChallengeRow | null;
      return row ? toChallenge(row) : null;
    },

    async createChallenge(coachID, challenge) {
      const res = await db.from("challenges").insert({ CoachID: coachID, ...challenge }).select('"ChallengeID"').single();
      return inserted(res) ? (res.data as { ChallengeID: string }).ChallengeID : null;
    },

    async listCompletions(challengeID) {
      const rows = must(await db.from("challenge_completions").select('"TraineeID","completedAt","prizeDeliveredAt",trainees("fullName")')
        .eq("ChallengeID", challengeID).order("completedAt")) as unknown as (Omit<ChallengeCompletion, "fullName"> & { trainees: { fullName: string } })[];
      return rows.map(({ trainees, ...c }) => ({ ...c, fullName: trainees.fullName }));
    },

    async addCompletion(challengeID, traineeID) {
      const res = await db.from("challenge_completions").insert({ ChallengeID: challengeID, TraineeID: traineeID })
        .select('"ChallengeCompletionID"').single();
      return inserted(res) ? (res.data as { ChallengeCompletionID: string }).ChallengeCompletionID : null;
    },

    async markPrizeDelivered(challengeID, traineeID) {
      const rows = must(await db.from("challenge_completions").update({ prizeDeliveredAt: new Date().toISOString() })
        .eq("ChallengeID", challengeID).eq("TraineeID", traineeID).is("prizeDeliveredAt", null).select('"ChallengeCompletionID"')) as unknown[];
      if (rows.length > 0) return true;
      // Already delivered is not an error; no completion at all is.
      const exists = must(await db.from("challenge_completions").select('"ChallengeCompletionID"')
        .eq("ChallengeID", challengeID).eq("TraineeID", traineeID).maybeSingle());
      return exists !== null;
    },

    async publishClass(coachID, startsAt, place, capacity) {
      const row = must(await db.from("classes").insert({ CoachID: coachID, startsAt, place, capacity })
        .select('"ClassID"').single()) as { ClassID: string };
      return row.ClassID;
    },

    async getClass(classID) {
      const row = must(await db.from("classes").select(CLASS_FIELDS).eq("ClassID", classID).maybeSingle()) as ClassRow | null;
      return row ? toClass(row) : null;
    },

    async listClasses(coachID, from) {
      const rows = must(await db.from("classes").select(CLASS_FIELDS)
        .eq("CoachID", coachID).gte("startsAt", from).order("startsAt")) as unknown as ClassRow[];
      return rows.map(toClass);
    },

    async cancelClass(classID) {
      const rows = must(await db.from("classes").update({ status: "cancelled" })
        .eq("ClassID", classID).eq("status", "active").select('"ClassID"')) as unknown[];
      return rows.length > 0;
    },

    async registerForClass(classID, traineeID, offerHours) {
      return must(await db.rpc("classes_register", { p_class: classID, p_trainee: traineeID, p_hours: offerHours })) as SpotResult;
    },

    async releaseSpot(classID, traineeID, op, offerHours) {
      return must(await db.rpc("classes_release_spot", { p_class: classID, p_trainee: traineeID, p_op: op, p_hours: offerHours })) as SpotResult;
    },

    async setAttendance(classID, present) {
      // Only registered trainees are marked (UC11 step 9); everyone else registered is marked absent.
      const marked = must(await db.from("class_registrations").update({ attended: true })
        .eq("ClassID", classID).eq("status", "registered").in("TraineeID", present)
        .select('"ClassRegistrationID","TraineeID"')) as { ClassRegistrationID: string; TraineeID: string }[];
      let absent = db.from("class_registrations").update({ attended: false }).eq("ClassID", classID).eq("status", "registered");
      if (present.length) absent = absent.not("TraineeID", "in", `(${present.join(",")})`);
      must(await absent);
      return marked;
    },

    async addLateCancelRequest(classRegistrationID) {
      const pending = must(await db.from("late_cancel_requests").select('"LateCancelRequestID"')
        .eq("ClassRegistrationID", classRegistrationID).eq("status", "pending").limit(1)) as unknown[];
      if (pending.length === 0) must(await db.from("late_cancel_requests").insert({ ClassRegistrationID: classRegistrationID }));
    },

    async listLateCancelRequests(coachID) {
      const rows = must(await db.from("late_cancel_requests").select(LATE_FIELDS)
        .eq("status", "pending").eq("class_registrations.classes.CoachID", coachID).order("createdAt")) as unknown as LateRow[];
      return rows.filter((r) => r.class_registrations?.classes).map(toLate);
    },

    async getLateCancelRequest(requestID) {
      const row = must(await db.from("late_cancel_requests").select(LATE_FIELDS)
        .eq("LateCancelRequestID", requestID).maybeSingle()) as LateRow | null;
      return row ? toLate(row) : null;
    },

    async decideLateCancelRequest(requestID, approve) {
      const rows = must(await db.from("late_cancel_requests")
        .update({ status: approve ? "approved" : "rejected", decidedAt: new Date().toISOString() })
        .eq("LateCancelRequestID", requestID).eq("status", "pending").select('"LateCancelRequestID"')) as unknown[];
      return rows.length > 0;
    },

    async addNotification(traineeID, messageText) {
      must(await db.from("notifications").insert({ TraineeID: traineeID, messageText }));
    },

    async listUnreadNotifications(traineeID) {
      return must(await db.from("notifications").select('"NotificationID","messageText","createdAt"')
        .eq("TraineeID", traineeID).is("readAt", null).order("createdAt", { ascending: false })) as Notification[];
    },

    async markNotificationRead(notificationID, traineeID) {
      const row = must(await db.from("notifications").select('"NotificationID"')
        .eq("NotificationID", notificationID).eq("TraineeID", traineeID).maybeSingle());
      if (!row) return false;
      must(await db.from("notifications").update({ readAt: new Date().toISOString() })
        .eq("NotificationID", notificationID).is("readAt", null));
      return true;
    },

    async createPaymentRequest(coachID, traineeID, paymentType, amount) {
      const row = must(await db.from("payment_requests").insert({ CoachID: coachID, TraineeID: traineeID, paymentType, amount })
        .select('"PaymentRequestID"').single()) as { PaymentRequestID: string };
      return row.PaymentRequestID;
    },

    async getPaymentRequest(paymentRequestID) {
      const row = must(await db.from("payment_requests").select(PAYMENT_FIELDS).eq("PaymentRequestID", paymentRequestID).maybeSingle()) as PaymentRow | null;
      return row && toPayment(row);
    },

    async listPaymentRequests(coachID, traineeID) {
      let q = db.from("payment_requests").select(PAYMENT_FIELDS).eq("CoachID", coachID);
      if (traineeID) q = q.eq("TraineeID", traineeID);
      return (must(await q.order("createdAt", { ascending: false })) as unknown as PaymentRow[]).map(toPayment);
    },

    async markPaymentPaid(paymentRequestID) {
      const rows = must(await db.from("payment_requests").update({ status: "paid", paidAt: new Date().toISOString() })
        .eq("PaymentRequestID", paymentRequestID).eq("status", "open").select('"PaymentRequestID"')) as unknown[];
      return rows.length > 0;
    },

    async createInvoice(paymentRequestID, amount) {
      const res = await db.from("invoices").insert({ PaymentRequestID: paymentRequestID, amount, isDemo: true }).select('"invoiceNumber"').single();
      if (inserted(res)) return (res.data as { invoiceNumber: number }).invoiceNumber;
      // The request already has its invoice: the same number again, never a second invoice.
      const row = must(await db.from("invoices").select('"invoiceNumber"').eq("PaymentRequestID", paymentRequestID).single()) as { invoiceNumber: number };
      return row.invoiceNumber;
    },

    async listInvoices(coachID, traineeID) {
      let q = db.from("invoices").select(INVOICE_FIELDS).eq("payment_requests.CoachID", coachID);
      if (traineeID) q = q.eq("payment_requests.TraineeID", traineeID);
      return (must(await q.order("issuedAt", { ascending: false })) as unknown as InvoiceRow[]).map(toInvoice);
    },

    async updateBusinessSettings(businessID, values) {
      const rows = Object.entries(values).map(([settingKey, settingValue]) => ({ BusinessID: businessID, settingKey, settingValue }));
      if (rows.length) must(await db.from("settings").upsert(rows, { onConflict: "BusinessID,settingKey" }));
    },

    async coachesInReach(businessID, coachID) {
      if (!businessID) return null;
      const ids = (must(await db.from("coaches").select('"CoachID"').eq("BusinessID", businessID).eq("isActive", true)) as
        { CoachID: string }[]).map((c) => c.CoachID);
      if (coachID === undefined || coachID === null || coachID === "") return ids;
      return typeof coachID === "string" && ids.includes(coachID) ? [coachID] : null;
    },

    async listBusinessCoaches(businessID) {
      return must(await db.from("coaches").select('"CoachID","fullName"')
        .eq("BusinessID", businessID).eq("isActive", true).order("createdAt")) as BusinessCoach[];
    },

    async listOpenCoachInvites(businessID) {
      return must(await db.from("coach_invites").select('"CoachInviteID","inviteeName"')
        .eq("BusinessID", businessID).eq("status", "open").gt("expiresAt", new Date().toISOString()).order("createdAt")) as CoachInvite[];
    },

    async createCoachInvite(businessID, invite) {
      const row = must(await db.from("coach_invites").insert({ BusinessID: businessID, ...invite }).select('"CoachInviteID"').single()) as
        { CoachInviteID: string };
      return row.CoachInviteID;
    },

    async acceptCoachInvite(token, authUserID, fullName, email) {
      return must(await db.rpc("business_accept_coach_invite", { p_token: token, p_auth: authUserID, p_name: fullName, p_email: email })) as CoachJoinResult;
    },

    async businessOfTrainee(traineeID) {
      const row = must(await db.from("trainees").select('coaches("BusinessID")').eq("TraineeID", traineeID).eq("isActive", true).maybeSingle()) as
        unknown as { coaches: { BusinessID: string } } | null;
      return row?.coaches.BusinessID ?? null;
    },

    async countWorkoutsSince(traineeIDs, since) {
      const counts: Record<string, number> = Object.fromEntries(traineeIDs.map((id) => [id, 0]));
      if (!traineeIDs.length) return counts;
      const rows = must(await db.from("workout_logs").select('"TraineeID"').in("TraineeID", traineeIDs).gte("performedAt", since)) as
        { TraineeID: string }[];
      for (const r of rows) counts[r.TraineeID] = (counts[r.TraineeID] ?? 0) + 1;
      return counts;
    },
  };
}

const PAYMENT_FIELDS = '"PaymentRequestID","TraineeID","CoachID","paymentType","amount","status","createdAt","paidAt",' +
  'trainees("fullName"),invoices("invoiceNumber")';

type PaymentRow = Omit<PaymentRequest, "fullName" | "invoiceNumber"> & {
  trainees: { fullName: string };
  invoices: { invoiceNumber: number } | { invoiceNumber: number }[] | null;
};

function toPayment({ trainees, invoices, ...p }: PaymentRow): PaymentRequest {
  const inv = Array.isArray(invoices) ? invoices[0] : invoices;
  return { ...p, amount: Number(p.amount), fullName: trainees.fullName, invoiceNumber: inv?.invoiceNumber ?? null };
}

const INVOICE_FIELDS = '"invoiceNumber","PaymentRequestID","amount","issuedAt","isDemo",' +
  'payment_requests!inner("TraineeID","CoachID","paymentType",trainees("fullName"))';

interface InvoiceRow {
  invoiceNumber: number;
  PaymentRequestID: string;
  amount: number;
  issuedAt: string;
  isDemo: boolean;
  payment_requests: { TraineeID: string; CoachID: string; paymentType: string; trainees: { fullName: string } };
}

function toInvoice({ payment_requests: r, ...i }: InvoiceRow): Invoice {
  return { ...i, amount: Number(i.amount), TraineeID: r.TraineeID, paymentType: r.paymentType, fullName: r.trainees.fullName };
}

const CLASS_FIELDS = '"ClassID","CoachID","startsAt","place","capacity","status",' +
  'class_registrations("ClassRegistrationID","TraineeID","status","waitlistPosition","offerExpiresAt","attended",trainees("fullName"))';

type ClassRow = Omit<GroupClass, "registrations"> & {
  class_registrations: (Omit<ClassRegistration, "fullName"> & { trainees: { fullName: string } })[];
};

function toClass({ class_registrations, ...k }: ClassRow): GroupClass {
  return {
    ...k,
    registrations: class_registrations
      .map(({ trainees, ...r }) => ({ ...r, fullName: trainees.fullName }))
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0) || a.fullName.localeCompare(b.fullName)),
  };
}

const LATE_FIELDS = '"LateCancelRequestID","ClassRegistrationID","status",' +
  'class_registrations!inner("ClassID","TraineeID",trainees("fullName"),classes!inner("CoachID","startsAt"))';

interface LateRow {
  LateCancelRequestID: string;
  ClassRegistrationID: string;
  status: LateCancelRequest["status"];
  class_registrations: { ClassID: string; TraineeID: string; trainees: { fullName: string }; classes: { CoachID: string; startsAt: string } };
}

function toLate(r: LateRow): LateCancelRequest {
  const g = r.class_registrations;
  return {
    LateCancelRequestID: r.LateCancelRequestID, ClassRegistrationID: r.ClassRegistrationID, status: r.status,
    ClassID: g.ClassID, TraineeID: g.TraineeID, fullName: g.trainees.fullName, CoachID: g.classes.CoachID, startsAt: g.classes.startsAt,
  };
}

const CHALLENGE_FIELDS = '"ChallengeID","challengeName","challengeType","targetValue","ExerciseID","extraPrize","weekStart",exercises("exerciseName")';

type ChallengeRow = Omit<Challenge, "exerciseName"> & { exercises: { exerciseName: string } | null };

function toChallenge({ exercises, ...c }: ChallengeRow): Challenge {
  return { ...c, targetValue: Number(c.targetValue), exerciseName: exercises?.exerciseName ?? null };
}

const EXERCISE_FIELDS = '"ExerciseID","exerciseName","isBodyweight","videoType","videoUrl"';

const LOG_FIELDS = '"WorkoutLogID","TraineeID","WorkoutID","performedAt",' +
  'workouts("workoutName",workout_items("ExerciseID","sortOrder")),' +
  'set_results("SetResultID","ExerciseID","setNumber","reps","weight","isDone","isCorrected",exercises("exerciseName"))';

interface LogRow {
  WorkoutLogID: string;
  TraineeID: string;
  WorkoutID: string;
  performedAt: string;
  workouts: { workoutName: string; workout_items: { ExerciseID: string; sortOrder: number }[] };
  set_results: (Omit<SetResult, "exerciseName"> & { exercises: { exerciseName: string } })[];
}

// Sets in the order of the workout, then by set number. An exercise swapped out since keeps its results, last.
function toWorkoutLog(row: LogRow): WorkoutLog {
  const order = new Map(row.workouts.workout_items.map((i) => [i.ExerciseID, i.sortOrder]));
  const place = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  return {
    WorkoutLogID: row.WorkoutLogID, TraineeID: row.TraineeID, WorkoutID: row.WorkoutID,
    workoutName: row.workouts.workoutName, performedAt: row.performedAt,
    sets: row.set_results
      .map(({ exercises, ...s }) => ({ ...s, weight: Number(s.weight), exerciseName: exercises.exerciseName }))
      .sort((a, b) => place(a.ExerciseID) - place(b.ExerciseID) || a.ExerciseID.localeCompare(b.ExerciseID) || a.setNumber - b.setNumber),
  };
}
