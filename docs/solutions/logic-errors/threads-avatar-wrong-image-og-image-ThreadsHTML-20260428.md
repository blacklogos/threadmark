---
module: ThreadsHTML
date: 2026-04-28
problem_type: logic_error
component: tooling
symptoms:
  - "Preview avatar shows post image instead of profile picture"
  - "Avatar shows wrong person's photo or a content image"
root_cause: wrong_api
resolution_type: code_fix
severity: low
tags: [chrome-extension, avatar, og-image, alt-attribute, profile-picture]
---

# Troubleshooting: Preview Shows Wrong Avatar (Post Image Instead of Profile Picture)

## Problem

`extractAuthor()` used `meta[property="og:image"]` for the avatar URL. On Threads, `og:image` is the **post's featured/social-share image**, not the author's profile picture. This caused the preview to show a post photo as the avatar.

## Environment

- Module: ThreadsHTML Chrome Extension
- Affected Component: `content.js` — `extractAuthor()`
- Date: 2026-04-28

## Symptoms

- Avatar in preview shows the first post image instead of the author's profile picture
- For photo-only threads, the avatar and the post content show the same image

## What Didn't Work

**Attempted Solution 1:** Find `<img>` inside/near `a[href*="/@handle"]`
- **Why it failed:** `authorLink.querySelector('img')` and `parentElement?.querySelector('img')` returned a post image because images in the post content also sit nearby the author link in the DOM.

**Attempted Solution 2:** DOM position check (`compareDocumentPosition`)
- **Why it failed:** Implementation complexity without reliable results — post images still matched in some layouts.

## Solution

Threads always sets the `alt` attribute of the profile picture `<img>` to a string **containing the username**, regardless of UI language:
- Vietnamese: `"Ảnh đại diện của imswabhab"`
- English: `"imswabhab's profile picture"`

Use `img[alt*="handle"]` to find it precisely:

```javascript
// content.js — extractAuthor()

// Before:
const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
if (ogImage) avatarUrl = ogImage;

// After:
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
```

## Why This Works

`og:image` on Threads is set to the thread's shareable preview image (first post image), not the author's avatar. The actual profile picture `<img>` in the DOM always includes the username in its `alt` text regardless of the user's locale — this is Threads' consistent accessibility pattern. Filtering by CDN domain additionally ensures we don't match unrelated images with the username in their alt.

## Prevention

- Never assume `og:image` == profile picture on social platforms. It is usually the content's share thumbnail.
- On Threads/Instagram, prefer `img[alt*="username"]` over DOM tree traversal for finding the avatar — it works across layouts and locales.

## Related Issues

No related issues documented yet.
