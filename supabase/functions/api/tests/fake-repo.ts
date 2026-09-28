// An in-memory Repository for the unit tests of stages 4a to 4c (synthetic data, no database).
// Every operation a test does not supply rejects, so a module that reaches past what it should fails the test.
import type { AuditRecord, Repository } from "../repository.ts";

const notUsed = () => Promise.reject(new Error("not used in this test"));

// The stage 4b operations, for tests that build a Repository of their own and never reach them.
export const stage4bNotUsed = {
  getExercisesByID: notUsed, addCoachNote: notUsed, listCoachNotes: notUsed,
  awardCoins: notUsed, listCoinTransactions: notUsed, getActiveGoal: notUsed, setPersonalGoal: notUsed, achieveGoal: notUsed,
  listRewards: notUsed, addReward: notUsed, listRedemptions: notUsed, redeemReward: notUsed, markRewardDelivered: notUsed,
  getChallengeForWeek: notUsed, createChallenge: notUsed, listCompletions: notUsed, addCompletion: notUsed, markPrizeDelivered: notUsed,
};

// The stage 4c operations (classes and notifications), in the same way.
export const stage4cNotUsed = {
  publishClass: notUsed, getClass: notUsed, listClasses: notUsed, cancelClass: notUsed, registerForClass: notUsed, releaseSpot: notUsed,
  setAttendance: notUsed, addLateCancelRequest: notUsed, listLateCancelRequests: notUsed, getLateCancelRequest: notUsed,
  decideLateCancelRequest: notUsed, addNotification: notUsed, listUnreadNotifications: notUsed, markNotificationRead: notUsed,
};

export function fakeRepo(over: Partial<Repository> = {}): { repo: Repository; audits: AuditRecord[] } {
  const audits: AuditRecord[] = [];
  const repo: Repository = {
    findActorByAuthUser: notUsed, getCoachSettings: notUsed,
    isActiveTraineeOfCoach: notUsed, listExercisesForCoach: notUsed, getActiveProgram: notUsed, listInactivePrograms: notUsed,
    saveProgram: notUsed, swapExercise: notUsed, startNewProgram: notUsed,
    listTraineesForCoach: notUsed, createInvite: notUsed, createExercise: notUsed, getExerciseInReach: notUsed, attachVideo: notUsed,
    logWorkout: notUsed, getWorkoutLog: notUsed, correctResults: notUsed, listResults: notUsed,
    ...stage4bNotUsed,
    ...stage4cNotUsed,
    // Every row is registered: the Registry itself is tested in orchestrator.test.ts and in the integration tests.
    isRegistered: () => Promise.resolve(true),
    writeAudit: (e) => (audits.push(e), Promise.resolve()),
    ...over,
  };
  return { repo, audits };
}

export const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
