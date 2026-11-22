import type { Browser } from "puppeteer";

type PdfBrowserGlobal = typeof globalThis & { __nextraInvoicePdfBrowser?: Promise<Browser> };
const shared = globalThis as PdfBrowserGlobal;
const maxConcurrentPages = 3;
let activePages = 0;
const pageWaiters: Array<() => void> = [];

async function acquirePageSlot(): Promise<() => void> {
  if (activePages >= maxConcurrentPages) await new Promise<void>((resolve) => pageWaiters.push(resolve));
  else activePages += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = pageWaiters.shift();
    if (next) next();
    else activePages = Math.max(0, activePages - 1);
  };
}

async function getBrowser(): Promise<Browser> {
  if (!shared.__nextraInvoicePdfBrowser) {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    const runAsRoot = process.platform === "linux" && typeof process.getuid === "function" && process.getuid() === 0;
    const noSandbox = process.env.PUPPETEER_NO_SANDBOX === "true" || runAsRoot;
    const promise = import("puppeteer").then(({ default: puppeteer }) => puppeteer.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        ...(noSandbox ? { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] } : {}),
        timeout: 30_000,
      })).then((browser) => {
      browser.once("disconnected", () => {
        if (shared.__nextraInvoicePdfBrowser === promise) shared.__nextraInvoicePdfBrowser = undefined;
      });
      return browser;
    }).catch((error: unknown) => {
      if (shared.__nextraInvoicePdfBrowser === promise) shared.__nextraInvoicePdfBrowser = undefined;
      throw error;
    });
    shared.__nextraInvoicePdfBrowser = promise;
  }

  try {
    const browser = await shared.__nextraInvoicePdfBrowser;
    if (browser.connected) return browser;
    shared.__nextraInvoicePdfBrowser = undefined;
    return getBrowser();
  } catch (error) {
    shared.__nextraInvoicePdfBrowser = undefined;
    throw error;
  }
}

/** Allows test runners and process shutdown hooks to close the shared Chromium instance. */
export async function closeInvoicePdfBrowser(): Promise<void> {
  const browserPromise = shared.__nextraInvoicePdfBrowser;
  shared.__nextraInvoicePdfBrowser = undefined;
  if (!browserPromise) return;
  try { await (await browserPromise).close(); } catch { /* The browser may already have exited. */ }
}

export async function renderHtmlPdf(html: string): Promise<Buffer> {
  const release = await acquirePageSlot();
  let page: Awaited<ReturnType<Browser["newPage"]>> | undefined;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.evaluate(async () => {
      await Promise.race([
        Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined))),
        new Promise<void>((resolve) => setTimeout(resolve, 4_000)),
      ]);
      await document.fonts.ready;
    });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="width:100%;padding:0 12mm;color:#6b7280;font:8px Arial,Helvetica,sans-serif;display:flex;justify-content:space-between"><span>Makextra Wholesale</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      // The @page CSS reserves the content area; leave a small browser footer band below it.
      margin: { top: "0mm", right: "0mm", bottom: "8mm", left: "0mm" },
      timeout: 25_000,
    });
    return Buffer.from(pdf);
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => undefined);
    release();
  }
}
