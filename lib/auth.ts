import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById, type User } from "./db.ts";

const COOKIE = "session";
const MAX_AGE_S = 60 * 60 * 24 * 7;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET não definido.");
  return "dev-only-secret-change-me";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = crypto.scryptSync(password, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("hex");

export async function createSession(userId: number) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = `${userId}.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [id, exp, mac] = token.split(".");
  if (!id || !exp || !mac) return null;
  const expected = sign(`${id}.${exp}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return findUserById(Number(id));
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Freio simples contra tentativas de senha (memória do processo; suficiente para teste).
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW_MS) return false;
  return a.n >= MAX_ATTEMPTS;
}
export function recordFailure(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW_MS) attempts.set(key, { n: 1, first: now });
  else a.n += 1;
}
export function clearFailures(key: string) {
  attempts.delete(key);
}
