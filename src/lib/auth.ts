import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "fallback-secret-change-me"
);

const COOKIE_NAME = "kdx_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION}s`)
    .setIssuedAt()
    .sign(SECRET);

  const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000);

  await db.session.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: string };
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async () => {
  const token = await getSessionToken();
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const session = await db.session.findUnique({
    where: { token, expiresAt: { gt: new Date() } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          userCode: true,
          markup: true,
          isActive: true,
          branchId: true,
          branch: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!session || !session.user.isActive) return null;
  return session.user;
});

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await createSession(user.id);
  await setSessionCookie(token);
  return user;
}

export async function logout() {
  const token = await getSessionToken();
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {});
  }
  await deleteSessionCookie();
}

export type AuthUser = Awaited<ReturnType<typeof getCurrentUser>>;
