document.getElementById('export')!.addEventListener('click', async () => {
  const status = document.getElementById('status')!;
  status.textContent = 'Exporting...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('No active tab');

    // Programmatically inject the content script so Export works even when:
    //   - the page was open before the extension was loaded, or
    //   - the declarative content_scripts URL pattern did not match.
    // The window.__liExporterLoaded guard in content.js prevents double-registration.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXPORT' });
    status.textContent = `Exported ${response.count} connection(s).`;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (msg.includes('Cannot access') || msg.includes('activeTab')) {
      status.textContent = 'Error: make sure you are on the LinkedIn connections page.';
    } else {
      status.textContent = `Error: ${msg}`;
    }
  }
});
