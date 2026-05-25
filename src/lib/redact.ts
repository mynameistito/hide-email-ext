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

const scanTextNodes = (root: Node, regex: RegExp): number => {
  let count = 0;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    (node) => {
      if (shouldSkip(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue && regex.test(node.nodeValue)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    }
  );

  const nodes: Text[] = [];
  let current: Text | null;
  while ((current = walker.nextNode() as Text | null)) {
    nodes.push(current);
  }

  for (const node of nodes) {
    const original = node.nodeValue;
    if (!original) {
      continue;
    }
    regex.lastIndex = 0;
    const replaced = original.replaceAll(regex, REDACTION_TOKEN);
    if (replaced !== original) {
      node.nodeValue = replaced;
      count += 1;
    }
  }
  return count;
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
  scanTextNodes(root, regex);
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
  let pendingFrame: ReturnType<typeof setTimeout> | null = null;

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

    pendingFrame = null;
  };

  const scheduleFlush = (mutations?: MutationRecord[]): void => {
    if (pendingFrame !== null) {
      return;
    }
    const run = () => flush(mutations);
    if ("requestIdleCallback" in window) {
      requestIdleCallback(run, { timeout: 500 });
    } else {
      pendingFrame = setTimeout(run, 100);
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
    if (pendingFrame !== null) {
      clearTimeout(pendingFrame);
      pendingFrame = null;
    }
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
