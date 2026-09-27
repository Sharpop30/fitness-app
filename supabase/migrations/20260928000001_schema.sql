-- 0001: the schema, translated 1:1 from the logical ERD (project-docs/doc-erd-logical.html).
-- Names follow the ERD exactly (quoted camelCase columns, PK = <Entity>ID).
-- No physical deletes (Business Logic rule 6): every FK is ON DELETE RESTRICT.
-- RLS is on for every table with no public policies: only the api Edge Function
-- (service role, through repository.ts) reads and writes (CLAUDE.md rule 10).

-- ===== 07a people =====
create table coaches (
  "CoachID"    uuid primary key default gen_random_uuid(),
  "authUserID" uuid not null unique references auth.users(id) on delete restrict,
  "fullName"   text not null,
  "email"      text not null,
  "isActive"   boolean not null default true,
  "createdAt"  timestamptz not null default now()
);

create table trainees (
  "TraineeID"  uuid primary key default gen_random_uuid(),
  "CoachID"    uuid not null references coaches("CoachID") on delete restrict,
  "authUserID" uuid not null unique references auth.users(id) on delete restrict,
  "fullName"   text not null,
  "email"      text not null,
  "isActive"   boolean not null default true,
  "joinedAt"   timestamptz not null default now()
);

create table invites (
  "InviteID"     uuid primary key default gen_random_uuid(),
  "CoachID"      uuid not null references coaches("CoachID") on delete restrict,
  "TraineeID"    uuid references trainees("TraineeID") on delete restrict,
  "inviteeName"  text not null,
  "inviteeEmail" text,
  "token"        text not null unique,
  "status"       text not null default 'open' check ("status" in ('open','accepted','expired')),
  "expiresAt"    timestamptz not null,
  "createdAt"    timestamptz not null default now()
);

-- ===== 07b training =====
create table exercises (
  "ExerciseID"   uuid primary key default gen_random_uuid(),
  "CoachID"      uuid references coaches("CoachID") on delete restrict, -- null = ready-made list
  "exerciseName" text not null,
  "isBodyweight" boolean not null default false,
  "videoType"    text check ("videoType" in ('youtube','upload')),
  "videoUrl"     text,
  "isActive"     boolean not null default true
);

create table programs (
  "ProgramID"     uuid primary key default gen_random_uuid(),
  "TraineeID"     uuid not null references trainees("TraineeID") on delete restrict,
  "programName"   text not null,
  "isActive"      boolean not null default true,
  "createdAt"     timestamptz not null default now(),
  "deactivatedAt" timestamptz
);
-- Business Logic rule 1: at most one active program per trainee.
create unique index programs_one_active_per_trainee on programs ("TraineeID") where "isActive";

create table workouts (
  "WorkoutID"   uuid primary key default gen_random_uuid(),
  "ProgramID"   uuid not null references programs("ProgramID") on delete restrict,
  "workoutName" text not null,
  "sortOrder"   integer not null
);

create table workout_items (
  "WorkoutItemID" uuid primary key default gen_random_uuid(),
  "WorkoutID"     uuid not null references workouts("WorkoutID") on delete restrict,
  "ExerciseID"    uuid not null references exercises("ExerciseID") on delete restrict,
  "sortOrder"     integer not null,
  -- Business Logic rule 3
  "targetSets"    integer not null check ("targetSets" > 0),
  "targetReps"    integer not null check ("targetReps" > 0),
  "targetWeight"  numeric not null default 0 check ("targetWeight" >= 0)
);

create table workout_logs (
  "WorkoutLogID" uuid primary key default gen_random_uuid(),
  "TraineeID"    uuid not null references trainees("TraineeID") on delete restrict,
  "WorkoutID"    uuid not null references workouts("WorkoutID") on delete restrict,
  "performedAt"  timestamptz not null default now()
);

