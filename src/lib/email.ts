import type { NormalizedEmail } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const isEmail = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return EMAIL_RE.test(normalized);
};

export const normalize = (email: string): NormalizedEmail =>
  email.trim().toLowerCase() as NormalizedEmail;
