import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { db, demoMode } from "./db";
export const sessionDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get("erta_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sessionDigest(token) },
    include: { user: true },
  });
  return session && session.expiresAt > new Date() ? session.user : null;
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
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  (await cookies()).set("erta_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      (process.env.NODE_ENV === "production" && !demoMode()) ||
      (process.env.APP_ORIGIN?.startsWith("https:") ?? false),
    path: "/",
    maxAge: 7 * 86400,
  });
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
