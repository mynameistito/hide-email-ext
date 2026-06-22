import { defineContentScript } from "wxt/utils/define-content-script";

import { createRedactor } from "@/src/lib/redact";
import { hiddenEmailsItem } from "@/src/lib/storage";
import type { NormalizedEmail } from "@/src/lib/types";

export default defineContentScript({
  async main() {
    let emails: NormalizedEmail[] = [];
    try {
      emails = (await hiddenEmailsItem.getValue()) ?? [];
    } catch {
      emails = [];
    }

    const redactor = createRedactor();
    let started = false;

    const apply = (next: NormalizedEmail[] | null | undefined): void => {
      const list = next ?? [];
      redactor.setEmails(list);
      if (!started && list.length > 0) {
        started = true;
        redactor.start();
      } else if (started && list.length === 0) {
        started = false;
        redactor.stop();
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
