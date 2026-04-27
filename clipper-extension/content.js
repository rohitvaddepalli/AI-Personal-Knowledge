// Content script — extracts page content and selected text for the clipper

// Listen for messages from background / popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_PAGE_CONTENT') {
    sendResponse({
      title: document.title,
      url: location.href,
      selection: window.getSelection()?.toString() || '',
      bodyText: extractReadableText(),
    });
  }
  return false;
});

function extractReadableText() {
  // Remove script, style, nav, footer noise
  const clone = document.body.cloneNode(true);
  ['script', 'style', 'nav', 'footer', 'header', 'noscript', 'aside', 'form'].forEach((tag) => {
    clone.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // Prefer article / main content
  const article = clone.querySelector('article') || clone.querySelector('main') || clone;
  const text = article.innerText || article.textContent || '';
  return text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000);
}
