// UI noise patterns — applied line-by-line during cleaning
const UI_NOISE = [
  /^@?[a-z0-9._-]{2,30}$/i,                                                  // standalone handle
  /^\d{1,5}$/,                                                                // standalone number (metrics)
  /^\d[\d.,]*[KkMm]?\s+(lượt\s*)?(xem|thích|bình luận|chia sẻ|trả lời)/i,  // Vietnamese metrics
  /^\d[\d.,]*[KkMm]?\s+(views?|likes?|comments?|reposts?|replies?)/i,        // English metrics
  /^\d+\s*(phút|giờ|ngày|tuần|tháng|năm|minute|hour|day|week|month|year)s?(\s*(trước|ago))?$/i,
  /^(khoảng|about)\s+\d/i,
  /^(translate|dịch|ẩn dịch|hide translation)$/i,
  /^(reply thread|thread trả lời)$/i,
  /^(view activity|xem hoạt động)$/i,
  /^(followers?|following)$/i,
  /^(suggested for you|đề xuất cho bạn)$/i,
  /^(add a comment|thêm bình luận)\.\.\./i,
  /^(hide thread|ẩn thread)$/i,
  /^(hàng đầu|nổi bật|top|most relevant|popular|trending)$/i,
  /^(edited|đã chỉnh sửa|verified|official|chính thức)$/i,
  /^(điều khoản|chính sách|privacy policy|terms of service|cookie)/i,  // legal footer
  /^(threads helps|instagram|meta|©\s*\d)/i,                            // platform footer
];

