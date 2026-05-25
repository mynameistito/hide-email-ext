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

const EMAIL_HINT_RE = /[@.]/u;

const escapeRegex = (str: string): string =>
  str.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const buildRegex = (emails: NormalizedEmail[]): RegExp | null => {
  if (emails.length === 0) {
    return null;
  }
  const pattern = emails.map((e) => escapeRegex(e)).join("|");
  return new RegExp(pattern, "giu");
};

const shouldSkipCached = (
  node: Node,
  cache: WeakMap<Element, boolean>
): boolean => {
  const parent = node.parentElement;
  if (!parent) {
    return false;
  }
  const cached = cache.get(parent);
  if (cached !== undefined) {
    return cached;
  }
  let el: HTMLElement | null = parent;
  let result = false;
  while (el) {
    if (
      SKIP_TAGS.has(el.tagName) ||
      el.isContentEditable ||
      el.dataset.redacted !== undefined
    ) {
      result = true;
      break;
    }
    el = el.parentElement;
  }
  cache.set(parent, result);
  return result;
};

const tryReplaceText = (
  text: Text,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>
): void => {
  if (!text.nodeValue) {
    return;
  }
  if (shouldSkipCached(text, skipCache)) {
    return;
  }
  if (!EMAIL_HINT_RE.test(text.nodeValue)) {
    return;
  }
  regex.lastIndex = 0;
  const replaced = text.nodeValue.replaceAll(regex, REDACTION_TOKEN);
  if (replaced !== text.nodeValue) {
    text.nodeValue = replaced;
  }
};

const scanAttributes = (
  root: Element,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>
): void => {
  if (shouldSkipCached(root, skipCache)) {
    return;
  }
  for (const attr of SCANNABLE_ATTRS) {
    const value = root.getAttribute(attr);
    if (!value) {
      continue;
    }
    if (!EMAIL_HINT_RE.test(value)) {
      continue;
    }
    regex.lastIndex = 0;
    const replaced = value.replaceAll(regex, REDACTION_TOKEN);
    if (replaced !== value) {
      root.setAttribute(attr, replaced);
    }
  }
};

const scanSubtree = (
  root: Node,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>
): void => {
  for (const child of root.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      tryReplaceText(child as Text, regex, skipCache);
    }
  }
  if (root instanceof Element) {
    scanAttributes(root, regex, skipCache);
    for (const child of root.children) {
      scanSubtree(child, regex, skipCache);
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
  let pendingMutations: MutationRecord[] = [];
  let pendingFullRescan = false;
  let skipCache = new WeakMap<Element, boolean>();

  const flush = (mutations?: MutationRecord[]): void => {
    if (!regex) {
      return;
    }
    skipCache = new WeakMap<Element, boolean>();

    if (mutations) {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.target instanceof Element
        ) {
          scanAttributes(mutation.target, regex, skipCache);
        }
        if (
          mutation.type === "characterData" &&
          mutation.target instanceof Text
        ) {
          tryReplaceText(mutation.target, regex, skipCache);
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            scanSubtree(node, regex, skipCache);
          } else if (node.nodeType === Node.TEXT_NODE) {
            tryReplaceText(node as Text, regex, skipCache);
          }
        }
      }
    } else {
      scanSubtree(doc.body ?? doc, regex, skipCache);
    }
  };

  const scheduleFlush = (mutations?: MutationRecord[]): void => {
    if (mutations) {
      pendingMutations.push(...mutations);
    }
    if (scheduled) {
      return;
    }
    scheduled = true;
    const run = () => {
      const captured = pendingMutations;
      pendingMutations = [];
      const doFullRescan = pendingFullRescan;
      pendingFullRescan = false;
      scheduled = false;
      pendingTimeout = null;
      pendingIdle = null;
      if (doFullRescan) {
        flush();
      } else {
        flush(captured);
      }
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
    skipCache = new WeakMap<Element, boolean>();
    scanSubtree(doc.body ?? doc, regex, skipCache);
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
    pendingMutations = [];
    pendingFullRescan = false;
  };

  return {
    setEmails(emails: NormalizedEmail[]) {
      regex = buildRegex(emails);
      if (observer) {
        pendingFullRescan = true;
        scheduleFlush();
      }
    },
    start,
    stop,
  };
};
