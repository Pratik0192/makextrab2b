# Invoice PDF rendering

Invoice PDF rendering runs in the Node.js server process. `renderInvoicePdf` converts the saved invoice data into HTML with `renderInvoiceHtml`, then calls Puppeteer/Chromium to produce an A4 PDF buffer. The existing issue and regeneration services pass that buffer to the Cloudinary storage helper; PDF versions and audit records remain managed by the existing invoice service.

## Local setup

- Use Node.js 22.12 or newer (Puppeteer 25 requirement).
- Run `npm install`; Puppeteer downloads a compatible Chrome for Testing browser unless browser download is disabled by the environment.
- Run `npm run dev`. The first PDF render starts a shared Chromium process; subsequent renders reuse it. Each render uses a separate page, closes the page afterward, and concurrent rendering is capped at three pages per server process.
- `PUPPETEER_EXECUTABLE_PATH` is optional. Set it to a Chrome/Chromium executable when using a system-installed browser instead of Puppeteer's downloaded browser.
- `PUPPETEER_NO_SANDBOX=true` opts into no-sandbox mode for containers that require it. The renderer also enables it automatically when running as root on Linux. Prefer a non-root service account when the hosting platform supports it.

## Production deployment

The repository does not specify a production host or container image. Deploy to a persistent Node.js server/container that can launch Chromium and has the Linux shared libraries and fonts required by Puppeteer's browser. Ensure dependency installation includes Puppeteer's browser download; if deployment policy skips install scripts/downloads, provision Chrome separately and set `PUPPETEER_EXECUTABLE_PATH`. Configure `PUPPETEER_NO_SANDBOX=true` only when the container security model requires it.

The app exposes `next start` and a PM2 script, but no Dockerfile or deployment manifest is present to establish which production runtime is actually used. Validate Chromium startup and a real invoice PDF on the selected host before release.
