-- 0019: setup.create_business (stage 7 plan, task 21; decision 11; module map section 7, row 7).
-- The first business: a business, its owner who is also its first coach (rule 10), and SETTINGS at the values approved in
-- the prototype (the same 17 as the demo; the owner changes them in S12). For an identity user that already exists: the
-- team creates it in the dashboard. No email, name or password lives in this file: they come in at run time, once, in
-- the cloud (task 23). A second call for the same email makes no second business.
-- status: created (with businessID), exists (the user already owns a business: its businessID), no_user (no identity
-- user with that email), taken (the user is already a coach or a trainee). Lives in the closed schema setup, which the
-- Data API does not expose.

create schema if not exists setup;
revoke all on schema setup from public, anon, authenticated;

create or replace function setup.create_business(p_email text, p_owner_name text, p_business_name text) returns jsonb
language plpgsql as $$
declare
  u uuid;
  e text;
  b uuid;
begin
  if nullif(btrim(p_owner_name), '') is null or nullif(btrim(p_business_name), '') is null then
    raise exception 'setup.create_business: the owner name and the business name are required';
  end if;
  select id, email into u, e from auth.users where lower(email) = lower(btrim(p_email));
  if u is null then
    return jsonb_build_object('status', 'no_user');
  end if;
  select "BusinessID" into b from owners where "authUserID" = u;
  if b is not null then
    return jsonb_build_object('status', 'exists', 'businessID', b);
  end if;
  if exists (select 1 from coaches where "authUserID" = u) or exists (select 1 from trainees where "authUserID" = u) then
    return jsonb_build_object('status', 'taken');
  end if;

  insert into businesses ("businessName") values (btrim(p_business_name)) returning "BusinessID" into b;
  insert into owners ("BusinessID", "authUserID", "fullName", "email") values (b, u, btrim(p_owner_name), e);
  insert into coaches ("BusinessID", "authUserID", "fullName", "email") values (b, u, btrim(p_owner_name), e);
  insert into settings ("BusinessID", "settingKey", "settingValue")
  select b, k, v from (values
    ('coinsWorkout','10'), ('coinsGoal','30'), ('coinsChallenge','50'), ('coinsAttendance','5'),
    ('priceMonthly','350'), ('pricePack10','600'),
    ('cancelHours','24'), ('streakGapDays','3'), ('videoMaxSeconds','60'), ('spotOfferHours','2'),
    ('inviteValidDays','7'), ('noteMaxLength','280'), ('videoMaxMegabytes','50'),
    ('feedbackFull','כל הכבוד! השלמת את כל הסטים לפי התוכנית.'),
    ('feedbackPartial','עבודה טובה. כל סט נחשב, ממשיכים באימון הבא.'),
    ('feedbackRecord','שיא אישי חדש! ההתקדמות שלך נראית.'),
    ('reminderText','יום טוב! הנה מה שמחכה לך היום.')) as x(k, v);
  return jsonb_build_object('status', 'created', 'businessID', b);
end $$;

revoke all on function setup.create_business(text, text, text) from public, anon, authenticated;
