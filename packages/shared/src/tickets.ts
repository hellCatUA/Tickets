/** Default ticket statuses (names/colors become Admin-configurable in M1). */
export enum TicketStatus {
  New = 'new',
  InProgress = 'in_progress',
  WaitingForRequester = 'waiting_for_requester',
  WaitingForVendor = 'waiting_for_vendor',
  Resolved = 'resolved',
  Closed = 'closed',
  Cancelled = 'cancelled',
}

export enum TicketPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical',
}

/** Canonical ticket number, e.g. T-2026-0042 (global increment, resets yearly). */
export function formatTicketNumber(year: number, seq: number): string {
  return `T-${year}-${String(seq).padStart(4, '0')}`;
}
