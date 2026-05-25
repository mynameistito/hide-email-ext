import { storage } from "#imports";

import type { NormalizedEmail } from "./types";

export const hiddenEmailsItem = storage.defineItem<NormalizedEmail[]>(
  "sync:hiddenEmails",
  { fallback: [] }
);

export const getHiddenEmails = (): Promise<NormalizedEmail[]> =>
  hiddenEmailsItem.getValue();

export const addHiddenEmail = async (email: NormalizedEmail): Promise<void> => {
  const current = await getHiddenEmails();
  const updated = [...new Set([...current, email])];
  await hiddenEmailsItem.setValue(updated);
};

export const removeHiddenEmail = async (
  email: NormalizedEmail
): Promise<void> => {
  const current = await getHiddenEmails();
  const updated = current.filter((e) => e !== email);
  await hiddenEmailsItem.setValue(updated);
};
