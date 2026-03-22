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
          // Parse currently visible cards on every cycle — virtual list means
          // cards scroll out of the DOM, so we must collect incrementally.
          getCards: () => parseConnections(document),
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

        const csv = buildCsv(connections);
        downloadCsv(csv);
        sendResponse({ count: connections.length });
      })();

      return true;
    }
  });
}
