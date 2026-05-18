// Screen: Share — encode record to URL and copy to clipboard
// Exposes: window.ShareScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('share-content'),
  };

  var currentRecord = null;
  var currentUrl    = null;

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // KaiOS 2.x fallback
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  function render(rec) {
    currentRecord = rec;

    var validation = WPCodec.validate(rec);
    if (!validation.valid) {
      el.content.innerHTML =
        '<div class="empty-state">Cannot share:<br>' +
        esc(validation.errors.join(', ')) + '</div>';
      currentUrl = null;
      return;
    }

    try {
      currentUrl = RecordService.encodeUrl(rec);
    } catch (e) {
      el.content.innerHTML =
        '<div class="empty-state">Encoding failed:<br>' + esc(e.message) + '</div>';
      currentUrl = null;
      return;
    }

    el.content.innerHTML =
      '<div class="view-field">' +
        '<div class="view-field-label">Record</div>' +
        '<div class="view-field-value">' + esc(rec.job || '(untitled)') + '</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Share link</div>' +
        '<div class="share-url" id="share-url-display">' +
          'https://' + esc(currentUrl) +
        '</div>' +
      '</div>' +
      '<div class="share-status" id="share-status" style="display:none;">Copied!</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Length</div>' +
        '<div class="view-field-value">' + currentUrl.length + ' chars</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Powered by</div>' +
        '<div class="view-field-value" style="color:var(--text-muted);">Workpads v0.2.0 · pads-v1 (1pa/) codec</div>' +
      '</div>';

    WorkpadsPanel.setContext({ screen: 'share', record: rec, url: currentUrl });
  }

  function doCopy() {
    if (!currentUrl) return;
    var fullUrl = 'https://' + currentUrl;
    copyToClipboard(fullUrl).then(function() {
      var status = document.getElementById('share-status');
      if (status) {
        status.style.display = 'block';
        setTimeout(function() { status.style.display = 'none'; }, 2000);
      }
    }).catch(function(e) {
      alert('Copy failed: ' + e.message);
    });
  }

  function onShow(rec) {
    render(rec);
  }

  function onKey(key) {
    switch (key) {
      case 'Backspace':
        App.showView(currentRecord);
        break;
      case 'Enter':
        doCopy();
        break;
    }
  }

  global.ShareScreen = {
    onShow: onShow,
    onKey: onKey,
    getCurrentRecord: function() { return currentRecord; },
  };

}(window));
