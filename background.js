importScripts('utils/prompt.js');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20241022';

async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey || null;
}

async function setApiKey(key) {
  await chrome.storage.local.set({ apiKey: key });
}

async function summarize(url, title, content) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const userPrompt = buildUserPrompt(url, title, content);

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
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API_ERROR: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  try { return JSON.parse(text); }
  catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('PARSE_ERROR');
  }
}

async function handleSummarize(tabId) {
  const extraction = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
  if (!extraction || !extraction.content || extraction.content.trim().length < 50) {
    throw new Error('NO_CONTENT: Not enough readable content on this page.');
  }
  const summary = await summarize(extraction.url, extraction.title, extraction.content);
  return { url: extraction.url, title: extraction.title, summary, timestamp: Date.now() };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'summarize') {
    handleSummarize(msg.tabId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (msg.action === 'setApiKey') {
    setApiKey(msg.key).then(() => sendResponse({ success: true }));
    return true;
  }
  if (msg.action === 'checkApiKey') {
    getApiKey().then(key => sendResponse({ hasKey: !!key }));
    return true;
  }
});
