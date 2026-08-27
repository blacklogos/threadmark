# Threadmark — Chrome Extension

**Turn threads into tools.** Threadmark is a Chrome extension that extracts Threads.com posts into clean Markdown, HTML, or plain text — AI-ready in one click.

<div>
  <a href="https://www.loom.com/share/d3fc421dc69f46a5b9f838f76805e326">
    <p>Intro and how to use Threadmark — Watch Video</p>
  </a>
  <a href="https://www.loom.com/share/d3fc421dc69f46a5b9f838f76805e326">
    <img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/d3fc421dc69f46a5b9f838f76805e326-ae8bea8ce919a00c-full-play.gif#t=0.1">
  </a>
</div>

## Highlights

### Preview & Editing
- Opens a dedicated preview tab (MV3-safe) with full thread context, author card, word count, and reading-time estimate.
- Toggle edit mode to prune content in-place before exporting.

### Clean Exports
- Copy as Markdown for AI tools (Claude, ChatGPT, Gemini) in one click.
- Download rich HTML, Markdown, or plain text with source attribution and consistent filenames.
- Print-ready PDF via the browser print dialog.

### Image Handling
- Inline images render in the preview with CDN proxy fallback for blocked assets.
- Bulk image download with deterministic filenames.

### Productivity
- Keyboard shortcuts for copy, export, and edit toggles.
- Background service worker retains recent preview state — re-download without re-scraping.
- Cleans timestamps, metrics, and UI chrome using built-in noise patterns.

## Installation

1. Clone this repository or download the source ZIP.
2. Navigate to `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Choose **Load unpacked** and select the project directory.

## Usage

1. Browse to any Threads post on `threads.com` or `threads.net`.
2. Click the Threadmark icon and choose an action:
   - **Copy for AI** — Markdown to clipboard, ready to paste into any AI tool.
   - **Preview** — opens the formatted preview tab with all export options.
   - **Download HTML** — saves a self-contained HTML file immediately.
3. Inside the preview tab:
   - Copy text, Markdown, or save as PDF/TXT/MD.
   - Toggle edit mode to remove unwanted sections.
   - Download all post images in bulk.

## Keyboard Shortcuts (in Preview)

| Key | Action |
|-----|--------|
| `c` | Copy plain text |
| `m` | Copy Markdown |
| `Shift+M` | Save Markdown file |
| `p` | Print / Save PDF |
| `e` | Toggle edit mode |

## Permissions

| Permission | Reason |
|-----------|--------|
| `activeTab` | Injects content script only when you trigger an action |
| `downloads` | Saves HTML, Markdown, TXT, and images |
| `scripting` | MV3-required for on-demand script injection |
| `threads.com`, `threads.net` | Reads thread content from the active page |
| `fbcdn.net`, `cdninstagram.com` | Proxy-fetches CDN-blocked images for preview display |

All processing is local — no data is sent to any remote service.

## Project Layout

```
manifest.json       MV3 definition, permissions, action routing
popup.html/js       Extension popup — entry point for all actions
content.js          Extracts thread content and media from the active tab
background.js       Cleans, converts, downloads, manages preview state
pages/preview.*     Full-tab preview UI with export controls and image tools
```

## FAQ

**How do I use Threads posts with AI?**  
Install Threadmark, open any thread, click **Copy for AI** — clean Markdown is on your clipboard.

**Does Threadmark work with multi-post threads?**  
Yes — it extracts all posts in a thread, cleanly separated with author metadata.

**Can Threadmark download images?**  
Yes — open Preview and click **Images** to bulk-download all post media.

**What if extraction fails?**  
Refresh the Threads page and try again. If the issue persists, Threads may have updated their DOM — open an issue with the thread URL.

## Support

Threadmark is free and open source. If it earns a place in your workflow, you can [help keep it that way](https://cc4.marketing/?utm_source=threadmark&utm_medium=readme&utm_campaign=footer-donate#donate).
