import { defineContentScript } from "#imports";
import { createRedactor } from "@/src/lib/redact";
import { hiddenEmailsItem } from "@/src/lib/storage";

export default defineContentScript({
  async main() {
    let emails: string[] = [];
    try {
      emails = (await hiddenEmailsItem.getValue()) ?? [];
    } catch {
      emails = [];
    }

    if (emails.length === 0) {
      hiddenEmailsItem.watch((next) => {
        if (next && next.length > 0) {
          const redactor = createRedactor();
          redactor.setEmails(next);
          redactor.start();
        }
      });
      return;
    }

    const redactor = createRedactor();
    redactor.setEmails(emails);
    redactor.start();
    hiddenEmailsItem.watch((next) => {
      redactor.setEmails(next ?? []);
    });
  },
  matches: ["<all_urls>"],
  runAt: "document_start",
});
