import { describe, expect, test } from "bun:test";

import { REDACTION_TOKEN } from "../src/lib/types";

describe("types", () => {
  test("REDACTION_TOKEN is the expected redaction placeholder", () => {
    expect(REDACTION_TOKEN).toBe("[Email Redacted]");
  });
});