function cleanLines(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !UI_NOISE.some(r => r.test(l)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAvatarData(name) {
  let hue = 210;
  if (name) for (let i = 0; i < name.length; i++) hue = (hue + name.charCodeAt(i)) % 360;
  const color = `hsl(${hue},65%,55%)`;
  const clean = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const parts = clean.split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (clean.slice(0, 2) || 'U').toUpperCase();
  return { color, initials };
}

function toMarkdown(data) {
  const { author, date, url, posts } = data;
  const header = `# ${author.name} (${author.username})\n\n` +
    (date ? `*${date}*\n\n` : '') +
    `Source: ${url}\n\n---\n\n`;
  const body = posts
    .map(p => {
      let t = cleanLines(p.text);
      if (p.images?.length) t += '\n\n' + p.images.map(u => `![image](${u})`).join('\n');
      return t;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
  return header + body + '\n';
}

function buildHtmlFile({ authorName, authorUsername, avatarUrl, avatarColor, authorInitials,
    originalDate, originalUrl, totalWords, readTimeMinutes, threadContentHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(authorName)}'s Thread</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:30px 20px;line-height:1.65;color:#222}
a{color:#0095f6;text-decoration:none}a:hover{text-decoration:underline}
.author-header{display:flex;align-items:center;padding-bottom:20px;margin-bottom:32px;border-bottom:1px solid #eee}
.avatar{width:56px;height:56px;border-radius:50%;overflow:hidden;background:${avatarColor};flex-shrink:0;margin-right:16px;position:relative}
.avatar img{width:100%;height:100%;object-fit:cover;position:relative;z-index:2}
.avatar-initials{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px;z-index:1}
.author-name{font-size:1.2rem;font-weight:700}.author-handle{color:#666;font-size:.9rem}.thread-meta{color:#888;font-size:.82rem;margin-top:3px}
p{margin:8px 0}.post-image{max-width:100%;border-radius:8px;margin:12px 0;display:block}
.post-sep{border:none;border-top:1px solid #eee;margin:24px 0}
footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;font-size:.82rem;color:#888;text-align:center}
@media(max-width:600px){body{padding:20px 15px}}
@media print{footer{display:none}}
</style>
</head>
<body>
<div class="author-header">
  <div class="avatar">
    ${avatarUrl ? `<img src="${escHtml(avatarUrl)}" alt="" onerror="this.style.display='none'">` : ''}
    <div class="avatar-initials">${escHtml(authorInitials)}</div>
  </div>
  <div>
    <div class="author-name">${escHtml(authorName)}</div>
    <div class="author-handle">${escHtml(authorUsername)}</div>
    <div class="thread-meta">${totalWords} words · ${readTimeMinutes} min read${originalDate ? ' · ' + escHtml(originalDate) : ''}</div>
  </div>
</div>
<div class="article">${threadContentHtml}</div>
<footer>
  Thread by ${escHtml(authorName)} (${escHtml(authorUsername)})${originalDate ? ' · ' + escHtml(originalDate) : ''}<br>
  Source: <a href="${escHtml(originalUrl)}" target="_blank" rel="noopener noreferrer">${escHtml(originalUrl)}</a>
</footer>
</body>
</html>`;
}

function toHtml(data) {
  const { author, date, url, posts } = data;
  const { color, initials } = getAvatarData(author.name);

  const articleHtml = posts.map(p => {
    const cleaned = cleanLines(p.text);
    let html = cleaned
      .split('\n')
      .map(l => l ? `<p>${escHtml(l)}</p>` : '')
      .filter(Boolean)
      .join('');
    if (p.images?.length) {
      html += p.images.map(u =>
        `<img src="${escHtml(u)}" class="post-image" loading="lazy" referrerpolicy="no-referrer" alt="">`
      ).join('');
    }
    return html;
  }).join('<hr class="post-sep">');

  const totalWords = posts.map(p => cleanLines(p.text)).join(' ').split(/\s+/).filter(Boolean).length;
  const readTimeMinutes = Math.max(1, Math.round(totalWords / 200));
  const timestamp = Date.now();

  const renderData = {
    authorName: author.name,
    authorUsername: author.username,
    avatarUrl: author.avatarUrl || '',
    avatarColor: color,
    authorInitials: initials,
    originalDate: date,
    originalUrl: url,
    totalWords,
    readTimeMinutes,
    threadContentHtml: articleHtml,
    imageUrls: posts.flatMap(p => p.images || []),
  };

  const htmlContent = buildHtmlFile(renderData);
  const filename = `thread_${author.username.replace(/^@/, '')}_${timestamp}.html`;

  return { renderData, htmlContent, filename };
}

function createDownloadUrl(content) {
  if (content.length < 1_000_000) {
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(content);
  }
  // Blob URL for large content to avoid URI length limits
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  blobUrls.push(url);
  return url;
}

let blobUrls = [];
let previewTabs = {};
let lastPreviewData = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let done = false;
  const timer = setTimeout(() => {
    if (!done) { done = true; try { sendResponse({ success: false, error: 'Timed out' }); } catch (_) {} }
  }, 30000);

  const reply = r => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    try { sendResponse(r); } catch (_) {}
  };

  if (request.action === 'preview') {
    (async () => {
      try {
        if (!request.data) throw new Error('No data provided');
        const { renderData, htmlContent, filename } = toHtml(request.data);
        const pageUrl = chrome.runtime.getURL('pages/preview.html');
        chrome.tabs.create({ url: pageUrl, active: true }, tab => {
          if (chrome.runtime.lastError) { reply({ success: false, error: chrome.runtime.lastError.message }); return; }
          previewTabs[tab.id] = { htmlContent, filename, renderData };
          lastPreviewData = renderData;
          reply({ success: true, previewTabId: tab.id });
          // Broadcast init — preview.js listens for this
          try { chrome.runtime.sendMessage({ type: 'preview:init', payload: renderData }); } catch (_) {}
        });
      } catch (e) { reply({ success: false, error: e.message }); }
    })();
    return true;
  }

  if (request.action === 'download') {
    (async () => {
      try {
        let htmlContent, filename;
        // Re-use cached HTML if downloading from an open preview tab
        if (request.previewTabId && previewTabs[request.previewTabId]) {
          ({ htmlContent, filename } = previewTabs[request.previewTabId]);
        } else if (request.data) {
          ({ htmlContent, filename } = toHtml(request.data));
        } else {
          throw new Error('No data provided');
        }
        const dlUrl = createDownloadUrl(htmlContent);
        chrome.downloads.download({ url: dlUrl, filename, saveAs: true }, id => {
          if (chrome.runtime.lastError) { reply({ success: false, error: chrome.runtime.lastError.message }); return; }
          reply({ success: true, downloadId: id, filename });
        });
      } catch (e) { reply({ success: false, error: e.message }); }
    })();
    return true;
  }

  if (request.action === 'toMarkdown') {
    try {
      if (!request.data) throw new Error('No data provided');
      reply({ success: true, markdown: toMarkdown(request.data) });
    } catch (e) { reply({ success: false, error: e.message }); }
    return false;
  }

  if (request.action === 'proxyFetchImage') {
    const { url } = request;
    if (!url || !/^https?:\/\//i.test(url)) { reply({ ok: false }); return false; }
    fetch(url, { credentials: 'omit' })
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(buf => reply({ ok: true, buffer: Array.from(new Uint8Array(buf)), type: 'image/jpeg' }))
      .catch(() => reply({ ok: false }));
    return true;
  }

  if (request.action === 'downloadImageUrl') {
    const { url, filename } = request;
    if (!url || !/^https?:\/\//i.test(url)) { reply({ success: false, error: 'Invalid URL' }); return false; }
    chrome.downloads.download({ url, filename, saveAs: false }, id => {
      if (chrome.runtime.lastError) { reply({ success: false, error: chrome.runtime.lastError.message }); return; }
      reply({ success: true, downloadId: id });
    });
    return true;
  }

  if (request.action === 'previewReady') {
    if (lastPreviewData) {
      try { chrome.runtime.sendMessage({ type: 'preview:init', payload: lastPreviewData }); } catch (_) {}
      reply({ success: true });
    } else {
      reply({ success: false, error: 'No preview data available' });
    }
    return false;
  }

  reply({ success: false, error: `Unknown action: ${request.action}` });
  return false;
});

chrome.tabs.onRemoved.addListener(tabId => {
  delete previewTabs[tabId];
  if (blobUrls.length > 0) {
    blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} });
    blobUrls = [];
  }
});
