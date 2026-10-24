type Deadline = string | Date | null | undefined;

export type SavedBookingReservation = {
  id: number;
  orderId: number;
  expiresAt: string | null;
  expired?: boolean;
};

// Every candidate comes from a server response. A later payment response must
// never restart the countdown for a reservation that has already been created.
export function earliestReservationDeadline(...deadlines: Deadline[]): string | null {
  const timestamps = deadlines
    .map((deadline) => deadline instanceof Date ? deadline.getTime() : Date.parse(deadline ?? ""))
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
}

export function reservationSecondsRemaining(deadline: Deadline, now = Date.now()): number | null {
  const timestamp = deadline instanceof Date ? deadline.getTime() : Date.parse(deadline ?? "");
  return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - now) / 1000)) : null;
}

export function isSavedReservationExpired(
  reservation: SavedBookingReservation | null,
  confirmedPaid: boolean,
  now = Date.now(),
): boolean {
  return Boolean(reservation && !confirmedPaid
    && (reservation.expired || reservationSecondsRemaining(reservation.expiresAt, now) === 0));
}

export function isReservationExpiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // apiRequest includes the HTTP status followed by the API's JSON error body.
  try {
    const body = JSON.parse(error.message.replace(/^\d{3}:\s*/, "")) as { code?: string };
    return body.code === "ORDER_EXPIRED";
  } catch {
    return false;
  }
}

export function clearReservationSchedule<T extends { preferredTime: string; additionalPreferredTime: string }>(form: T): T {
  return { ...form, preferredTime: "", additionalPreferredTime: "" };
}
