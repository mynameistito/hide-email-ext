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

    const redactor = createRedactor();
    let started = false;

    const apply = (next: string[] | null | undefined): void => {
      const list = next ?? [];
      redactor.setEmails(list);
      if (!started && list.length > 0) {
        started = true;
        redactor.start();
      }
    };

    if (emails.length > 0) {
      apply(emails);
    }
    hiddenEmailsItem.watch(apply);
  },
  matches: ["<all_urls>"],
  runAt: "document_start",
});
