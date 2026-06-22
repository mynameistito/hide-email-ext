import { beforeEach, describe, expect, test } from "bun:test";

import { fakeBrowser } from "wxt/testing";

import {
  addHiddenEmail,
  getHiddenEmails,
  removeHiddenEmail,
} from "../src/lib/storage";
import type { NormalizedEmail } from "../src/lib/types";

const email1 = "alice@example.com" as NormalizedEmail;
const email2 = "bob@test.org" as NormalizedEmail;

describe("storage", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  test("getHiddenEmails returns empty array by default", async () => {
    const result = await getHiddenEmails();
    expect(result).toEqual([]);
  });

  test("addHiddenEmail stores an email", async () => {
    await addHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toEqual([email1]);
  });

  test("addHiddenEmail does not add duplicates", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toEqual([email1]);
  });

  test("addHiddenEmail preserves insertion order", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email2);

    const result = await getHiddenEmails();
    expect(result).toEqual([email1, email2]);
  });

  test("removeHiddenEmail removes an email", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email2);
    await removeHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toEqual([email2]);
  });

  test("removeHiddenEmail handles non-existent email gracefully", async () => {
    await addHiddenEmail(email1);
    await removeHiddenEmail(email2);

    const result = await getHiddenEmails();
    expect(result).toEqual([email1]);
  });
});
