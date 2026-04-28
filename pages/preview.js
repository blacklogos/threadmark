(function () {
  'use strict';

  const state = { renderData: null, blobUrls: [] };

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2100);
  }

  // Convert article innerHTML to plain text
  function htmlToPlain(article) {
    let h = article.innerHTML || '';
    h = h.replace(/<br\s*\/?>/gi, '\n');
    h = h.replace(/<\/(?:p|div|li|h[1-6])>/gi, '$&\n');
    const d = document.createElement('div');
    d.innerHTML = h;
    return (d.textContent || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Collect absolute image URLs from article
  function collectImageUrls(article) {
    const urls = new Set();
    article.querySelectorAll('img').forEach(img => {
      const u = img.currentSrc || img.src || '';
      if (/^https?:\/\//i.test(u)) urls.add(u);
    });
    return Array.from(urls);
  }

  function buildMarkdown() {
    const article = document.getElementById('article');
    const author  = document.getElementById('authorName')?.textContent || 'Unknown';
    const handle  = document.getElementById('authorUsername')?.textContent || '';
    const info    = document.getElementById('threadInfo')?.textContent || '';
    const source  = state.renderData?.originalUrl || '';
    const text    = htmlToPlain(article);
    return `# ${author} ${handle}\n> ${info}${source ? '\n> Source: ' + source : ''}\n\n${text}${source ? '\n\nSource: ' + source : ''}\n`;
  }

  function copyText() {
    const article = document.getElementById('article');
    if (!article) return;
    const text = htmlToPlain(article);
    const btn = document.getElementById('btnCopy');
    const onOk = () => { if (btn) { const t = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = t, 1800); } };
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        if (document.execCommand('copy')) { document.body.removeChild(ta); onOk(); return; }
        document.body.removeChild(ta);
      } catch (_) {}
      alert('Copy failed — select all and copy manually.');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(onOk).catch(fallback);
    else fallback();
  }

  function copyMarkdown() {
    const md = buildMarkdown();
    const onOk = () => showToast('Markdown copied');
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = md; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        if (document.execCommand('copy')) { document.body.removeChild(ta); onOk(); return; }
        document.body.removeChild(ta);
      } catch (_) {}
      alert('Copy failed.');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(md).then(onOk).catch(fallback);
    else fallback();
  }

  function saveBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    state.blobUrls.push(url);
    try {
      chrome.downloads.download({ url, filename, saveAs: true });
    } catch (_) {
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
    }
  }

  function saveMarkdown() { saveBlob(buildMarkdown(), 'text/markdown;charset=utf-8', 'thread.md'); }

  function saveTxt() {
    const article = document.getElementById('article');
    if (!article) return;
    const source = state.renderData?.originalUrl || '';
    const txt = htmlToPlain(article) + (source ? `\n\nSource: ${source}\n` : '\n');
    saveBlob(txt, 'text/plain;charset=utf-8', 'thread.txt');
  }

  function downloadImages() {
    // Prefer original URLs from render data — DOM imgs may have been replaced by fallback divs
    const urls = state.renderData?.imageUrls?.length
      ? state.renderData.imageUrls
      : collectImageUrls(document.getElementById('article'));
    if (!urls.length) { showToast('No images found'); return; }
    const author = (document.getElementById('authorUsername')?.textContent || 'unknown').replace(/^@/, '');
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    let idx = 0;
    showToast(`Downloading ${urls.length} image${urls.length > 1 ? 's' : ''}`);
    (function next() {
      if (idx >= urls.length) { showToast('Done'); return; }
      const u = urls[idx++];
      const ext = (u.split('?')[0].match(/\.(jpg|jpeg|png|gif|webp)$/i) || ['.jpg'])[0];
      const fname = `threads_${author}_${date}_${String(idx).padStart(2, '0')}${ext}`;
      try {
        chrome.runtime.sendMessage({ action: 'downloadImageUrl', url: u, filename: fname }, () => {});
      } catch (_) {
        const a = document.createElement('a');
        a.href = u; a.download = fname;
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(next, 250);
    })();
  }

  function toggleEdit() {
    const article = document.getElementById('article');
    if (!article) return;
    const on = article.getAttribute('contenteditable') === 'true';
    article.setAttribute('contenteditable', on ? 'false' : 'true');
    showToast(on ? 'Edit off' : 'Edit on — click to remove sections');
  }

  function setAvatar(url, initials, color) {
    const img  = document.getElementById('avatarImg');
    const init = document.getElementById('avatarInitials');
    const ctr  = document.getElementById('avatarContainer');
    ctr.style.backgroundColor = color || '#999';
    init.textContent = (initials || 'U').slice(0, 2).toUpperCase();
    if (url) {
      img.referrerPolicy = 'no-referrer';
      img.src = url;
      img.addEventListener('error', () => {
        // Try background proxy before falling back to initials
        try {
          chrome.runtime.sendMessage({ action: 'proxyFetchImage', url }, resp => {
            if (resp?.ok && resp.buffer) {
              const blob = new Blob([new Uint8Array(resp.buffer)], { type: resp.type || 'image/jpeg' });
              const blobUrl = URL.createObjectURL(blob);
              state.blobUrls.push(blobUrl);
              img.src = blobUrl;
            } else {
              img.style.display = 'none';
              init.style.display = 'flex';
            }
          });
        } catch (_) {
          img.style.display = 'none';
          init.style.display = 'flex';
        }
      }, { once: true });
    } else {
      img.style.display = 'none';
      init.style.display = 'flex';
    }
  }

  // Auto-retry failed images via background proxy
  function attachImgFallbacks(root) {
    root.querySelectorAll('img').forEach(img => {
      try { img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; } catch (_) {}

      const handleError = () => {
        const src = img.getAttribute('src') || '';
        if (!src) return;
        try {
          chrome.runtime.sendMessage({ action: 'proxyFetchImage', url: src }, resp => {
            if (resp?.ok && resp.buffer) {
              const blob = new Blob([new Uint8Array(resp.buffer)], { type: resp.type || 'image/jpeg' });
              const u = URL.createObjectURL(blob);
              state.blobUrls.push(u);
              img.src = u;
            } else {
              // Replace with fallback link
              const ph = document.createElement('div');
              ph.className = 'img-fallback';
              ph.innerHTML = `Image unavailable. <div class="img-actions"><a href="${src}" target="_blank" rel="noopener noreferrer">Open original</a></div>`;
              img.replaceWith(ph);
            }
          });
        } catch (_) {}
      };

      img.addEventListener('error', handleError, { once: true });
      if (img.complete && img.naturalWidth === 0) handleError();
    });
  }

  function render(data) {
    state.renderData = data;
    document.getElementById('authorName').textContent    = data.authorName || 'Unknown';
    document.getElementById('authorUsername').textContent = data.authorUsername || '';
    document.getElementById('threadInfo').textContent    =
      `${data.totalWords || 0} words · ${data.readTimeMinutes || 1} min read` +
      (data.originalDate ? ` · ${data.originalDate}` : '');
    setAvatar(data.avatarUrl || '', data.authorInitials || 'U', data.avatarColor || '#999');

    const article = document.getElementById('article');
    article.innerHTML = data.threadContentHtml || '';
    attachImgFallbacks(article);

    const sourceContainer = document.getElementById('sourceContainer');
    const sourceLink      = document.getElementById('sourceLink');
    if (data.originalUrl) {
      sourceLink.href        = data.originalUrl;
      sourceLink.textContent = data.originalUrl;
      sourceContainer.style.display = 'inline';
    }
  }

  function bindUI() {
    document.getElementById('btnCopy')   .addEventListener('click', copyText);
    document.getElementById('btnCopyMd') .addEventListener('click', copyMarkdown);
    document.getElementById('btnPdf')    .addEventListener('click', () => window.print());
    document.getElementById('btnMd')     .addEventListener('click', saveMarkdown);
    document.getElementById('btnTxt')    .addEventListener('click', saveTxt);
    document.getElementById('btnImages') .addEventListener('click', downloadImages);
    document.getElementById('btnEdit')   .addEventListener('click', toggleEdit);
  }

  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (document.activeElement?.getAttribute?.('contenteditable') === 'true') return;
      const map = { c: 'btnCopy', m: 'btnCopyMd', p: 'btnPdf', e: 'btnEdit' };
      // Shift+M for save markdown
      if (e.key === 'M' || (e.key === 'm' && e.shiftKey)) { e.preventDefault(); document.getElementById('btnMd')?.click(); return; }
      if (map[e.key]) { e.preventDefault(); document.getElementById(map[e.key])?.click(); }
    });
  }

  window.addEventListener('beforeunload', () => {
    state.blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} });
    state.blobUrls = [];
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindUI();
    bindKeyboard();
    try {
      chrome.runtime.onMessage.addListener(msg => {
        if (msg?.type === 'preview:init') render(msg.payload || {});
      });
      chrome.runtime.sendMessage({ action: 'previewReady' });
    } catch (_) {
      // Not in extension context (e.g., local file open)
    }
  });
})();
