---
module: ThreadsHTML
date: 2026-04-28
problem_type: logic_error
component: tooling
symptoms:
  - "Images button shows 'No images found' on photo threads"
  - "extractImages returns empty array even when post has visible images"
  - "proxyFetchImage action has no handler — image load errors silently replace <img> with fallback divs"
root_cause: scope_issue
resolution_type: code_fix
severity: medium
tags: [chrome-extension, image-extraction, content-script, cdn-images, proxy]
---

# Troubleshooting: "No Images Found" on Photo Threads

## Problem

Three separate bugs prevented image extraction from working on Threads photo posts:
1. `extractImages()` searched the text container (depth-2 ancestor) — images live in a **sibling** media section, not inside the text block.
2. `img.src` was used instead of `img.currentSrc`, missing responsive/lazy-loaded images.
3. `proxyFetchImage` was sent by `preview.js` but had no handler in `background.js`, so all CDN-blocked images were silently replaced with fallback divs, removing them from the DOM before `downloadImages()` ran.

## Environment

- Module: ThreadsHTML Chrome Extension
- Affected Component: `content.js` — `extractImages()`, `extractThreadData()`; `background.js` — message handler; `pages/preview.js` — `downloadImages()`
- Date: 2026-04-28

## Symptoms

- Clicking "Images" button in preview shows toast "No images found"
- `state.renderData.imageUrls` is empty even for image-heavy threads
- In preview, images display as "Image unavailable" fallback divs

## What Didn't Work

**Attempted Solution 1:** Use `anc` (depth-2 text container) for `extractImages()`
- **Why it failed:** The text section (`div.x1a6qonq`) is a sibling of the media section, not its parent. `querySelectorAll('img')` inside the text section finds nothing.

## Solution

**1. Search parent of text container for images** (`content.js`):
```javascript
// Before:
images: extractImages(anc),

// After — go one level up to reach the common parent of text + media sections:
images: extractImages(anc.parentElement || anc),
```

**2. Use `currentSrc` for responsive images** (`content.js`):
```javascript
// Before:
.map(img => img.src || '')

// After:
.map(img => img.currentSrc || img.src || '')
```

**3. Add `proxyFetchImage` handler** (`background.js`):
```javascript
if (request.action === 'proxyFetchImage') {
  const { url } = request;
  fetch(url, { credentials: 'omit' })
    .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
    .then(buf => reply({ ok: true, buffer: Array.from(new Uint8Array(buf)), type: 'image/jpeg' }))
    .catch(() => reply({ ok: false }));
  return true;
}
```

**4. Store original URLs in `renderData`; use them in `downloadImages()`** — DOM state may differ from original extraction:
```javascript
// background.js — add to renderData:
imageUrls: posts.flatMap(p => p.images || []),

// preview.js — prefer original URLs over DOM query:
const urls = state.renderData?.imageUrls?.length
  ? state.renderData.imageUrls
  : collectImageUrls(document.getElementById('article'));
```

**5. Page-level fallback sweep** (`content.js`):
```javascript
const capturedUrls = new Set(posts.flatMap(p => p.images));
const pageImages = extractImages(document.body).filter(u =>
  !capturedUrls.has(u) && u !== author.avatarUrl
);
if (pageImages.length > 0) {
  posts[posts.length - 1].images = [...posts[posts.length - 1].images, ...pageImages];
}
```

## Why This Works

Threads post DOM structure separates text and media into sibling sections:
```
[post parent]
  ├── [text section: div.x1a6qonq]   ← depth-2 from span[dir=auto]
  └── [media section]                 ← sibling, contains <img> post images
```

`extractImages(anc)` only saw the text section. Using `anc.parentElement` reaches the common parent containing both. The page-level sweep catches any images in posts without text (photo-only posts).

## Prevention

- Always extract images from a container one level above the text block.
- Always implement ALL actions referenced with `chrome.runtime.sendMessage` — missing handlers fail silently (no console error in content script context).
- Store original data URLs in state rather than re-querying the DOM, which may have been mutated by error handlers.

## Related Issues

- See also: [threads-dom-span-dir-auto-multi-post-extraction-ThreadsHTML-20260428.md](../runtime-errors/threads-dom-span-dir-auto-multi-post-extraction-ThreadsHTML-20260428.md)
