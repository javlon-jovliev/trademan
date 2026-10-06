export const SESSION_IDLE_SECONDS = 30 * 60;
export const SESSION_MAX_SECONDS = 5 * 60 * 60;
export function sessionExpiry(createdAt: Date, now: Date): Date {
  return new Date(
    Math.min(
      +now + SESSION_IDLE_SECONDS * 1000,
      +createdAt + SESSION_MAX_SECONDS * 1000,
    ),
  );
}
export function sessionIsValid(
  session: { createdAt: Date; expiresAt: Date },
  now: Date,
): boolean {
  return (
    +session.expiresAt > +now &&
    +session.createdAt + SESSION_MAX_SECONDS * 1000 > +now
  );
}
