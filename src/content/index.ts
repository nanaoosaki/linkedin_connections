import { parseConnections } from './parser';
import { buildCsv, downloadCsv } from '../export/csv';

// Guard against double-registration when the popup injects this script
// into a tab that already has it running from the declarative content_scripts.
declare global {
  interface Window { __liExporterLoaded?: boolean; }
}

if (!window.__liExporterLoaded) {
  window.__liExporterLoaded = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'EXPORT') {
      const connections = parseConnections(document);
      const csv = buildCsv(connections);
      downloadCsv(csv);
      sendResponse({ count: connections.length });
    }
    return true;
  });
}
