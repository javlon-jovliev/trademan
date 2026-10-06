import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { db, demoMode } from "./db";
import {
  SESSION_IDLE_SECONDS,
  SESSION_MAX_SECONDS,
  sessionExpiry,
  sessionIsValid,
} from "./session-policy";
export const sessionDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get("erta_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sessionDigest(token) },
    include: { user: true },
  });
  return session && sessionIsValid(session, new Date()) ? session.user : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function issueSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: sessionDigest(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_IDLE_SECONDS * 1000),
    },
  });
  await setSessionCookie(token, SESSION_IDLE_SECONDS);
}
async function setSessionCookie(token: string, maxAge: number) {
  (await cookies()).set("erta_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      (process.env.NODE_ENV === "production" && !demoMode()) ||
      (process.env.APP_ORIGIN?.startsWith("https:") ?? false),
    path: "/",
    maxAge,
  });
}
export async function renewSession() {
  const token = (await cookies()).get("erta_session")?.value;
  if (!token) return false;
  const id = sessionDigest(token);
  const session = await db.session.findUnique({ where: { id } });
  const now = new Date();
  if (!session || !sessionIsValid(session, now)) return false;
  const expiresAt = sessionExpiry(session.createdAt, now);
  // Never resurrect a revoked or concurrently expired session.
  const result = await db.session.updateMany({
    where: {
      id,
      expiresAt: { gt: now },
      createdAt: { gt: new Date(+now - SESSION_MAX_SECONDS * 1000) },
    },
    data: { expiresAt },
  });
  if (!result.count) return false;
  await setSessionCookie(token, Math.floor((+expiresAt - +now) / 1000));
  return true;
}
export async function logoutSession() {
  const jar = await cookies();
  const token = jar.get("erta_session")?.value;
  if (token)
    await db.session.deleteMany({ where: { id: sessionDigest(token) } });
  jar.delete("erta_session");
}
export async function loginAllowed(username: string) {
  const key = sessionDigest(username.toLowerCase());
  const now = new Date();
  await db.loginAttempt.deleteMany({ where: { expiresAt: { lt: now } } });
  const attempt = await db.loginAttempt.upsert({
    where: { key },
    create: { key, count: 1, expiresAt: new Date(Date.now() + 900000) },
    update: { count: { increment: 1 } },
  });
  return attempt.count <= 10;
}
