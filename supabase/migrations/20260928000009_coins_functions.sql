-- 0009: atomic coins writes (stage 4b plan, decision 4, approved 28.09.2026). No table changes.
-- UC7 step 8: a redemption checks the balance, then writes a debit and a redemption "pending", whole or not at all.
-- UC7 step 1 (team decision): a goal reached is credited once and closed, in the same transaction.
-- The balance is computed from the ledger (Business Logic rule 7). A lock per trainee keeps two redemptions at
-- the same time from going below zero.
-- Called only from supabase/functions/api/repository.ts with the service role; closed to the browser roles.

create or replace function public.coins_redeem(p_trainee uuid, p_reward uuid) returns jsonb
language plpgsql as $$
declare
  price int;
  bal int;
  red_id uuid := gen_random_uuid();
  tx_id uuid;
begin
  -- Only an active reward of the trainee's own coach (rule 5).
  select r."priceCoins" into price
    from rewards r join trainees t on t."CoachID" = r."CoachID"
   where r."RewardID" = p_reward and r."isActive" and t."TraineeID" = p_trainee;
  if price is null then return jsonb_build_object('status', 'no_reward'); end if;

  perform pg_advisory_xact_lock(hashtext('coins:' || p_trainee::text));
  select coalesce(sum("amount"), 0) into bal from coin_transactions where "TraineeID" = p_trainee;
  if bal < price then return jsonb_build_object('status', 'insufficient', 'balance', bal); end if;

  insert into coin_transactions ("TraineeID","eventType","eventRef","amount")
  values (p_trainee, 'redeem', red_id::text, -price) returning "CoinTransactionID" into tx_id;
  insert into redemptions ("RedemptionID","TraineeID","RewardID","CoinTransactionID")
  values (red_id, p_trainee, p_reward, tx_id);
  return jsonb_build_object('status', 'ok', 'balance', bal - price);
end $$;

-- True when this call closed the goal and credited it; false when it was no longer active.
create or replace function public.coins_achieve_goal(p_goal uuid, p_amount int) returns boolean
language plpgsql as $$
declare trainee uuid;
begin
  update personal_goals set "status" = 'achieved', "achievedAt" = now()
   where "PersonalGoalID" = p_goal and "status" = 'active'
   returning "TraineeID" into trainee;
  if trainee is null then return false; end if;
  insert into coin_transactions ("TraineeID","eventType","eventRef","amount")
  values (trainee, 'goal', p_goal::text, p_amount)
  on conflict ("eventType","eventRef") do nothing;
  return true;
end $$;

revoke all on function public.coins_redeem(uuid, uuid) from public, anon, authenticated;
revoke all on function public.coins_achieve_goal(uuid, int) from public, anon, authenticated;
grant execute on function public.coins_redeem(uuid, uuid) to service_role;
grant execute on function public.coins_achieve_goal(uuid, int) to service_role;
