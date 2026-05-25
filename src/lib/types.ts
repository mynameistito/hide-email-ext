export type NormalizedEmail = string & { readonly __brand: "NormalizedEmail" };

export interface StorageSchema {
  hiddenEmails: NormalizedEmail[];
}

export type Message =
  | { type: "EMAILS_UPDATED"; emails: NormalizedEmail[] }
  | { type: "REQUEST_RESCAN" };

export const REDACTION_TOKEN = "[Email Redacted]" as const;
export type RedactionToken = typeof REDACTION_TOKEN;
