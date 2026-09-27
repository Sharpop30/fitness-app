// C03 Audit Log: every request and every reply, sharing one requestID (CLAUDE.md rule 3).
import type { AuditRecord, Repository } from "./repository.ts";

export async function audit(repo: Repository, entry: AuditRecord): Promise<boolean> {
  try {
    await repo.writeAudit(entry);
    return true;
  } catch {
    return false;
  }
}