create table set_results (
  "SetResultID"  uuid primary key default gen_random_uuid(),
  "WorkoutLogID" uuid not null references workout_logs("WorkoutLogID") on delete restrict,
  "ExerciseID"   uuid not null references exercises("ExerciseID") on delete restrict,
  "setNumber"    integer not null check ("setNumber" > 0),
  -- Business Logic rule 4
  "reps"         integer not null check ("reps" >= 0),
  "weight"       numeric not null default 0 check ("weight" >= 0),
  "isDone"       boolean not null default true,
  "isCorrected"  boolean not null default false,
  "correctedAt"  timestamptz
);

create table coach_notes (
  "CoachNoteID"  uuid primary key default gen_random_uuid(),
  "WorkoutLogID" uuid not null references workout_logs("WorkoutLogID") on delete restrict,
  "CoachID"      uuid not null references coaches("CoachID") on delete restrict,
  "noteText"     text not null,
  "createdAt"    timestamptz not null default now()
);

-- ===== 07c motivation =====
create table personal_goals (
  "PersonalGoalID" uuid primary key default gen_random_uuid(),
  "TraineeID"      uuid not null references trainees("TraineeID") on delete restrict,
  "ExerciseID"     uuid not null references exercises("ExerciseID") on delete restrict,
  "targetWeight"   numeric not null check ("targetWeight" > 0),
  "status"         text not null default 'active' check ("status" in ('active','achieved')),
  "achievedAt"     timestamptz
);

create table coin_transactions (
  "CoinTransactionID" uuid primary key default gen_random_uuid(),
  "TraineeID"         uuid not null references trainees("TraineeID") on delete restrict,
  "eventType"         text not null check ("eventType" in ('workout','goal','challenge','attendance','redeem')),
  "eventRef"          text not null,
  "amount"            integer not null,
  "createdAt"         timestamptz not null default now(),
  unique ("eventType", "eventRef") -- one award per event (UC7 step 4)
);

create table rewards (
  "RewardID"   uuid primary key default gen_random_uuid(),
  "CoachID"    uuid not null references coaches("CoachID") on delete restrict,
  "rewardName" text not null,
  "priceCoins" integer not null check ("priceCoins" > 0),
  "isActive"   boolean not null default true
);

create table redemptions (
  "RedemptionID"      uuid primary key default gen_random_uuid(),
  "TraineeID"         uuid not null references trainees("TraineeID") on delete restrict,
  "RewardID"          uuid not null references rewards("RewardID") on delete restrict,
  "CoinTransactionID" uuid not null unique references coin_transactions("CoinTransactionID") on delete restrict,
  "status"            text not null default 'pending' check ("status" in ('pending','delivered')),
  "deliveredAt"       timestamptz
);

create table challenges (
  "ChallengeID"   uuid primary key default gen_random_uuid(),
  "CoachID"       uuid not null references coaches("CoachID") on delete restrict,
  "challengeName" text not null,
  "challengeType" text not null check ("challengeType" in ('count','exercise')),
  "targetValue"   numeric not null check ("targetValue" > 0),
  "ExerciseID"    uuid references exercises("ExerciseID") on delete restrict,
  "extraPrize"    text,
  "weekStart"     date not null check (extract(dow from "weekStart") = 0), -- Sunday
  unique ("CoachID", "weekStart"), -- one challenge per week
  check (("challengeType" = 'exercise') = ("ExerciseID" is not null))
);

create table challenge_completions (
  "ChallengeCompletionID" uuid primary key default gen_random_uuid(),
  "ChallengeID"           uuid not null references challenges("ChallengeID") on delete restrict,
  "TraineeID"             uuid not null references trainees("TraineeID") on delete restrict,
  "completedAt"           timestamptz not null default now(),
  "prizeDeliveredAt"      timestamptz,
  unique ("ChallengeID", "TraineeID")
);

-- ===== 07d payments (demo) =====
create table payment_requests (
  "PaymentRequestID" uuid primary key default gen_random_uuid(),
  "TraineeID"        uuid not null references trainees("TraineeID") on delete restrict,
  "CoachID"          uuid not null references coaches("CoachID") on delete restrict,
  "paymentType"      text not null check ("paymentType" in ('monthly','pack10')),
  "amount"           numeric not null check ("amount" > 0),
  "status"           text not null default 'open' check ("status" in ('open','paid')),
  "createdAt"        timestamptz not null default now(),
  "paidAt"           timestamptz
);

