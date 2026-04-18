function $(id) { return document.getElementById(id); }

var currentSummaryData = null;

function showView(id) {
  var views = ['setup', 'loading', 'summary', 'error', 'history'];
  for (var i = 0; i < views.length; i++) {
    $(views[i]).style.display = (views[i] === id) ? 'block' : 'none';
  }
  if (id !== 'summary') {
    $('thinWarning').style.display = 'none';
    $('cacheBadge').style.display = 'none';
  }
  // Update tab styling
  if (id === 'history') {
    $('tabSummary').className = 'tab';
    $('tabHistory').className = 'tab active';
  } else {
    $('tabSummary').className = 'tab active';
    $('tabHistory').className = 'tab';
  }
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(timestamp) {
  var seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  var days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Date(timestamp).toLocaleDateString();
}

function runSummarize(skipCache) {
  showView('loading');
  $('tabBar').style.display = 'flex';
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) {
      showError('No active tab found.');
      return;
    }
    chrome.runtime.sendMessage(
      { action: 'summarize', tabId: tabs[0].id, skipCache: skipCache || false },
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
  currentSummaryData = data;
  var summary = data.summary;

  var badge = $('typeBadge');
  badge.textContent = summary.content_type;
  badge.className = 'badge badge-' + summary.content_type;
  badge.style.display = 'inline';

  var cacheBadge = $('cacheBadge');
  cacheBadge.style.display = data.fromCache ? 'inline' : 'none';

  var thinWarning = $('thinWarning');
  thinWarning.style.display = data.thin ? 'block' : 'none';

  $('pageTitle').textContent = data.title || data.url;

  var container = $('sections');
  container.innerHTML = '';

  for (var i = 0; i < summary.sections.length; i++) {
    var section = summary.sections[i];
    var div = document.createElement('div');
    div.className = 'section';
    div.style.animationDelay = (i * 0.08) + 's';
    div.setAttribute('data-header', section.header);
    div.setAttribute('data-body', section.body);
    div.innerHTML = '<h3>' + escapeHtml(section.header) + '<span class="copy-hint">click to copy</span></h3><p>' + escapeHtml(section.body) + '</p>';
    div.addEventListener('click', function() {
      var header = this.getAttribute('data-header');
      var body = this.getAttribute('data-body');
      var text = '## ' + header + '\n' + body;
      var hint = this.querySelector('.copy-hint');
      navigator.clipboard.writeText(text).then(function() {
        hint.textContent = 'copied!';
        hint.style.color = '#15803d';
        hint.style.fontWeight = '600';
        setTimeout(function() {
          hint.textContent = 'click to copy';
          hint.style.color = '';
          hint.style.fontWeight = '';
        }, 1500);
      });
    });
    container.appendChild(div);
  }

  $('tabBar').style.display = 'flex';
  showView('summary');
}

function renderHistoryItem(item) {
  var div = document.createElement('div');
  div.className = 'history-item';
  div.innerHTML = '<div class="history-item-title">' + escapeHtml(item.title) + '</div>' +
    '<div class="history-item-meta">' +
    '<span class="history-item-url">' + escapeHtml(item.url) + '</span>' +
    '<span class="history-item-time">' + timeAgo(item.timestamp) + '</span>' +
    '</div>';
  div.addEventListener('click', function() {
    renderSummary({
      url: item.url,
      title: item.title,
      summary: item.summary,
      thin: item.thin,
      fromCache: true
    });
  });
  return div;
}

function loadHistory(filter) {
  chrome.runtime.sendMessage({ action: 'getHistory' }, function(response) {
    if (chrome.runtime.lastError || !response || !response.success) return;

    var list = $('historyList');
    list.innerHTML = '';

    var items = response.data;
    if (filter) {
      var lower = filter.toLowerCase();
      items = items.filter(function(item) {
        return item.title.toLowerCase().indexOf(lower) >= 0 ||
               item.url.toLowerCase().indexOf(lower) >= 0;
      });
    }

    if (items.length === 0) {
      list.innerHTML = '<div class="history-empty">' +
        (filter ? 'No matches found.' : 'No summaries yet. Summarize a page to get started.') +
        '</div>';
      return;
    }

    for (var i = 0; i < items.length; i++) {
      list.appendChild(renderHistoryItem(items[i]));
    }
  });
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

function copyAll() {
  var sections = document.querySelectorAll('#sections .section');
  var text = '';
  for (var i = 0; i < sections.length; i++) {
    var header = sections[i].getAttribute('data-header');
    var body = sections[i].getAttribute('data-body');
    text += '## ' + header + '\n' + body + '\n\n';
  }
  navigator.clipboard.writeText(text.trim()).then(function() {
    var btn = $('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy All'; }, 1500);
  });
}

function exportMarkdown() {
  if (!currentSummaryData) return;
  var data = currentSummaryData;
  var summary = data.summary;

  var md = '# ' + data.title + '\n\n';
  md += '> Source: ' + data.url + '\n';
  md += '> Type: ' + summary.content_type + '\n';
  md += '> Date: ' + new Date().toLocaleDateString() + '\n\n';
  md += '---\n\n';

  for (var i = 0; i < summary.sections.length; i++) {
    md += '## ' + summary.sections[i].header + '\n\n';
    md += summary.sections[i].body + '\n\n';
  }

  var blob = new Blob([md], { type: 'text/markdown' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var filename = data.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').substring(0, 50).toLowerCase();
  a.download = filename + '-summary.md';
  a.click();
  URL.revokeObjectURL(url);

  var btn = $('exportBtn');
  btn.textContent = 'Exported!';
  setTimeout(function() { btn.textContent = 'Export .md'; }, 1500);
}

// --- Event listeners ---
$('saveKeyBtn').addEventListener('click', function() {
  var key = $('apiKeyInput').value.trim();
  if (!key) return;
  chrome.runtime.sendMessage({ action: 'setApiKey', key: key }, function() {
    runSummarize(false);
  });
});

$('copyBtn').addEventListener('click', copyAll);
$('exportBtn').addEventListener('click', exportMarkdown);
$('resummarizeBtn').addEventListener('click', function() { runSummarize(true); });
$('retryBtn').addEventListener('click', function() { runSummarize(false); });

$('tabSummary').addEventListener('click', function() {
  if (currentSummaryData) {
    showView('summary');
  } else {
    runSummarize(false);
  }
});

$('tabHistory').addEventListener('click', function() {
  loadHistory();
  showView('history');
});

$('historySearch').addEventListener('input', function() {
  loadHistory(this.value);
});

$('clearHistoryBtn').addEventListener('click', function() {
  if (confirm('Clear all summary history?')) {
    chrome.runtime.sendMessage({ action: 'clearHistory' }, function() {
      loadHistory();
    });
  }
});

// --- Init ---
chrome.runtime.sendMessage({ action: 'checkApiKey' }, function(response) {
  if (chrome.runtime.lastError || !response) {
    showView('setup');
    return;
  }
  if (response.hasKey) {
    runSummarize(false);
  } else {
    showView('setup');
  }
});