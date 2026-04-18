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
  badge.className = 'badge badge-' + summary.content_type;
  badge.style.display = 'inline';

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

function copyAll() {
  var sections = document.querySelectorAll('.section');
  var text = '';
  for (var i = 0; i < sections.length; i++) {
    var header = sections[i].querySelector('h3').firstChild.textContent;
    var body = sections[i].querySelector('p').textContent;
    text += '## ' + header + '\n' + body + '\n\n';
  }
  navigator.clipboard.writeText(text.trim()).then(function() {
    var btn = $('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy All'; }, 1500);
  });
}

$('saveKeyBtn').addEventListener('click', function() {
  var key = $('apiKeyInput').value.trim();
  if (!key) return;
  chrome.runtime.sendMessage({ action: 'setApiKey', key: key }, function() {
    runSummarize();
  });
});

$('copyBtn').addEventListener('click', copyAll);
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
