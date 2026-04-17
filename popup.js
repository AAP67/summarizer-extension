// ============================================
// Universal Summarizer — Popup Controller
// ============================================

const $ = (sel) => document.querySelector(sel);

const views = {
  setup: $('#setup'),
  loading: $('#loading'),
  result: $('#result'),
  error: $('#error')
};

function showView(name) {
  Object.values(views).forEach(v => v.style.display = 'none');
  views[name].style.display = 'block';
}

// Parse markdown summary into structured sections
function parseSummary(markdown) {
  const lines = markdown.split('\n');
  let contentType = 'general';
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    // Extract content type badge: **[Type]**
    const typeMatch = line.match(/^\*\*\[?([^\]*]+)\]?\*\*$/);
    if (typeMatch) {
      contentType = typeMatch[1].trim();
      continue;
    }

    // Section header: ## Title
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: headerMatch[1].trim(), body: '' };
      continue;
    }

    // Body text
    if (currentSection && line.trim()) {
      currentSection.body += (currentSection.body ? ' ' : '') + line.trim();
    }
  }
  if (currentSection) sections.push(currentSection);

  return { contentType, sections };
}

function renderSummary(data) {
  const { contentType, sections } = parseSummary(data.summary);

  $('#pageTitle').textContent = data.title;

  let html = '<span class="content-type">' + contentType + '</span>';
  for (const sec of sections) {
    html += '<div class="section">';
    html += '<h2>' + sec.title + '</h2>';
    html += '<p>' + sec.body + '</p>';
    html += '</div>';
  }
  $('#summaryContent').innerHTML = html;

  const tokens = data.usage ? (data.usage.input_tokens + data.usage.output_tokens) : '?';
  $('#metaInfo').textContent = tokens + ' tokens';

  showView('result');
}

async function runSummarize() {
  showView('loading');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    showError('No active tab found.');
    return;
  }

  chrome.runtime.sendMessage(
    { action: 'summarize', tabId: tab.id },
    (response) => {
      if (!response) {
        showError('No response from background worker.');
        return;
      }
      if (response.error === 'NO_API_KEY') {
        showView('setup');
        return;
      }
      if (response.error) {
        showError(response.message || response.error);
        return;
      }
      renderSummary(response);
    }
  );
}

function showError(msg) {
  $('#errorMsg').textContent = msg;
  showView('error');
}

// --- Event Listeners ---

$('#saveKeyBtn').addEventListener('click', () => {
  const key = $('#apiKeyInput').value.trim();
  if (!key) return;
  chrome.runtime.sendMessage({ action: 'saveApiKey', apiKey: key }, () => {
    runSummarize();
  });
});

$('#retryBtn').addEventListener('click', () => runSummarize());

$('#copyBtn').addEventListener('click', () => {
  const text = $('#summaryContent').innerText;
  navigator.clipboard.writeText(text).then(() => {
    $('#copyBtn').textContent = '✓ Copied';
    setTimeout(() => { $('#copyBtn').textContent = '📋 Copy'; }, 1500);
  });
});

$('#settingsBtn').addEventListener('click', () => {
  showView('setup');
  chrome.storage.local.get('apiKey', (data) => {
    if (data.apiKey) {
      $('#apiKeyInput').value = data.apiKey;
    }
  });
});

// --- Init ---
chrome.runtime.sendMessage({ action: 'checkApiKey' }, (response) => {
  if (response && response.hasKey) {
    runSummarize();
  } else {
    showView('setup');
  }
});
