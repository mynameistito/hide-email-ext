import { GlobalWindow } from "happy-dom";
import { fakeBrowser } from "wxt/testing";

const window = new GlobalWindow();

const g = globalThis as unknown as Record<string, unknown>;

for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in g)) {
    g[key] = (window as unknown as Record<string, unknown>)[key];
  }
}

const domGlobals = [
  "Event",
  "CustomEvent",
  "Node",
  "Text",
  "Element",
  "HTMLElement",
  "Document",
  "DocumentFragment",
  "MutationObserver",
  "NodeFilter",
  "DOMParser",
  "Range",
  "Selection",
  "TreeWalker",
  "ResizeObserver",
];

const w = window as unknown as Record<string, unknown>;

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: w[key],
    writable: true,
  });
}

g.window = window;
g.document = window.document;

const ric = (task: () => void): ReturnType<typeof setTimeout> =>
  setTimeout(task, 0);
const cic = (id: ReturnType<typeof setTimeout>): void => clearTimeout(id);

w.requestIdleCallback = ric;
w.cancelIdleCallback = cic;
g.requestIdleCallback = ric;
g.cancelIdleCallback = cic;

g.browser = fakeBrowser;
