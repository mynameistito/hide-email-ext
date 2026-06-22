export type NormalizedEmail = string & { readonly __brand: "NormalizedEmail" };

export const REDACTION_TOKEN = "[Email Redacted]" as const;
