import { parseConnections } from './parser';
import { buildCsv, downloadCsv } from '../export/csv';
import { scrollAndCollect, ProgressInfo } from './scroll';
import { SELECTORS } from './selectors';

declare global {
  interface Window {
    __liExporterLoaded?:    boolean;
    __liExporterProgress?:  ProgressInfo;
  }
}

if (!window.__liExporterLoaded) {
  window.__liExporterLoaded = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

    if (msg.type === 'PROGRESS') {
      sendResponse(window.__liExporterProgress ?? { found: 0, total: null, elapsedMs: 0, remainingMs: null });
      return false;
    }

    if (msg.type === 'EXPORT') {
      window.__liExporterProgress = { found: 0, total: null, elapsedMs: 0, remainingMs: null };

      (async () => {
        const connections = await scrollAndCollect({
          getCards: () => parseConnections(document),

          triggerNextLoad: () => {
            const btn = Array.from(document.querySelectorAll('button'))
              .find(b => b.textContent.trim() === SELECTORS.LOAD_MORE_BUTTON_TEXT) as HTMLButtonElement | undefined;
            if (!btn) return false;
            btn.click();
            return true;
          },

          wait: (ms) => new Promise((r) => setTimeout(r, ms)),

          getRenderedCardCount: () =>
            document.querySelectorAll(SELECTORS.CARD).length,

          getTotalCount: () => {
            const el = document.querySelector(SELECTORS.CONNECTIONS_TOTAL);
            if (!el) return null;
            const match = el.textContent?.match(/(\d[\d,]*)/);
            return match ? parseInt(match[1].replace(/,/g, ''), 10) : null;
          },

          onProgress: (info) => {
            window.__liExporterProgress = info;
          },
        });

        const csv = buildCsv(connections);
        downloadCsv(csv);
        sendResponse({ count: connections.length });
      })();

      return true;
    }
  });
}
