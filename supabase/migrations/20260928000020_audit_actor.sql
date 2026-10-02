-- 0020: who made the request, in AUDIT_ENTRIES (stage 7c, team decision 02.10.2026, from the security review: "the log
-- does not say who acted"; ERD logical v3, diagram 07f). The verified identity user and their business, from the
-- Endpoint, never from the browser. Null when there is none: a visitor's invite check, a request refused before the
-- identity is known, or a newcomer not yet in a business. No password or token. No foreign keys: the log outlives the
-- rows it names (demo.unload removes the demo business, and its log rows stay, CLAUDE.md rule 9).
alter table audit_entries add column "authUserID" uuid;
alter table audit_entries add column "BusinessID" uuid;
