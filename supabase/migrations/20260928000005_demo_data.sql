-- 0005: demo data (CLAUDE.md section 7; stage 3 plan, task 1 and decision 2). Synthetic, every name marked "(דוגמה)".
-- The IDs match app/src/demo/data.ts. Removed in stage 7.
--
-- Every coach and trainee needs an identity user (authUserID is required in the ERD), and this file never holds a
-- password. So the rows load only once the four demo users exist in auth.users, by email:
--   cloud: the team creates them in the Supabase dashboard, then this migration loads the data on push;
--   local: the test setup creates them, then runs `select demo.load()`.
-- Ron (invited, not joined) has no identity user, so he is an open invite only (stage 3 report, gap 2).
-- The function lives in its own schema, which the Data API does not expose.

create schema if not exists demo;
revoke all on schema demo from public, anon, authenticated;

create or replace function demo.load() returns boolean
language plpgsql as $$
declare
  p   constant text := 'd0000000-0000-4000-8000-00000000';
  t0  constant timestamptz := '2026-09-28 12:00:00+03'; -- TODAY in data.ts
  u_coach uuid; u_noa uuid; u_itai uuid; u_maya uuid;
  i int; s int; w_id uuid; it record; bw boolean;
begin
  select id into u_coach from auth.users where email = 'coach.demo@fitness-app.test';
  select id into u_noa   from auth.users where email = 'noa.demo@fitness-app.test';
  select id into u_itai  from auth.users where email = 'itai.demo@fitness-app.test';
  select id into u_maya  from auth.users where email = 'maya.demo@fitness-app.test';
  if u_coach is null or u_noa is null or u_itai is null or u_maya is null then
    raise notice 'demo.load: the four demo identity users do not exist yet; nothing loaded';
    return false;
  end if;
  if exists (select 1 from coaches where "CoachID" = (p || '0001')::uuid) then
    return true; -- already loaded
  end if;

  insert into coaches ("CoachID","authUserID","fullName","email")
  values ((p||'0001')::uuid, u_coach, 'המאמן (דוגמה)', 'coach.demo@fitness-app.test');

  insert into trainees ("TraineeID","CoachID","authUserID","fullName","email","joinedAt") values
    ((p||'1001')::uuid, (p||'0001')::uuid, u_noa,  'נועה (דוגמה)', 'noa.demo@fitness-app.test',  t0 - interval '90 days'),
    ((p||'1002')::uuid, (p||'0001')::uuid, u_itai, 'איתי (דוגמה)', 'itai.demo@fitness-app.test', t0 - interval '60 days'),
    ((p||'1003')::uuid, (p||'0001')::uuid, u_maya, 'מאיה (דוגמה)', 'maya.demo@fitness-app.test', t0 - interval '30 days');

  insert into invites ("InviteID","CoachID","inviteeName","token","status","expiresAt","createdAt") values
    ((p||'b001')::uuid, (p||'0001')::uuid, 'רון (דוגמה)', 'demo-invite-ron', 'open', t0 + interval '6 days', t0 - interval '1 day');

  insert into settings ("CoachID","settingKey","settingValue")
  select (p||'0001')::uuid, k, v from (values
    ('coinsWorkout','10'), ('coinsGoal','30'), ('coinsChallenge','50'), ('coinsAttendance','5'),
    ('priceMonthly','350'), ('pricePack10','600'),
    ('cancelHours','24'), ('streakGapDays','3'), ('videoMaxSeconds','60'), ('spotOfferHours','2'),
    ('inviteValidDays','7'), ('noteMaxLength','280'),
    ('feedbackFull','כל הכבוד! השלמת את כל הסטים לפי התוכנית.'),
    ('feedbackPartial','עבודה טובה. כל סט נחשב, ממשיכים באימון הבא.'),
    ('feedbackRecord','שיא אישי חדש! ההתקדמות שלך נראית.'),
    ('reminderText','יום טוב! הנה מה שמחכה לך היום.')) as x(k, v);

  -- The ready-made list (CoachID null).
  insert into exercises ("ExerciseID","exerciseName","isBodyweight","videoType","videoUrl") values
    ((p||'2001')::uuid, 'סקוואט',        false, 'youtube', 'https://www.youtube.com/ (דוגמה)'),
    ((p||'2002')::uuid, 'לחיצת חזה',     false, 'youtube', 'https://www.youtube.com/ (דוגמה)'),
    ((p||'2003')::uuid, 'חתירה בכבל',    false, 'youtube', 'https://www.youtube.com/ (דוגמה)'),
    ((p||'2004')::uuid, 'מכרעים',        false, 'youtube', 'https://www.youtube.com/ (דוגמה)'),
    ((p||'2005')::uuid, 'שכיבות סמיכה',  true,  'youtube', 'https://www.youtube.com/ (דוגמה)'),
    ((p||'2006')::uuid, 'דדליפט רומני',  false, 'youtube', 'https://www.youtube.com/ (דוגמה)'),
    ((p||'2007')::uuid, 'לחיצת כתפיים',  false, null, null),
    ((p||'2008')::uuid, 'מתח',           true,  'youtube', 'https://www.youtube.com/ (דוגמה)');

  insert into programs ("ProgramID","TraineeID","programName","isActive","createdAt","deactivatedAt") values
    ((p||'3001')::uuid, (p||'1001')::uuid, 'תוכנית קודמת', false, t0 - interval '70 days', t0 - interval '30 days'),
    ((p||'3002')::uuid, (p||'1001')::uuid, 'תוכנית אימון', true,  t0 - interval '30 days', null),
    ((p||'3003')::uuid, (p||'1002')::uuid, 'תוכנית אימון', true,  t0 - interval '20 days', null);

  insert into workouts ("WorkoutID","ProgramID","workoutName","sortOrder") values
    ((p||'4001')::uuid, (p||'3002')::uuid, 'אימון A', 0),
    ((p||'4002')::uuid, (p||'3002')::uuid, 'אימון B', 1),
    ((p||'4003')::uuid, (p||'3003')::uuid, 'אימון מלא', 0);

  insert into workout_items ("WorkoutItemID","WorkoutID","ExerciseID","sortOrder","targetSets","targetReps","targetWeight") values
    ((p||'5001')::uuid, (p||'4001')::uuid, (p||'2001')::uuid, 0, 3, 8, 60),
    ((p||'5002')::uuid, (p||'4001')::uuid, (p||'2002')::uuid, 1, 3, 8, 40),
    ((p||'5003')::uuid, (p||'4001')::uuid, (p||'2005')::uuid, 2, 3, 12, 0),
    ((p||'5004')::uuid, (p||'4002')::uuid, (p||'2006')::uuid, 0, 3, 10, 50),
    ((p||'5005')::uuid, (p||'4002')::uuid, (p||'2003')::uuid, 1, 3, 10, 35),
    ((p||'5006')::uuid, (p||'4002')::uuid, (p||'2008')::uuid, 2, 3, 6, 0),
    ((p||'5007')::uuid, (p||'4003')::uuid, (p||'2004')::uuid, 0, 3, 10, 12),
    ((p||'5008')::uuid, (p||'4003')::uuid, (p||'2002')::uuid, 1, 4, 6, 55);

  -- Eight performed workouts for Noa, the same series as the seed() in data.ts.
  for i in reverse 8..1 loop
    w_id := case when i % 2 = 1 then (p||'4001')::uuid else (p||'4002')::uuid end;
    insert into workout_logs ("WorkoutLogID","TraineeID","WorkoutID","performedAt")
    values ((p||'600'||i)::uuid, (p||'1001')::uuid, w_id, t0 - make_interval(days => i * 3));
    for it in select wi.* from workout_items wi where wi."WorkoutID" = w_id order by wi."sortOrder" loop
      bw := it."targetWeight" = 0;
      for s in 1..it."targetSets" loop
        insert into set_results ("WorkoutLogID","ExerciseID","setNumber","reps","weight")
        values ((p||'600'||i)::uuid, it."ExerciseID", s,
          case when bw then it."targetReps" - round(i / 2.0)::int else it."targetReps" end,
          case when bw then 0 else
            round(case it."ExerciseID"
                    when (p||'2001')::uuid then 50 when (p||'2002')::uuid then 32
                    when (p||'2006')::uuid then 40 else 28 end + (8 - i) * 1.5)
            + case when s = it."targetSets" then 2.5 else 0 end end);
      end loop;
    end loop;
  end loop;

  insert into coach_notes ("WorkoutLogID","CoachID","noteText","createdAt")
  values ((p||'6001')::uuid, (p||'0001')::uuid, 'שיא יפה בסקוואט (דוגמה)', t0 - interval '3 days');

  insert into personal_goals ("PersonalGoalID","TraineeID","ExerciseID","targetWeight","status")
  values ((p||'7001')::uuid, (p||'1001')::uuid, (p||'2001')::uuid, 65, 'active');

  insert into rewards ("RewardID","CoachID","rewardName","priceCoins") values
    ((p||'7101')::uuid, (p||'0001')::uuid, 'כרטיסייה בהנחה (דוגמה)', 120),
    ((p||'7102')::uuid, (p||'0001')::uuid, 'אימון אישי חינם (דוגמה)', 200),
    ((p||'7103')::uuid, (p||'0001')::uuid, 'בקבוק מים ממותג (דוגמה)', 60);

  insert into coin_transactions ("CoinTransactionID","TraineeID","eventType","eventRef","amount","createdAt") values
    (gen_random_uuid(),   (p||'1001')::uuid, 'challenge',  'ch0-t1',   50, t0 - interval '8 days'),
    (gen_random_uuid(),   (p||'1001')::uuid, 'workout',    p||'6002',  10, t0 - interval '6 days'),
    (gen_random_uuid(),   (p||'1001')::uuid, 'attendance', 'k0-t1',     5, t0 - interval '5 days'),
    (gen_random_uuid(),   (p||'1001')::uuid, 'workout',    p||'6001',  10, t0 - interval '3 days'),
    (gen_random_uuid(),   (p||'1002')::uuid, 'workout',    'x-t2',     80, t0 - interval '4 days'),
    ((p||'7301')::uuid,   (p||'1002')::uuid, 'redeem',     p||'7201', -60, t0 - interval '1 day');

  insert into redemptions ("RedemptionID","TraineeID","RewardID","CoinTransactionID","status")
  values ((p||'7201')::uuid, (p||'1002')::uuid, (p||'7103')::uuid, (p||'7301')::uuid, 'pending');

  insert into challenges ("ChallengeID","CoachID","challengeName","challengeType","targetValue","extraPrize","weekStart")
  values ((p||'8001')::uuid, (p||'0001')::uuid, 'שלושה אימונים השבוע (דוגמה)', 'count', 3, 'בקבוק מים ממותג (דוגמה)', '2026-09-27');
  insert into challenge_completions ("ChallengeID","TraineeID","completedAt")
  values ((p||'8001')::uuid, (p||'1002')::uuid, t0 - interval '1 day');

  insert into payment_requests ("PaymentRequestID","TraineeID","CoachID","paymentType","amount","status","createdAt","paidAt") values
    ((p||'9001')::uuid, (p||'1001')::uuid, (p||'0001')::uuid, 'monthly', 350, 'paid', t0 - interval '20 days', t0 - interval '20 days'),
    ((p||'9002')::uuid, (p||'1002')::uuid, (p||'0001')::uuid, 'pack10',  600, 'paid', t0 - interval '10 days', t0 - interval '10 days'),
    ((p||'9003')::uuid, (p||'1001')::uuid, (p||'0001')::uuid, 'pack10',  600, 'open', t0 - interval '1 day',   null);
  insert into invoices ("PaymentRequestID","invoiceNumber","amount","isDemo","issuedAt") values
    ((p||'9001')::uuid, 1001, 350, true, t0 - interval '20 days'),
    ((p||'9002')::uuid, 1002, 600, true, t0 - interval '10 days');
  perform setval('invoice_number_seq', 1002);

  insert into classes ("ClassID","CoachID","startsAt","place","capacity") values
    ((p||'a000')::uuid, (p||'0001')::uuid, '2026-09-26 18:30:00+03', 'פארק הירקון (דוגמה)', 8),
    ((p||'a001')::uuid, (p||'0001')::uuid, '2026-09-28 18:30:00+03', 'פארק הירקון (דוגמה)', 8),
    ((p||'a002')::uuid, (p||'0001')::uuid, '2026-09-30 07:00:00+03', 'סטודיו (דוגמה)', 2), -- full with Ron out, so Noa still waits
    ((p||'a003')::uuid, (p||'0001')::uuid, '2026-10-02 19:00:00+03', 'סטודיו (דוגמה)', 10);
  insert into class_registrations ("ClassID","TraineeID","status","waitlistPosition") values
    ((p||'a000')::uuid, (p||'1001')::uuid, 'registered', null),
    ((p||'a000')::uuid, (p||'1002')::uuid, 'registered', null),
    ((p||'a000')::uuid, (p||'1003')::uuid, 'registered', null),
    ((p||'a001')::uuid, (p||'1001')::uuid, 'registered', null),
    ((p||'a001')::uuid, (p||'1002')::uuid, 'registered', null),
    ((p||'a001')::uuid, (p||'1003')::uuid, 'registered', null),
    ((p||'a002')::uuid, (p||'1002')::uuid, 'registered', null),
    ((p||'a002')::uuid, (p||'1003')::uuid, 'registered', null),
    ((p||'a002')::uuid, (p||'1001')::uuid, 'waitlist', 1),
    ((p||'a003')::uuid, (p||'1002')::uuid, 'registered', null);

  insert into notifications ("NotificationID","TraineeID","messageText","createdAt")
  values ((p||'e001')::uuid, (p||'1001')::uuid, 'המאמן הוסיף הערה לאימון האחרון שלך (דוגמה)', t0 - interval '1 day');

  return true;
end $$;

revoke all on function demo.load() from public, anon, authenticated;

select demo.load();
