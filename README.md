# Universal Summarizer — Chrome Extension

One-click structured summaries of any webpage. 300-400 words, 4-5 sections, every time.

## Setup in Codespaces

1. Clone/copy this folder to your Codespaces repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select this folder
5. Click the extension icon on any webpage
6. Enter your Anthropic API key on first run
7. Done — it summarizes automatically

## Testing Checklist (Sprint 1)

Test on these 5 page types:
- [ ] News article (e.g. nytimes.com, reuters.com)
- [ ] Product page (e.g. any SaaS landing page)
- [ ] Blog post (e.g. any Medium or Substack post)
- [ ] Documentation (e.g. docs.anthropic.com)
- [ ] Wikipedia article

## Project Structure

```
summarizer-extension/
├── manifest.json       # Manifest V3 config
├── background.js       # Service worker — extraction + API calls
├── popup.html          # Summary UI
├── popup.js            # Popup controller
├── icons/              # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

## Architecture

Click icon → popup opens → sends message to background worker →
worker injects script into active tab (extracts text) →
calls Claude Haiku API → returns structured summary → popup renders it
