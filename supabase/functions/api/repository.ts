// C04 Repository: the only file that creates a database or storage client (CLAUDE.md rule 5).
// Modules and the core call it through business-named operations and never see table names.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Role = "coach" | "trainee";

export interface Actor {
  role: Role;
  coachID: string;          // the coach this actor belongs to (self for a coach)
  traineeID: string | null; // set for a trainee
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

export interface Repository {
  findActorByAuthUser(authUserID: string): Promise<Actor | null>;
  isRegistered(caller: string, moduleName: string, actionName: string, role: string): Promise<boolean>;
  writeAudit(entry: AuditRecord): Promise<void>;
  getCoachSettings(coachID: string): Promise<Record<string, string>>;
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
  // Exercises (UC1, UC10 step 5). In reach: active, and ready-made or the coach's own; the same for the coach's trainees.
  createExercise(coachID: string, exerciseName: string, isBodyweight: boolean): Promise<Exercise>;
  getExerciseInReach(exerciseID: string, coachID: string): Promise<Exercise | null>;
  attachVideo(exerciseID: string, videoType: "youtube" | "upload", videoUrl: string): Promise<Exercise>;
  // Results (UC3 steps 6, 9 and c2). Saving and correcting are atomic.
  logWorkout(traineeID: string, workoutID: string, sets: SetEntry[]): Promise<string>;
  getWorkoutLog(workoutLogID: string): Promise<WorkoutLog | null>;
  correctResults(workoutLogID: string, corrections: SetCorrection[]): Promise<void>;
  listResults(traineeID: string): Promise<WorkoutLog[]>;
}

export class StorageUnavailable extends Error {}

export function createRepository(): Repository {
  const db: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const must = <T>(res: { data: T; error: unknown }): T => {
    if (res.error) throw new StorageUnavailable(String((res.error as { message?: string }).message ?? res.error));
    return res.data;
  };

  return {
    async findActorByAuthUser(authUserID) {
      const coach = must(await db.from("coaches").select('"CoachID"').eq("authUserID", authUserID).eq("isActive", true).maybeSingle());
      if (coach) return { role: "coach", coachID: coach.CoachID, traineeID: null };
      const trainee = must(await db.from("trainees").select('"TraineeID","CoachID"').eq("authUserID", authUserID).eq("isActive", true).maybeSingle());
      if (trainee) return { role: "trainee", coachID: trainee.CoachID, traineeID: trainee.TraineeID };
      return null;
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

    async getCoachSettings(coachID) {
      const rows = must(await db.from("settings").select('"settingKey","settingValue"').eq("CoachID", coachID)) as
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
  };
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
