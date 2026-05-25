import type { NormalizedEmail } from "./types";
import { REDACTION_TOKEN } from "./types";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
]);

const SCANNABLE_ATTRS = ["title", "aria-label", "alt", "placeholder"] as const;

const escapeRegex = (str: string): string =>
  str.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const buildRegex = (emails: NormalizedEmail[]): RegExp | null => {
  if (emails.length === 0) {
    return null;
  }
  const pattern = emails.map((e) => escapeRegex(e)).join("|");
  return new RegExp(pattern, "giu");
};

const shouldSkip = (node: Node): boolean => {
  let el: HTMLElement | null = node.parentElement;
  while (el) {
    if (
      SKIP_TAGS.has(el.tagName) ||
      el.isContentEditable ||
      el.dataset.redacted !== undefined
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
};

const scanAttributes = (root: Element, regex: RegExp): void => {
  for (const attr of SCANNABLE_ATTRS) {
    const value = root.getAttribute(attr);
    if (!value) {
      continue;
    }
    regex.lastIndex = 0;
    const replaced = value.replaceAll(regex, REDACTION_TOKEN);
    if (replaced !== value) {
      root.setAttribute(attr, replaced);
    }
  }
};

const scanSubtree = (root: Node, regex: RegExp): void => {
  for (const child of root.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child as Text;
      if (text.nodeValue && !shouldSkip(text)) {
        regex.lastIndex = 0;
        const replaced = text.nodeValue.replaceAll(regex, REDACTION_TOKEN);
        if (replaced !== text.nodeValue) {
          text.nodeValue = replaced;
        }
      }
    }
  }
  if (root instanceof Element) {
    scanAttributes(root, regex);
    for (const child of root.children) {
      scanSubtree(child, regex);
    }
  }
};

export interface Redactor {
  setEmails(emails: NormalizedEmail[]): void;
  start(): void;
  stop(): void;
}

export const createRedactor = (root?: Document): Redactor => {
  const doc = root ?? document;
  let regex: RegExp | null = null;
  let observer: MutationObserver | null = null;
  let scheduled = false;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingIdle: number | null = null;

  const flush = (mutations?: MutationRecord[]): void => {
    if (!regex) {
      return;
    }

    if (mutations) {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.target instanceof Element
        ) {
          scanAttributes(mutation.target, regex);
        }
        if (
          mutation.type === "characterData" &&
          mutation.target instanceof Text
        ) {
          const text = mutation.target;
          if (text.nodeValue && !shouldSkip(text)) {
            regex.lastIndex = 0;
            const replaced = text.nodeValue.replaceAll(regex, REDACTION_TOKEN);
            if (replaced !== text.nodeValue) {
              text.nodeValue = replaced;
            }
          }
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            scanSubtree(node, regex);
          } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node as Text;
            if (text.nodeValue && !shouldSkip(text)) {
              regex.lastIndex = 0;
              const replaced = text.nodeValue.replaceAll(
                regex,
                REDACTION_TOKEN
              );
              if (replaced !== text.nodeValue) {
                text.nodeValue = replaced;
              }
            }
          }
        }
      }
    } else {
      scanSubtree(doc.body ?? doc, regex);
    }
  };

  const scheduleFlush = (mutations?: MutationRecord[]): void => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    const run = () => {
      scheduled = false;
      pendingTimeout = null;
      pendingIdle = null;
      flush(mutations);
    };
    if ("requestIdleCallback" in window) {
      pendingIdle = requestIdleCallback(run, { timeout: 500 });
    } else {
      pendingTimeout = setTimeout(run, 100);
    }
  };

  const initialScan = (): void => {
    if (!regex) {
      return;
    }
    scanSubtree(doc.body ?? doc, regex);
  };

  const start = (): void => {
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", () => initialScan(), {
        once: true,
      });
    } else {
      initialScan();
    }

    observer = new MutationObserver((mutations) => scheduleFlush(mutations));
    observer.observe(doc.documentElement, {
      attributeFilter: [...SCANNABLE_ATTRS],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  };

  const stop = (): void => {
    observer?.disconnect();
    observer = null;
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
    if (pendingIdle !== null) {
      cancelIdleCallback(pendingIdle);
      pendingIdle = null;
    }
    scheduled = false;
  };

  return {
    setEmails(emails: NormalizedEmail[]) {
      regex = buildRegex(emails);
      if (observer) {
        scheduleFlush();
      }
    },
    start,
    stop,
  };
};
