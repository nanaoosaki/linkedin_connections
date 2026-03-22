const exportBtn  = document.getElementById('export')   as HTMLButtonElement;
const progressEl = document.getElementById('progress')  as HTMLProgressElement;
const statusEl   = document.getElementById('status')!;
const etaEl      = document.getElementById('eta')!;

function formatRemaining(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `~${s}s remaining`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `~${m}m ${rem}s remaining` : `~${m}m remaining`;
}

function updateProgress(res: {
  found: number;
  total: number | null;
  remainingMs: number | null;
}): void {
  const { found, total, remainingMs } = res;

  if (total !== null) {
    // Determinate: show X / total and fill the bar
    progressEl.max   = total;
    progressEl.value = found;
    statusEl.textContent = `Loading connections… ${found} / ${total}`;
  } else {
    // Indeterminate: no total available
    progressEl.removeAttribute('value');
    if (found > 0) statusEl.textContent = `Loading connections… ${found} found`;
  }

  etaEl.textContent = remainingMs !== null && remainingMs > 1000
    ? formatRemaining(remainingMs)
    : '';
}

exportBtn.addEventListener('click', async () => {
  exportBtn.disabled = true;
  progressEl.style.display = 'block';
  progressEl.removeAttribute('value');
  statusEl.textContent = 'Loading connections…';
  etaEl.textContent = '';

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('No active tab');

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });

    // Poll progress every 600ms while the load loop runs
    pollTimer = setInterval(async () => {
      try {
        const res = await chrome.tabs.sendMessage(tab.id!, { type: 'PROGRESS' });
        if (res) updateProgress(res);
      } catch { /* ignore — tab may not be ready yet */ }
    }, 600);

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXPORT' });

    clearInterval(pollTimer);
    progressEl.style.display = 'none';
    etaEl.textContent = '';
    statusEl.textContent = `Exported ${response.count} connection(s).`;

  } catch (e) {
    if (pollTimer) clearInterval(pollTimer);
    progressEl.style.display = 'none';
    etaEl.textContent = '';
    const msg = (e as Error).message ?? String(e);
    statusEl.textContent = msg.includes('Cannot access') || msg.includes('activeTab')
      ? 'Error: navigate to your LinkedIn connections page first.'
      : `Error: ${msg}`;
  } finally {
    exportBtn.disabled = false;
  }
});
