import { storage } from "wxt/utils/storage";

import type { NormalizedEmail } from "./types";

export const hiddenEmailsItem = storage.defineItem<NormalizedEmail[]>(
  "sync:hiddenEmails",
  { fallback: [] }
);

export const getHiddenEmails = (): Promise<NormalizedEmail[]> =>
  hiddenEmailsItem.getValue();

export const addHiddenEmail = async (email: NormalizedEmail): Promise<void> => {
  const current = await getHiddenEmails();
  if (current.includes(email)) {
    return;
  }
  await hiddenEmailsItem.setValue([...current, email]);
};

export const removeHiddenEmail = async (
  email: NormalizedEmail
): Promise<void> => {
  const current = await getHiddenEmails();
  if (!current.includes(email)) {
    return;
  }
  await hiddenEmailsItem.setValue(current.filter((e) => e !== email));
};
