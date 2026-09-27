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

export interface Repository {
  findActorByAuthUser(authUserID: string): Promise<Actor | null>;
  isRegistered(caller: string, moduleName: string, actionName: string, role: string): Promise<boolean>;
  writeAudit(entry: AuditRecord): Promise<void>;
  getCoachSettings(coachID: string): Promise<Record<string, string>>;
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
  };
}