create sequence invoice_number_seq start 1001;
create table invoices (
  "InvoiceID"        uuid primary key default gen_random_uuid(),
  "PaymentRequestID" uuid not null unique references payment_requests("PaymentRequestID") on delete restrict,
  "invoiceNumber"    integer not null unique default nextval('invoice_number_seq'),
  "amount"           numeric not null,
  "isDemo"           boolean not null default true,
  "issuedAt"         timestamptz not null default now()
);

-- ===== 07e classes and notifications =====
create table classes (
  "ClassID"   uuid primary key default gen_random_uuid(),
  "CoachID"   uuid not null references coaches("CoachID") on delete restrict,
  "startsAt"  timestamptz not null,
  "place"     text not null,
  "capacity"  integer not null check ("capacity" > 0),
  "status"    text not null default 'active' check ("status" in ('active','cancelled')),
  "createdAt" timestamptz not null default now()
);

create table class_registrations (
  "ClassRegistrationID" uuid primary key default gen_random_uuid(),
  "ClassID"             uuid not null references classes("ClassID") on delete restrict,
  "TraineeID"           uuid not null references trainees("TraineeID") on delete restrict,
  "status"              text not null check ("status" in ('registered','waitlist','offered','cancelled')),
  "waitlistPosition"    integer,
  "offerExpiresAt"      timestamptz,
  "attended"            boolean,
  "createdAt"           timestamptz not null default now(),
  unique ("ClassID", "TraineeID")
);

create table late_cancel_requests (
  "LateCancelRequestID" uuid primary key default gen_random_uuid(),
  "ClassRegistrationID" uuid not null references class_registrations("ClassRegistrationID") on delete restrict,
  "status"              text not null default 'pending' check ("status" in ('pending','approved','rejected')),
  "createdAt"           timestamptz not null default now(),
  "decidedAt"           timestamptz
);

create table notifications (
  "NotificationID" uuid primary key default gen_random_uuid(),
  "TraineeID"      uuid not null references trainees("TraineeID") on delete restrict,
  "messageText"    text not null,
  "createdAt"      timestamptz not null default now(),
  "readAt"         timestamptz
);

-- ===== 07f operations =====
create table audit_entries (
  "AuditEntryID" uuid primary key default gen_random_uuid(),
  "requestID"    uuid not null,
  "caller"       text not null,
  "moduleName"   text not null,
  "actionName"   text not null,
  "isOk"         boolean not null,
  "errorCode"    text,
  "createdAt"    timestamptz not null default now()
);
create index audit_entries_request on audit_entries ("requestID");

create table settings (
  "SettingID"    uuid primary key default gen_random_uuid(),
  "CoachID"      uuid not null references coaches("CoachID") on delete restrict,
  "settingKey"   text not null,
  "settingValue" text not null,
  unique ("CoachID", "settingKey")
);

create table error_codes (
  "ErrorCodeID"   uuid primary key default gen_random_uuid(),
  "errorCode"     text not null unique,
  "developerText" text not null,
  "humanText"     text not null
);

create table registry_entries (
  "RegistryEntryID" uuid primary key default gen_random_uuid(),
  "caller"          text not null,
  "moduleName"      text not null,
  "actionName"      text not null,
  "allowedRole"     text not null check ("allowedRole" in ('coach','trainee','module')),
  "isActive"        boolean not null default true,
  unique ("caller", "moduleName", "actionName", "allowedRole") -- a shared screen (S21) serves two roles
);

-- ===== RLS on everything, no public policies =====
do $$
declare t text;
begin
  foreach t in array array['coaches','trainees','invites','exercises','programs','workouts','workout_items',
    'workout_logs','set_results','coach_notes','personal_goals','coin_transactions','rewards','redemptions',
    'challenges','challenge_completions','payment_requests','invoices','classes','class_registrations',
    'late_cancel_requests','notifications','audit_entries','settings','error_codes','registry_entries']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
