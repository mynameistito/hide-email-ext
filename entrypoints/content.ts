import { defineContentScript } from "#imports";
import { createRedactor } from "@/src/lib/redact";
import { hiddenEmailsItem } from "@/src/lib/storage";

export default defineContentScript({
  allFrames: true,
  async main() {
    const redactor = createRedactor();
    const emails = await hiddenEmailsItem.getValue();
    redactor.setEmails(emails ?? []);
    redactor.start();
    hiddenEmailsItem.watch((next) => {
      redactor.setEmails(next ?? []);
    });
  },
  matches: ["<all_urls>"],
  runAt: "document_start",
});
