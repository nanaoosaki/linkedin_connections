import { parseConnections } from './parser';
import { buildCsv, downloadCsv } from '../export/csv';
import { scrollAndCollect } from './scroll';
import { SELECTORS } from './selectors';

declare global {
  interface Window {
    __liExporterLoaded?: boolean;
    __liExporterProgress?: number;
  }
}

if (!window.__liExporterLoaded) {
  window.__liExporterLoaded = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

    if (msg.type === 'PROGRESS') {
      sendResponse({ count: window.__liExporterProgress ?? 0 });
      return false;
    }

    if (msg.type === 'EXPORT') {
      window.__liExporterProgress = 0;

      (async () => {
        const connections = await scrollAndCollect({
          getCards: () => parseConnections(document),
          triggerNextLoad: () => {
            // Find "Load more" button by text content — no stable attribute exists.
            // Button absence means all connections are loaded.
            const btn = Array.from(document.querySelectorAll('button'))
              .find(b => b.textContent.trim() === SELECTORS.LOAD_MORE_BUTTON_TEXT) as HTMLButtonElement | undefined;
            if (!btn) return false;
            btn.click();
            return true;
          },
          wait: (ms) => new Promise((r) => setTimeout(r, ms)),
          onProgress: (count) => {
            window.__liExporterProgress = count;
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
