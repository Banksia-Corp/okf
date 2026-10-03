/**
 * @fileoverview Universal audit logging abstraction and entry schema for OKF knowledge operations.
 *
 * Captures lifecycle events (document creation, updates, attestations, deletions)
 * to maintain transparent provenance and operational logs across repositories.
 *
 * @packageDocumentation
 */

/**
 * Structured record representing an audit log entry.
 */
export interface LogEntry {
  /** Identifier of the actor performing the action (e.g. `human:luis`, `agent/v1.0.0`). */
  actor: string;
  /** Action verb describing the operation (e.g. `'create'`, `'verify'`, `'update'`). */
  action: string;
  /** Target file, concept ID, or bundle affected by the action. */
  target: string;
  /** Brief human-readable summary of the modification. */
  summary: string;
  /** Optional ISO-8601 timestamp string. If omitted, implementation records the current time. */
  timestamp?: string;
}

/**
 * Abstraction for appending operational audit entries to a log destination (e.g. `log.md`).
 */
export interface AuditLogger {
  /**
   * Appends an audit entry and returns the target log resource identifier or path.
   *
   * @param entry - Audit log details to append.
   * @returns A promise resolving to the target log path or resource identifier.
   */
  append(entry: LogEntry): Promise<string>;
}
