export interface LogEntry {
  actor: string;
  action: string;
  target: string;
  summary: string;
  timestamp?: string;
}

export interface AuditLogger {
  append(entry: LogEntry): Promise<string>;
}
