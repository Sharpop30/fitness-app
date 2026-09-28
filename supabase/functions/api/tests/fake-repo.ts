// An in-memory Repository for the stage 4a unit tests (synthetic data, no database).
// Every operation a test does not supply rejects, so a module that reaches past what it should fails the test.
import type { AuditRecord, Repository } from "../repository.ts";

const notUsed = () => Promise.reject(new Error("not used in this test"));

export function fakeRepo(over: Partial<Repository> = {}): { repo: Repository; audits: AuditRecord[] } {
  const audits: AuditRecord[] = [];
  const repo: Repository = {
    findActorByAuthUser: notUsed, getCoachSettings: notUsed,
    isActiveTraineeOfCoach: notUsed, listExercisesForCoach: notUsed, getActiveProgram: notUsed, listInactivePrograms: notUsed,
    saveProgram: notUsed, swapExercise: notUsed, startNewProgram: notUsed,
    listTraineesForCoach: notUsed, createInvite: notUsed, createExercise: notUsed, getExerciseInReach: notUsed, attachVideo: notUsed,
    logWorkout: notUsed, getWorkoutLog: notUsed, correctResults: notUsed, listResults: notUsed,
    // Every row is registered: the Registry itself is tested in orchestrator.test.ts and in the integration tests.
    isRegistered: () => Promise.resolve(true),
    writeAudit: (e) => (audits.push(e), Promise.resolve()),
    ...over,
  };
  return { repo, audits };
}

export const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
