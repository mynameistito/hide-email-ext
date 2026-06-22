import { describe, expect, test } from "bun:test";

import { isEmail, normalize } from "../src/lib/email";

describe("email helpers", () => {
  test("accepts valid email strings after trimming and lowercasing", () => {
    expect(isEmail("USER@example.com")).toBe(true);
    expect(isEmail("  user.name+tag@example.co.uk  ")).toBe(true);
  });

  test("rejects non-email values", () => {
    expect(isEmail(null)).toBe(false);
    expect(isEmail(123)).toBe(false);
    expect(isEmail({})).toBe(false);
    expect(isEmail("user@example")).toBe(false);
    expect(isEmail("user @example.com")).toBe(false);
    expect(isEmail("user@example .com")).toBe(false);
  });

  test("normalizes emails for stable storage and matching", () => {
    const normalized = normalize("  USER.Name+Tag@Example.COM  ");

    expect(String(normalized)).toBe("user.name+tag@example.com");
  });
});
