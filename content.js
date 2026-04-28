let isInitialized = false;
initialize();

function initialize() { isInitialized = true; }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ initialized: isInitialized });
    return true;
  }
  if (request.action === 'extract') {
    extractThreadData()
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

function hashText(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractAuthor() {
  let name = 'Unknown', username = 'unknown', avatarUrl = '';

  const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
  const m1 = ogTitle.match(/^(.*?)\s*\(@?([a-zA-Z0-9._]+)\)/);
  if (m1) { name = m1[1].trim(); username = m1[2]; }
  else {
    const m2 = ogTitle.match(/@([a-zA-Z0-9._]+)/);
    if (m2) { username = m2[1]; name = username; }
  }

  if (username === 'unknown') {
    const m3 = window.location.href.match(/threads\.[a-z]+\/@([^/?#]+)/);
    if (m3) username = m3[1];
  }

  // The avatar <img> always has an alt containing the username regardless of UI language
  // e.g. "Ảnh đại diện của handle" (VI), "handle's profile picture" (EN), etc.
  const handle = username.replace(/^@/, '');
  if (handle !== 'unknown') {
    for (const img of document.querySelectorAll(`img[alt*="${handle}"]`)) {
      const src = img.currentSrc || img.src || '';
      if (/^https?:\/\//i.test(src) &&
          (src.includes('scontent') || src.includes('fbcdn') || src.includes('cdninstagram'))) {
        avatarUrl = src;
        break;
      }
    }
  }

  // Fall back to og:image if DOM search found nothing
  if (!avatarUrl) {
    avatarUrl = document.querySelector('meta[property="og:image"]')?.content || '';
  }

  return { name, username: '@' + username.replace(/^@/, ''), avatarUrl };
}

function extractDate() {
  for (const el of document.querySelectorAll('time')) {
    if (el.dateTime) {
      try {
        const d = new Date(el.dateTime);
        if (!isNaN(d)) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch (_) {}
    }
  }
  return '';
}

function extractImages(container) {
  return [...new Set(
    Array.from(container.querySelectorAll('img'))
      .map(img => img.currentSrc || img.src || '')
      .filter(src => /^https?:\/\//i.test(src) &&
        (src.includes('scontent') || src.includes('fbcdn') || src.includes('cdninstagram')))
  )];
}

function tryAddText(text, seen, posts, images) {
  const t = (text || '').trim();
  if (t.length < 15) return false;
  const key = hashText(t.slice(0, 200).toLowerCase().replace(/\s+/g, ' '));
  if (seen.has(key)) return false;
  seen.add(key);
  posts.push({ text: t, images: images || [] });
  return true;
}

// Walk up `n` levels from `el`, stopping at document.body.
function ancestor(el, n) {
  let cur = el;
  for (let i = 0; i < n; i++) {
    if (!cur.parentElement || cur.parentElement === document.body) break;
    cur = cur.parentElement;
  }
  return cur;
}

function extractPosts(username) {
  const handle = username.replace(/^@/, '');
  const seen = new Set();
  const posts = [];

  // Threads changed from div[dir="auto"] to span[dir="auto"] — use [dir="auto"] to cover both.
  // Structure on current Threads: span[dir=auto] < div.xat24cr < div.x1a6qonq (per-post text block)
  // Group [dir="auto"] elements by their depth-2 ancestor to combine multi-paragraph posts.
  const dirAutos = Array.from(document.querySelectorAll('[dir="auto"]'))
    .filter(el => (el.innerText?.trim().length || 0) >= 15);

  if (dirAutos.length > 0) {
    // Group by depth-2 ancestor: span[dir=auto] < div.xat24cr < div.x1a6qonq
    // Each post's text block lands in its own div.x1a6qonq; depth 2 from the span reaches it.
    // Username spans are in a completely separate DOM branch — we exclude them via inverted filter.
    const groups = new Map();
    for (const el of dirAutos) {
      const anc = ancestor(el, 2);
      if (!groups.has(anc)) groups.set(anc, []);
      groups.get(anc).push(el);
    }

    // Build candidate list with combined text per group.
    // Images live in a sibling section of the text block, so search from the parent (one level up).
    let candidates = Array.from(groups.entries()).map(([anc, els]) => ({
      container: anc,
      text: els.map(e => e.innerText?.trim()).filter(Boolean).join('\n'),
      images: extractImages(anc.parentElement || anc),
    }));

    // Inverted author filter: username containers directly hold the author link.
    // Text containers (actual post content) do NOT — so we EXCLUDE the ones that do.
    if (handle !== 'unknown') {
      candidates = candidates.filter(({ container }) =>
        !container.querySelector(`a[href*="/@${handle}"]`)
      );
    }

    for (const { text, images } of candidates) {
      tryAddText(text, seen, posts, images);
    }
  }

  // Fallback: class-based containers (older Threads, or if grouping gave 0)
  if (posts.length === 0) {
    let containers = Array.from(document.querySelectorAll(
      'article, div[role="article"], div.x1n2onr6, div.x1iorvi4'
    )).filter(el => el.innerText?.trim().length > 100);

    if (containers.length > 0) {
      if (handle !== 'unknown') {
        const w = containers.filter(c => c.querySelector(`a[href*="/@${handle}"]`));
        if (w.length) containers = w;
      }
      // Leaf-filter
      containers = containers.filter(c => !containers.some(o => o !== c && c.contains(o)));
      for (const c of containers) {
        const el = c.querySelector('[dir="auto"]');
        if (el) tryAddText(el.innerText?.trim() || '', seen, posts, extractImages(c));
      }
    }
  }

  // Last resort: og:description
  if (posts.length === 0) {
    const desc = document.querySelector('meta[property="og:description"]')?.content?.trim();
    if (desc?.length > 10) posts.push({ text: desc, images: [] });
  }

  return posts;
}

async function extractThreadData() {
  await wait(1000);

  const author = extractAuthor();
  const date = extractDate();
  const url = window.location.href;

  let posts = [];
  const retries = [0, 800, 1500, 2500];

  for (let i = 0; i < retries.length; i++) {
    if (retries[i] > 0) {
      window.scrollBy({ top: 400, behavior: 'smooth' });
      await wait(retries[i]);
    }
    posts = extractPosts(author.username);
    if (posts.length > 0) break;
  }

  if (posts.length === 0) {
    throw new Error('No post content found — scroll the page fully and try again.');
  }

  // Supplement: scan entire page for CDN images not already captured per-post.
  // Needed when images are in a media section that doesn't share an ancestor with text.
  const capturedUrls = new Set(posts.flatMap(p => p.images));
  const pageImages = extractImages(document.body).filter(u =>
    !capturedUrls.has(u) && u !== author.avatarUrl
  );
  if (pageImages.length > 0) {
    posts[posts.length - 1].images = [...posts[posts.length - 1].images, ...pageImages];
  }

  return { author, date, url, posts };
}
