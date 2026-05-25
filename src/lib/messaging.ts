import type { Message } from "./types";

export const send = async (msg: Message): Promise<void> => {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  for (const t of tabs) {
    if (t.id !== undefined) {
      try {
        await browser.tabs.sendMessage(t.id, msg);
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (!text.includes("Receiving end does not exist")) {
          console.error("Failed to send message to tab:", error);
        }
      }
    }
  }
};

export const onMessage = (handler: (msg: Message) => void): (() => void) => {
  const listener = (message: unknown) => {
    if (typeof message === "object" && message !== null && "type" in message) {
      const msg = message as Record<string, unknown>;
      if (
        (msg.type === "EMAILS_UPDATED" && Array.isArray(msg.emails)) ||
        msg.type === "REQUEST_RESCAN"
      ) {
        handler(message as Message);
      }
    }
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
};
