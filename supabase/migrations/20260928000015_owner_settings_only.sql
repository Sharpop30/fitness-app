-- 0015: S12 is the owner's screen only (the team's decision, 01.10.2026, alternative 1; module map v12, rule 9).
-- The coach does not see the business SETTINGS; they still apply to the coach through the modules. The row goes out of
-- use, not away (rule 6). S06 keeps its own row for noteMaxLength.
update registry_entries set "isActive" = false
 where "caller" = 'S12' and "moduleName" = 'settings' and "actionName" = 'get_settings' and "allowedRole" = 'coach';
