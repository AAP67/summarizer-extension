# Chrome Web Store Submission Guide

## Store Listing Details

### Name
Universal Summarizer

### Short Description (132 chars max)
One-click AI summaries for any webpage. 5 structured sections, 300-400 words, adapted to content type. Powered by Claude.

### Detailed Description
Universal Summarizer gives you structured, consistent summaries of any webpage in one click.

HOW IT WORKS
Click the extension icon on any page. The AI reads the content, detects what type of page it is (news, product, research, blog, documentation), and generates a 5-section summary in 300-400 words — every time.

ADAPTIVE SECTION TEMPLATES
- News articles: What Happened, Key Facts, Analysis, Impact, Background
- Product pages: What It Is, Features, Pricing, Pros & Cons, Verdict  
- Research papers: Abstract, Methods, Findings, Implications, Limitations
- Blog posts: Thesis, Arguments, Evidence, Counterpoints, Conclusion
- Documentation: Overview, Core Concepts, Key APIs, Usage Notes, Gotchas

KEY FEATURES
- Side panel UI that stays open while you browse
- Click any section to copy it individually
- Export summaries as Markdown files
- Summary history with search (last 50 summaries)
- URL-based caching — revisit a page and get instant results
- Thin content detection for paywalled or minimal pages
- Color-coded content type badges

REQUIREMENTS
- An Anthropic API key (get one at console.anthropic.com)
- Cost: approximately $0.002 per summary using Claude Haiku

PRIVACY
- No data collection, no analytics, no tracking
- Your API key is stored locally in your browser
- Page content is sent only to the Anthropic API for summarization
- No backend server — everything runs in your browser

### Category
Productivity

### Language
English

## Required Assets

### Icon
- 128x128 PNG (already have: icons/icon-128.png)

### Screenshots (1280x800 or 640x400)
Take screenshots of:
1. Side panel showing a news article summary with blue "NEWS" badge
2. Side panel showing a product page summary with green "PRODUCT" badge
3. History tab with multiple past summaries
4. The "click to copy" interaction on a section

### Promotional Tile (440x280)
Create a simple graphic with:
- Purple gradient background (#7c5cfc to #5b3fd4)
- White text: "Universal Summarizer"
- Subtext: "AI summaries for any webpage"
- Lightning bolt icon

## Submission Steps

1. Go to https://chrome.google.com/webstore/devconsole
2. Pay $5 one-time developer registration fee
3. Click "New Item"
4. Upload ZIP of the extension (exclude .git, node_modules, privacy-policy.html, this file)
5. Fill in listing details from above
6. Upload screenshots and promotional tile
7. Set privacy policy URL (host privacy-policy.html on GitHub Pages or paste the text)
8. Set category to "Productivity"
9. Submit for review

## Privacy Policy Hosting

Option A: GitHub Pages
1. Create a repo called "universal-summarizer-privacy" 
2. Add privacy-policy.html as index.html
3. Enable GitHub Pages in repo settings
4. URL will be: https://aap67.github.io/universal-summarizer-privacy/

Option B: Add to your existing site
Host at: francium77.com/summarizer-privacy

## Creating the Submission ZIP

In Codespaces:
```bash
zip -r universal-summarizer-store.zip . -x ".git/*" "privacy-policy.html" "store-listing.md" "popup.html" "popup.js" "*.zip"
```

## Timeline
- Review typically takes 1-3 business days
- Sometimes approved within hours
- Extension works on Edge automatically once published on Chrome Web Store
