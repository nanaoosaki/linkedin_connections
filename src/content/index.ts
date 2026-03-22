import { parseConnections } from './parser';
import { buildCsv, downloadCsv } from '../export/csv';
import { scrollUntilStable } from './scroll';
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

    // Popup polls this while the scroll loop is running
    if (msg.type === 'PROGRESS') {
      sendResponse({ count: window.__liExporterProgress ?? 0 });
      return false;
    }

    if (msg.type === 'EXPORT') {
      window.__liExporterProgress = 0;

      (async () => {
        await scrollUntilStable({
          getCardCount: () =>
            document.querySelectorAll(SELECTORS.CARD).length,
          scrollToBottom: () => {
            const el = document.scrollingElement ?? document.documentElement;
            el.scrollTop = el.scrollHeight;
          },
          wait: (ms) => new Promise((r) => setTimeout(r, ms)),
          isEndOfList: () =>
            document.querySelector(SELECTORS.END_OF_LIST) !== null,
          onProgress: (count) => {
            window.__liExporterProgress = count;
          },
        });

        const connections = parseConnections(document);
        const csv = buildCsv(connections);
        downloadCsv(csv);
        sendResponse({ count: connections.length });
      })();

      return true; // keep message channel open for async response
    }
  });
}
