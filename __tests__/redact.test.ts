import { afterEach, describe, expect, test } from "bun:test";

import { createRedactor } from "../src/lib/redact";
import type { NormalizedEmail } from "../src/lib/types";
import { REDACTION_TOKEN } from "../src/lib/types";

const flush = async (): Promise<void> => {
  await Bun.sleep(200);
};

const email = "user@example.com" as NormalizedEmail;

describe("redactor", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("title");
    document.documentElement.removeAttribute("aria-label");
    document.documentElement.removeAttribute("alt");
    document.documentElement.removeAttribute("placeholder");
  });

  test("redacts matching email text in document body", async () => {
    document.body.innerHTML = `<p>Contact me at ${email}</p>`;

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    expect(document.body.textContent).toContain(REDACTION_TOKEN);
    expect(document.body.textContent).not.toContain(email);
  });

  test("does not redact inside skipped tags", async () => {
    document.body.innerHTML = `<script>var e = "${email}";</script><style>a[data="${email}"]{}</style><textarea>${email}</textarea>`;

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    expect(document.body.querySelector("script")?.textContent).toContain(email);
    expect(document.body.querySelector("style")?.textContent).toContain(email);
    expect(document.body.querySelector("textarea")?.textContent).toContain(
      email
    );
  });

  test("redacts email in scannable attributes", async () => {
    document.body.innerHTML = `<a title="Email ${email}" aria-label="Copy ${email}">link</a>`;

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    expect(document.body.querySelector("a")?.getAttribute("title")).toBe(
      `Email ${REDACTION_TOKEN}`
    );
    expect(document.body.querySelector("a")?.getAttribute("aria-label")).toBe(
      `Copy ${REDACTION_TOKEN}`
    );
  });

  test("skips elements marked with data-redacted", async () => {
    document.body.innerHTML = `<div data-redacted="true"><p>${email}</p></div>`;

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    expect(document.body.querySelector("p")?.textContent).toContain(email);
  });

  test("does not redact when no emails are set", async () => {
    document.body.innerHTML = `<p>${email}</p>`;

    redactor = createRedactor();
    redactor.start();

    await flush();

    expect(document.body.textContent).toContain(email);
  });

  test("redacts multiple distinct emails", async () => {
    const second = "admin@other.io" as NormalizedEmail;

    document.body.innerHTML = `<span>${email}</span><span>${second}</span>`;

    redactor = createRedactor();
    redactor.setEmails([email, second]);
    redactor.start();

    await flush();

    const spans = document.body.querySelectorAll("span");
    expect(spans[0]?.textContent).toBe(REDACTION_TOKEN);
    expect(spans[1]?.textContent).toBe(REDACTION_TOKEN);
  });

  test("setEmails with empty array disables redaction", async () => {
    document.body.innerHTML = `<p>${email}</p>`;

    redactor = createRedactor();
    redactor.setEmails([]);
    redactor.start();

    await flush();

    expect(document.body.textContent).toContain(email);
  });

  test("updates emails and rescans while running", async () => {
    document.body.innerHTML = `<p>${email}</p>`;

    redactor = createRedactor();
    redactor.start();
    await flush();

    expect(document.body.textContent).toContain(email);

    redactor.setEmails([email]);
    await flush();

    expect(document.body.textContent).toContain(REDACTION_TOKEN);
  });

  test("handles empty text nodes without error", async () => {
    document.body.innerHTML = `<p></p>`;
    const p = document.body.querySelector("p");
    p?.append(document.createTextNode(""));

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();
  });

  test("handles attribute mutations on root element without parent", async () => {
    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    document.documentElement.setAttribute("title", email);
    await flush();
  });

  test("stop cancels pending idle callback", () => {
    document.body.innerHTML = `<p>${email}</p>`;

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    redactor.setEmails([email]);
    redactor.stop();
    redactor = null;
  });

  test("stop cancels pending timeout fallback", () => {
    const w = window as unknown as Record<
      string,
      ((...args: unknown[]) => unknown) | undefined
    >;
    const ric = w.requestIdleCallback;
    const cic = w.cancelIdleCallback;
    delete w.requestIdleCallback;
    delete w.cancelIdleCallback;

    try {
      document.body.innerHTML = `<p>${email}</p>`;

      redactor = createRedactor();
      redactor.setEmails([email]);
      redactor.start();
      redactor.setEmails([email]);
      redactor.stop();
      redactor = null;
    } finally {
      w.requestIdleCallback = ric;
      w.cancelIdleCallback = cic;
    }
  });

  test("scans after DOMContentLoaded when document is loading", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "readyState"
    );

    try {
      Object.defineProperty(document, "readyState", {
        configurable: true,
        value: "loading",
      });

      document.body.innerHTML = `<p>${email}</p>`;

      redactor = createRedactor();
      redactor.setEmails([email]);
      redactor.start();
      await flush();

      expect(document.body.textContent).toContain(email);

      Object.defineProperty(document, "readyState", {
        configurable: true,
        value: "complete",
      });
      document.dispatchEvent(new Event("DOMContentLoaded"));
      await flush();

      expect(document.body.textContent).toContain(REDACTION_TOKEN);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, "readyState", originalDescriptor);
      } else {
        delete (document as { readyState?: DocumentReadyState }).readyState;
      }
    }
  });
});
