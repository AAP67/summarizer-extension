const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20241022';

const SYSTEM_PROMPT = `You are a universal webpage summarizer. Given the text content of a webpage, produce a structured summary in exactly 5 sections totaling 300-400 words.

First, classify the content as one of: news, product, research, blog, documentation, general.

Then use the matching section template:
news: What Happened | Key Facts | Analysis | Impact | Background
product: What It Is | Features | Pricing & Model | Pros & Cons | Verdict
research: Abstract | Methods | Findings | Implications | Limitations
blog: Thesis | Arguments | Evidence | Counterpoints | Conclusion
documentation: Overview | Core Concepts | Key APIs/Features | Usage Notes | Gotchas
general: TL;DR | Key Points | Details | Takeaways | Context

Rules:
- Be factual and neutral
- Preserve numbers, dates, names exactly
- No filler phrases
- Never hallucinate
- 300-400 words total

Respond in this exact JSON format:
{"content_type":"...","sections":[{"header":"...","body":"..."},{"header":"...","body":"..."},{"header":"...","body":"..."},{"header":"...","body":"..."},{"header":"...","body":"..."}]}

Return ONLY valid JSON. No markdown fences, no preamble.`;

async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey || null;
}

async function extractFromTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const noise = ['nav','header','footer','aside','script','style','noscript','iframe','.ad','.ads','.sidebar','.menu','.cookie-banner'];
      const clone = document.body.cloneNode(true);
      noise.forEach(s => { clone.querySelectorAll(s).forEach(el => el.remove()); });
      let content = '';
      for (const s of ['main','article','[role="main"]','.content','.post','.entry']) {
        const el = clone.querySelector(s);
        if (el && el.textContent.trim().length > 200) { content = el.textContent.trim(); break; }
      }
      if (!content || content.length < 200) content = clone.textContent.trim();
      content = content.replace(/\s+/g, ' ');
      return { title: document.title, content: content, url: location.href };
    }
  });
  return results[0].result;
}

async function summarize(url, title, content) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const words = content.split(/\s+/);
  let truncated = content;
  if (words.length > 6000) {
    truncated = words.slice(0, 4500).join(' ') + '\n\n[...truncated...]\n\n' + words.slice(-1500).join(' ');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: 'URL: ' + url + '\nTitle: ' + title + '\n\nContent:\n' + truncated + '\n\nSummarize this page.' }]
    })
  });

  if (!response.ok) throw new Error('API_ERROR: ' + response.status);

  const data = await response.json();
  const text = data.content[0].text;
  try { return JSON.parse(text); }
  catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('PARSE_ERROR');
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'summarize') {
    (async () => {
      try {
        const extraction = await extractFromTab(msg.tabId);
        if (!extraction || extraction.content.trim().length < 50) {
          sendResponse({ success: false, error: 'NO_CONTENT' });
          return;
        }
        const summary = await summarize(extraction.url, extraction.title, extraction.content);
        sendResponse({ success: true, data: { url: extraction.url, title: extraction.title, summary } });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  if (msg.action === 'setApiKey') {
    chrome.storage.local.set({ apiKey: msg.key }).then(() => sendResponse({ success: true }));
    return true;
  }
  if (msg.action === 'checkApiKey') {
    getApiKey().then(key => sendResponse({ hasKey: !!key }));
    return true;
  }
  return true;
});
