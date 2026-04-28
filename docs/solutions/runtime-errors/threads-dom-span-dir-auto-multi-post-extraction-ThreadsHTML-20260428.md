---
module: ThreadsHTML
date: 2026-04-28
problem_type: runtime_error
component: tooling
symptoms:
  - "Only 1st post extracted from multi-post thread (7+ post thread returns 1)"
  - "extractPosts returns 0 posts — 'No post content found' error"
  - "div[dir=auto] selector returns 0 elements on current Threads DOM"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [threads-dom, dir-auto, content-extraction, chrome-extension, grouping]
---

# Troubleshooting: Multi-Post Thread Extraction Returns Only 1 Post

## Problem

Threads.com changed its DOM from `div[dir="auto"]` to `span[dir="auto"]` for post text elements. The grouping strategy used `div[dir=auto]` selectors and a positive author-link filter, which selected only the username header containers instead of post text containers.

## Environment

- Module: ThreadsHTML Chrome Extension
- Affected Component: `content.js` — `extractPosts()` function
- Date: 2026-04-28

## Symptoms

- Extracting a 7-post thread returns only 1 post
- `div[dir=auto]` selector returns 0 elements (Threads now uses `span`)
- Positive author-link filter selects username groups, not text groups

## What Didn't Work

**Attempted Solution 1:** Class-based selectors `div.x1n2onr6, div.x1iorvi4`
- **Why it failed:** Threads atomized CSS classes are unstable and had changed; selectors matched 0 elements.

**Attempted Solution 2:** Depth-4 grouping with positive author-link filter
- **Why it failed:** At every depth (2–4), username sections and text sections are in **completely separate DOM branches** — they never share a common ancestor within 4 levels. Positive filter kept only username groups.

**Attempted Solution 3:** `<time>` element anchoring
- **Why it failed:** Current Threads has no `<time>` elements in the post DOM.

## Solution

Two changes in `content.js`:

**1. Use universal `[dir="auto"]` selector (any element tag):**
```javascript
// Before:
document.querySelectorAll('div[dir="auto"]')

// After:
document.querySelectorAll('[dir="auto"]')
```

**2. Depth-2 grouping + inverted author-link filter:**
```javascript
// Group at depth 2: span[dir=auto] → div.xat24cr → div.x1a6qonq (text block)
for (const el of dirAutos) {
  const anc = ancestor(el, 2);
  groups.get(anc) ?? groups.set(anc, []);
  groups.get(anc).push(el);
}

// Inverted filter: EXCLUDE groups that contain the author link (= username headers)
// Text content groups do NOT have the author link directly
if (handle !== 'unknown') {
  candidates = candidates.filter(({ container }) =>
    !container.querySelector(`a[href*="/@${handle}"]`)
  );
}
```

## Why This Works

Threads DOM structure for a post:
```
[post card]
  ├── [username section]  ← contains a[href="/@handle"] directly
  │   └── span[dir=auto]  ← username text
  └── [text section]      ← does NOT contain a[href="/@handle"]
      └── div.xat24cr
          └── span[dir=auto]  ← post text (depth-2 ancestor = div.x1a6qonq)
```

Username sections and text sections are siblings in separate DOM branches — they never share a depth-2 ancestor. The avatar/username header directly contains the author `<a>` link; text content blocks do not. Inverting the filter drops username groups and keeps only text groups.

## Prevention

- Never rely on specific HTML tag types (`div`, `span`) for Threads selectors — use attribute selectors `[dir="auto"]`.
- Never rely on Threads atomized CSS classes (e.g. `x1n2onr6`) — they change without notice.
- When filtering post containers, use the **inverted** author-link filter: exclude groups WITH the author link, keep groups WITHOUT.

## Related Issues

No related issues documented yet.
