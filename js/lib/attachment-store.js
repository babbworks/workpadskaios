// attachment-store.js — persist camera/file blobs for record attachments (survives reload)
// Exposes: window.WPAttachment

(function(global) {
  'use strict';

  // ~200 KB base64 cap — keeps localStorage records usable on KaiOS
  var MAX_DATA_URL_CHARS = 280000;

  function persistBlob(blob, callback) {
    if (!blob) {
      if (callback) callback(null);
      return;
    }
    if (typeof FileReader === 'undefined') {
      try {
        if (callback) callback(global.URL && URL.createObjectURL ? URL.createObjectURL(blob) : null);
      } catch (e) {
        if (callback) callback(null);
      }
      return;
    }
    var reader = new FileReader();
    reader.onload = function() {
      var dataUrl = reader.result || '';
      if (typeof dataUrl === 'string' && dataUrl.length > MAX_DATA_URL_CHARS) {
        console.warn('[workpads] attachment too large for persistent storage; using session URL');
        try {
          if (callback) callback(global.URL && URL.createObjectURL ? URL.createObjectURL(blob) : null);
        } catch (e2) {
          if (callback) callback(null);
        }
        return;
      }
      if (callback) callback(dataUrl);
    };
    reader.onerror = function() {
      try {
        if (callback) callback(global.URL && URL.createObjectURL ? URL.createObjectURL(blob) : null);
      } catch (e3) {
        if (callback) callback(null);
      }
    };
    reader.readAsDataURL(blob);
  }

  function isEphemeralUrl(url) {
    return !!(url && String(url).indexOf('blob:') === 0);
  }

  global.WPAttachment = {
    persistBlob:      persistBlob,
    isEphemeralUrl:   isEphemeralUrl,
    MAX_DATA_URL_CHARS: MAX_DATA_URL_CHARS,
  };

}(window));
