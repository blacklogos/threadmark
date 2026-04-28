document.addEventListener('DOMContentLoaded', () => {
  const btnCopy     = document.getElementById('btnCopy');
  const btnPreview  = document.getElementById('btnPreview');
  const btnDownload = document.getElementById('btnDownload');
  const statusEl    = document.getElementById('status');
  const dotEl       = document.getElementById('statusDot');

  function setStatus(msg, state = '') {
    statusEl.textContent = msg;
    statusEl.className   = state;
    dotEl.className      = 'dot' + (state ? ' ' + state : '');
  }

  function setLoading(on) {
    [btnCopy, btnPreview, btnDownload].forEach(b => b.disabled = on);
    if (on) setStatus('Extracting…', 'working');
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    if (!tab.url?.includes('threads.')) throw new Error('Navigate to a Threads post first');
    return tab;
  }

  async function ensureContentScript(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    } catch (_) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await new Promise(r => setTimeout(r, 300));
    }
  }

  async function extractData() {
    const tab = await getActiveTab();
    await ensureContentScript(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });
    if (!res?.success) throw new Error(res?.error || 'Extraction failed');
    return res.data;
  }

  btnCopy.addEventListener('click', async () => {
    setLoading(true);
    try {
      const data = await extractData();
      setStatus('Generating…', 'working');
      const res = await chrome.runtime.sendMessage({ action: 'toMarkdown', data });
      if (!res?.success) throw new Error(res?.error || 'Conversion failed');
      await navigator.clipboard.writeText(res.markdown);
      setStatus('Copied to clipboard!', 'ok');
    } catch (e) {
      setStatus(e.message, 'err');
    } finally {
      setLoading(false);
    }
  });

  btnPreview.addEventListener('click', async () => {
    setLoading(true);
    try {
      const data = await extractData();
      setStatus('Opening preview…', 'working');
      const res = await chrome.runtime.sendMessage({ action: 'preview', data });
      if (!res?.success) throw new Error(res?.error || 'Preview failed');
      setStatus('Preview opened', 'ok');
    } catch (e) {
      setStatus(e.message, 'err');
    } finally {
      setLoading(false);
    }
  });

  btnDownload.addEventListener('click', async () => {
    setLoading(true);
    try {
      const data = await extractData();
      setStatus('Downloading…', 'working');
      const res = await chrome.runtime.sendMessage({ action: 'download', data });
      if (!res?.success) throw new Error(res?.error || 'Download failed');
      setStatus('Download started!', 'ok');
    } catch (e) {
      setStatus(e.message, 'err');
    } finally {
      setLoading(false);
    }
  });
});
