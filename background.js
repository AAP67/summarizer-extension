// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(function(tab) {
  chrome.sidePanel.open({ tabId: tab.id });
});

var API_URL = 'https://api.anthropic.com/v1/messages';
var MODEL = 'claude-haiku-4-5-20251001';

var SYSTEM_PROMPT = 'You are a universal webpage summarizer. Given the text content of a webpage, produce a structured summary in exactly 5 sections totaling 300-400 words.\n\nFirst, classify the content as one of: news, product, research, blog, documentation, general.\n\nThen use the matching section template:\nnews: What Happened | Key Facts | Analysis | Impact | Background\nproduct: What It Is | Features | Pricing & Model | Pros & Cons | Verdict\nresearch: Abstract | Methods | Findings | Implications | Limitations\nblog: Thesis | Arguments | Evidence | Counterpoints | Conclusion\ndocumentation: Overview | Core Concepts | Key APIs/Features | Usage Notes | Gotchas\ngeneral: TL;DR | Key Points | Details | Takeaways | Context\n\nRules:\n- Be factual and neutral\n- Preserve numbers, dates, names exactly\n- No filler phrases\n- Never hallucinate\n- 300-400 words total\n\nRespond in this exact JSON format:\n{"content_type":"...","sections":[{"header":"...","body":"..."},{"header":"...","body":"..."},{"header":"...","body":"..."},{"header":"...","body":"..."},{"header":"...","body":"..."}]}\n\nReturn ONLY valid JSON. No markdown fences, no preamble.';

async function getApiKey() {
  var result = await chrome.storage.local.get('apiKey');
  return result.apiKey || null;
}

// --- Cache functions ---
function getCacheKey(url) {
  return 'cache_' + url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 180);
}

async function getCached(url) {
  var key = getCacheKey(url);
  var result = await chrome.storage.local.get(key);
  if (result[key]) {
    var cached = result[key];
    if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached;
    }
    await chrome.storage.local.remove(key);
  }
  return null;
}

async function setCache(url, data) {
  var key = getCacheKey(url);
  var entry = {};
  entry[key] = {
    url: data.url,
    title: data.title,
    summary: data.summary,
    thin: data.thin || false,
    timestamp: Date.now()
  };
  await chrome.storage.local.set(entry);
}

async function clearCache(url) {
  var key = getCacheKey(url);
  await chrome.storage.local.remove(key);
}

// --- History functions ---
async function addToHistory(data) {
  var result = await chrome.storage.local.get('history');
  var history = result.history || [];

  // Remove duplicate URL if exists
  history = history.filter(function(item) { return item.url !== data.url; });

  // Add to front
  history.unshift({
    url: data.url,
    title: data.title,
    summary: data.summary,
    content_type: data.summary.content_type,
    thin: data.thin || false,
    timestamp: Date.now()
  });

  // Keep only last 50
  if (history.length > 50) {
    history = history.slice(0, 50);
  }

  await chrome.storage.local.set({ history: history });
}

async function getHistory() {
  var result = await chrome.storage.local.get('history');
  return result.history || [];
}

async function clearHistory() {
  await chrome.storage.local.set({ history: [] });
}

// --- Content extraction ---
async function extractFromTab(tabId) {
  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      var noise = ['nav','header','footer','aside','script','style','noscript','iframe','.ad','.ads','.sidebar','.menu','.cookie-banner'];
      var clone = document.body.cloneNode(true);
      for (var i = 0; i < noise.length; i++) {
        var els = clone.querySelectorAll(noise[i]);
        for (var j = 0; j < els.length; j++) { els[j].remove(); }
      }
      var content = '';
      var selectors = ['main','article','[role="main"]','.content','.post','.entry'];
      for (var k = 0; k < selectors.length; k++) {
        var el = clone.querySelector(selectors[k]);
        if (el && el.textContent.trim().length > 200) { content = el.textContent.trim(); break; }
      }
      if (!content || content.length < 200) { content = clone.textContent.trim(); }
      content = content.replace(/\s+/g, ' ');
      return { title: document.title, content: content, url: location.href };
    }
  });
  return results[0].result;
}

// --- Smart truncation ---
function truncateContent(content) {
  var words = content.split(/\s+/);
  if (words.length <= 6000) return content;
  var headCount = Math.floor(6000 * 0.6);
  var tailCount = Math.floor(6000 * 0.2);
  var head = words.slice(0, headCount).join(' ');
  var tail = words.slice(-tailCount).join(' ');
  return head + '\n\n[... content truncated for length ...]\n\n' + tail;
}

// --- Summarize via API ---
async function summarize(url, title, content) {
  var apiKey = await getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  var truncated = truncateContent(content);

  var response = await fetch(API_URL, {
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

  var data = await response.json();
  var text = data.content[0].text;
  try { return JSON.parse(text); }
  catch (e) {
    var match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('PARSE_ERROR');
  }
}

// --- Main handler ---
async function handleSummarize(tabId, skipCache) {
  var extraction = await extractFromTab(tabId);
  if (!extraction || extraction.content.trim().length < 50) {
    throw new Error('NO_CONTENT: Not enough readable content on this page.');
  }

  var wordCount = extraction.content.trim().split(/\s+/).length;
  var thin = wordCount < 200;

  if (!skipCache) {
    var cached = await getCached(extraction.url);
    if (cached) {
      return {
        url: cached.url,
        title: cached.title,
        summary: cached.summary,
        thin: cached.thin,
        fromCache: true
      };
    }
  } else {
    await clearCache(extraction.url);
  }

  var summary = await summarize(extraction.url, extraction.title, extraction.content);

  var result = {
    url: extraction.url,
    title: extraction.title,
    summary: summary,
    thin: thin,
    fromCache: false
  };

  await setCache(extraction.url, result);
  await addToHistory(result);

  return result;
}

// --- Message listener ---
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === 'summarize') {
    (async function() {
      try {
        var result = await handleSummarize(msg.tabId, msg.skipCache || false);
        sendResponse({ success: true, data: result });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.action === 'getHistory') {
    getHistory().then(function(history) {
      sendResponse({ success: true, data: history });
    });
    return true;
  }

  if (msg.action === 'clearHistory') {
    clearHistory().then(function() {
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === 'setApiKey') {
    chrome.storage.local.set({ apiKey: msg.key }).then(function() {
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === 'checkApiKey') {
    getApiKey().then(function(key) {
      sendResponse({ hasKey: !!key });
    });
    return true;
  }

  return true;
});