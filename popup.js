function $(id) { return document.getElementById(id); }

function showView(id) {
  var views = ['setup', 'loading', 'summary', 'error'];
  for (var i = 0; i < views.length; i++) {
    $(views[i]).style.display = (views[i] === id) ? 'block' : 'none';
  }
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function runSummarize() {
  showView('loading');
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) {
      showError('No active tab found.');
      return;
    }
    chrome.runtime.sendMessage(
      { action: 'summarize', tabId: tabs[0].id },
      function(response) {
        if (chrome.runtime.lastError) {
          showError(chrome.runtime.lastError.message);
          return;
        }
        if (!response) {
          showError('No response from background. Try again.');
          return;
        }
        if (response.success) {
          renderSummary(response.data);
        } else {
          showError(response.error);
        }
      }
    );
  });
}

function renderSummary(data) {
  var summary = data.summary;

  var badge = $('typeBadge');
  badge.textContent = summary.content_type;
  badge.style.display = 'inline';

  $('pageTitle').textContent = data.title || data.url;

  var container = $('sections');
  container.innerHTML = '';

  for (var i = 0; i < summary.sections.length; i++) {
    var section = summary.sections[i];
    var div = document.createElement('div');
    div.className = 'section';
    div.innerHTML = '<h3>' + escapeHtml(section.header) + '</h3><p>' + escapeHtml(section.body) + '</p>';
    container.appendChild(div);
  }

  showView('summary');
}

function showError(msg) {
  var friendly = msg || 'Unknown error';
  if (friendly.indexOf('NO_API_KEY') >= 0) {
    showView('setup');
    return;
  }
  if (friendly.indexOf('NO_CONTENT') >= 0) {
    friendly = 'Not enough readable content on this page.';
  }
  if (friendly.indexOf('API_ERROR: 401') >= 0) {
    friendly = 'Invalid API key. Check and re-enter.';
  }
  if (friendly.indexOf('API_ERROR: 429') >= 0) {
    friendly = 'Rate limited. Wait a moment and retry.';
  }
  $('errorMsg').textContent = friendly;
  showView('error');
}

function copySummary() {
  var sections = document.querySelectorAll('.section');
  var text = '';
  for (var i = 0; i < sections.length; i++) {
    var header = sections[i].querySelector('h3').textContent;
    var body = sections[i].querySelector('p').textContent;
    text += '## ' + header + '\n' + body + '\n\n';
  }
  navigator.clipboard.writeText(text.trim()).then(function() {
    var btn = $('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy Summary'; }, 1500);
  });
}

$('saveKeyBtn').addEventListener('click', function() {
  var key = $('apiKeyInput').value.trim();
  if (!key) return;
  chrome.runtime.sendMessage({ action: 'setApiKey', key: key }, function() {
    runSummarize();
  });
});

$('copyBtn').addEventListener('click', copySummary);
$('resummarizeBtn').addEventListener('click', runSummarize);
$('retryBtn').addEventListener('click', runSummarize);

chrome.runtime.sendMessage({ action: 'checkApiKey' }, function(response) {
  if (chrome.runtime.lastError || !response) {
    showView('setup');
    return;
  }
  if (response.hasKey) {
    runSummarize();
  } else {
    showView('setup');
  }
});
