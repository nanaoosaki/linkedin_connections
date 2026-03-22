const exportBtn  = document.getElementById('export')  as HTMLButtonElement;
const progressEl = document.getElementById('progress') as HTMLProgressElement;
const statusEl   = document.getElementById('status')!;

exportBtn.addEventListener('click', async () => {
  exportBtn.disabled = true;
  progressEl.style.display = 'block';
  progressEl.removeAttribute('value'); // indeterminate spinner
  statusEl.textContent = 'Loading connections...';

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('No active tab');

    // Inject content script (idempotent — guard in content.js prevents double-registration)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });

    // Poll for live progress while the scroll loop runs in the content script
    pollTimer = setInterval(async () => {
      try {
        const res = await chrome.tabs.sendMessage(tab.id!, { type: 'PROGRESS' });
        if (res?.count > 0) {
          statusEl.textContent = `Loading connections… ${res.count} found`;
        }
      } catch { /* tab may not be ready yet — ignore */ }
    }, 800);

    // This resolves only after scrolling is complete and the CSV is downloaded
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXPORT' });

    clearInterval(pollTimer);
    progressEl.style.display = 'none';
    statusEl.textContent = `Exported ${response.count} connection(s).`;

  } catch (e) {
    if (pollTimer) clearInterval(pollTimer);
    progressEl.style.display = 'none';
    const msg = (e as Error).message ?? String(e);
    statusEl.textContent = msg.includes('Cannot access') || msg.includes('activeTab')
      ? 'Error: navigate to your LinkedIn connections page first.'
      : `Error: ${msg}`;
  } finally {
    exportBtn.disabled = false;
  }
});
