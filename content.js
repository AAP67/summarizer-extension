function extractContent() {
  let title = document.title || '';
  let content = '';

  if (typeof Readability !== 'undefined') {
    try {
      const clone = document.cloneNode(true);
      const article = new Readability(clone).parse();
      if (article && article.textContent && article.textContent.trim().length > 100) {
        return { title: article.title || title, content: article.textContent.trim(), url: window.location.href };
      }
    } catch (e) {
      console.warn('[Summarizer] Readability failed, using fallback:', e);
    }
  }

  const noiseSelectors = ['nav','header','footer','aside','[role="navigation"]','[role="banner"]','[role="contentinfo"]','.sidebar','.menu','.nav','.footer','.header','.ad','.ads','.advertisement','.cookie-banner','script','style','noscript','iframe'];
  const clone = document.body.cloneNode(true);
  noiseSelectors.forEach(sel => { clone.querySelectorAll(sel).forEach(el => el.remove()); });

  const mainSelectors = ['main','article','[role="main"]','.content','.post','.entry'];
  for (const sel of mainSelectors) {
    const main = clone.querySelector(sel);
    if (main && main.textContent.trim().length > 200) { content = main.textContent.trim(); break; }
  }

  if (!content || content.length < 200) { content = clone.textContent.trim(); }
  content = content.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n');

  return { title, content, url: window.location.href };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract') { sendResponse(extractContent()); }
  return true;
});
