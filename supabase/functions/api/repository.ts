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
  };
}
