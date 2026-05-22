// Screen: Share — encode record to URL with tag selection and passphrase for #1ps/
// Exposes: window.ShareScreen

(function(global) {
  'use strict';

  var el = {
    content:    document.getElementById('share-content'),
    tagPicker:  null,
    ppOverlay:  null,
  };

  var currentRecord    = null;
  var currentUrl       = null;
  var selectedTag      = '1pa';   // '1pa' | '1pb' | '1ps'
  var tagFocusIdx      = 0;
  var linkCopied       = false;
  var mode             = 'tags';  // 'tags' | 'passphrase'
  var ppBuffer         = '';

  // Presentation state
  var presentationOpen = false;
  var trigOpen         = false;
  var routingOpen      = false;
  var dsDisplayType    = 0;   // 0=standard, 1=billboard, 2=form, 3=form+qr
  var dsDataSource     = 0;   // 0=full, 1=public, 2=summary, 3=anon
  var dsShowPrice      = false;
  var dsShowContact    = false;
  var fsSubmitAction   = 0;   // 0=reply, 1=book, 2=pay, 3=enquire
  var fsRequireName    = false;
  var fsRequirePhone   = false;
  var fsAllowEdit      = false;
  var trigCode         = '';
  var ackRequest       = false;
  var restrictForward  = false;
  var encodeTimer      = null;

  var DS_DISPLAY_OPTS = ['Standard', 'Billboard', 'Form', 'Form+QR'];
  var DS_SOURCE_OPTS  = ['Full', 'Public', 'Summary', 'Anon'];
  var FS_SUBMIT_OPTS  = ['Reply', 'Book', 'Pay', 'Enquire'];

  var TAGS = [
    { id: '1pa', label: 'Plain',     hint: 'Standard link — named recipients only' },
    { id: '1pb', label: 'Public',    hint: 'Broadcast / QR code — no financial data' },
    { id: '1ps', label: 'Protected', hint: 'AES-encrypted — recipient needs code' },
  ];

  // ── Clipboard ────────────────────────────────────────────────────────────────

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
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

  function showCopied() {
    var s = document.getElementById('share-status');
    if (!s) return;
    s.style.display = 'block';
    setTimeout(function() { s.style.display = 'none'; }, 2000);
  }

  // ── Encode helpers ────────────────────────────────────────────────────────────

  function buildPresentationOpts() {
    var ds = {
      displayType: dsDisplayType,
      dataSource:  dsDataSource,
      showPrice:   dsShowPrice,
      showContact: dsShowContact,
    };
    var fs = (dsDisplayType >= 2) ? {
      submitAction:  fsSubmitAction,
      requireName:   fsRequireName,
      requirePhone:  fsRequirePhone,
      allowEdit:     fsAllowEdit,
    } : null;
    return { displaySchema: ds, formSchema: fs };
  }

  function hasPresentationSet() {
    return dsDisplayType > 0 || dsDataSource > 0 || dsShowPrice || dsShowContact;
  }

  function encodeWithTag(rec, tag, passphrase) {
    var validation = WPCodec.validate(rec);
    if (!validation.valid) throw new Error('Cannot share: ' + validation.errors.join(', '));
    var opts = { tag: tag, passphrase: passphrase };
    if (tag !== '1ps' && hasPresentationSet()) {
      var pOpts = buildPresentationOpts();
      opts.displaySchema = pOpts.displaySchema;
      if (pOpts.formSchema) opts.formSchema = pOpts.formSchema;
    }
    if (tag !== '1ps' && trigCode.trim()) {
      opts.trigCode = trigCode.trim();
    }
    if (tag !== '1ps' && global.WPAnon && dsDataSource === 3) {
      var anonCheck = global.WPAnon.validateAnonMode(opts);
      if (!anonCheck.valid) throw new Error('Anonymous share: ' + anonCheck.errors.join(', '));
    }
    if (ackRequest)      opts.ackRequest      = true;
    if (restrictForward) opts.restrictForward = true;
    return RecordService.encodeUrl(rec, opts);
  }

  // ── Passphrase overlay ────────────────────────────────────────────────────────

  function renderPassphraseOverlay() {
    var ov = document.getElementById('share-pp-overlay');
    if (!ov) return;
    ov.innerHTML =
      '<div class="pp-title">Enter passphrase</div>' +
      '<div class="pp-hint">Recipient must enter same code to open link.</div>' +
      '<div class="pp-input" id="pp-input-display">' +
        (ppBuffer.length ? ppBuffer.replace(/./g, '\u2022') : '<span style="color:var(--text-muted)">Enter code\u2026</span>') +
      '</div>' +
      '<div class="pp-hint" style="margin-top:4px;">CSK = confirm &nbsp; Back = cancel</div>';
  }

  function openPassphraseOverlay() {
    ppBuffer = '';
    mode     = 'passphrase';

    var existing = document.getElementById('share-pp-overlay');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'share-pp-overlay';
      existing.className = 'pp-overlay';
      document.getElementById('share-content').appendChild(existing);
    }
    renderPassphraseOverlay();
  }

  function closePassphraseOverlay() {
    var ov = document.getElementById('share-pp-overlay');
    if (ov) ov.parentNode.removeChild(ov);
    mode = 'tags';
  }

  function confirmPassphrase() {
    if (!ppBuffer || ppBuffer.length < 4) {
      renderPassphraseOverlay();
      var inp = document.getElementById('pp-input-display');
      if (inp) inp.style.color = 'var(--error)';
      return;
    }
    var passphrase = ppBuffer;
    closePassphraseOverlay();
    try {
      currentUrl = encodeWithTag(currentRecord, '1ps', passphrase);
      selectedTag = '1ps';
      renderTagScreen();
    } catch (e) {
      renderError(e.message);
    }
  }

  // ── Presentation + Trigger sections ─────────────────────────────────────────

  function renderPresentationSection() {
    var caret = presentationOpen ? '&#9652;' : '&#9662;';
    var active = hasPresentationSet() ? ' (active)' : '';
    var hdr = '<div class="field-more-hdr" id="share-pres-hdr"><span>Presentation' + esc(active) + '</span><span>' + caret + '</span></div>';
    if (!presentationOpen) return hdr;

    function optRow(dataOpt, label, valStr, isCycle) {
      var arrow = isCycle ? ' <span style="color:var(--text-muted)">&#9656;</span>' : '';
      return '<div class="share-opt-row" data-opt="' + dataOpt + '">' +
        '<span class="share-opt-label">' + esc(label) + '</span>' +
        '<span class="share-opt-val">' + esc(valStr) + arrow + '</span>' +
      '</div>';
    }
    function togRow(dataOpt, label, on) {
      return optRow(dataOpt, label, on ? 'On' : 'Off', false);
    }

    var body = optRow('display-type', 'Display',  DS_DISPLAY_OPTS[dsDisplayType], true) +
               optRow('data-source',  'Source',   DS_SOURCE_OPTS[dsDataSource],   true) +
               togRow('show-price',   'Price',    dsShowPrice) +
               togRow('show-contact', 'Contact',  dsShowContact);

    if (dsDisplayType >= 2) {
      body += '<div class="share-opt-subsec">Form</div>' +
              optRow('submit-action',  'Submit',    FS_SUBMIT_OPTS[fsSubmitAction], true) +
              togRow('require-name',   'Req name',  fsRequireName)  +
              togRow('require-phone',  'Req phone', fsRequirePhone) +
              togRow('allow-edit',     'Allow edit', fsAllowEdit);
    }

    return hdr + '<div class="share-opt-section">' + body + '</div>';
  }

  function renderTrigSection() {
    var caret = trigOpen ? '&#9652;' : '&#9662;';
    var active = trigCode.trim() ? ' (set)' : '';
    var hdr = '<div class="field-more-hdr" id="share-trig-hdr"><span>Trigger' + esc(active) + '</span><span>' + caret + '</span></div>';
    if (!trigOpen) return hdr;
    return hdr +
      '<div class="field-group">' +
        '<div class="field-label">Code (max 20 chars)</div>' +
        '<input class="field-input" id="share-trig-input" type="text" ' +
          'value="' + esc(trigCode) + '" maxlength="20" autocomplete="off" autocorrect="off">' +
      '</div>';
  }

  function wirePresentationSection() {
    var presHdr = document.getElementById('share-pres-hdr');
    if (presHdr) presHdr.addEventListener('click', function() {
      presentationOpen = !presentationOpen;
      renderTagScreen();
    });

    var rows = el.content.querySelectorAll('.share-opt-row[data-opt]');
    for (var ri = 0; ri < rows.length; ri++) {
      rows[ri].addEventListener('click', (function(row) {
        return function() {
          var opt = row.getAttribute('data-opt');
          switch (opt) {
            case 'display-type':  dsDisplayType  = (dsDisplayType  + 1) % 4; break;
            case 'data-source':   dsDataSource   = (dsDataSource   + 1) % 4; break;
            case 'show-price':    dsShowPrice    = !dsShowPrice;              break;
            case 'show-contact':  dsShowContact  = !dsShowContact;            break;
            case 'submit-action': fsSubmitAction = (fsSubmitAction + 1) % 4; break;
            case 'require-name':  fsRequireName  = !fsRequireName;            break;
            case 'require-phone': fsRequirePhone = !fsRequirePhone;           break;
            case 'allow-edit':    fsAllowEdit    = !fsAllowEdit;              break;
          }
          reEncodeAndRender();
        };
      })(rows[ri]));
    }
  }

  function wireTrigSection() {
    var trigHdr = document.getElementById('share-trig-hdr');
    if (trigHdr) trigHdr.addEventListener('click', function() {
      trigOpen = !trigOpen;
      renderTagScreen();
    });

    var trigInp = document.getElementById('share-trig-input');
    if (trigInp) {
      trigInp.addEventListener('input', function() {
        trigCode = this.value.trim().slice(0, 20);
        reEncodeAndRender();
      });
      trigInp.addEventListener('change', function() {
        trigCode = this.value.trim().slice(0, 20);
        reEncodeAndRender();
      });
      trigInp.addEventListener('keydown', function(e) {
        e.stopPropagation();
      });
    }
  }

  function renderRoutingSection() {
    var caret = routingOpen ? '&#9652;' : '&#9662;';
    var active = (ackRequest || restrictForward) ? ' (active)' : '';
    var hdr = '<div class="field-more-hdr" id="share-routing-hdr"><span>Routing' + esc(active) + '</span><span>' + caret + '</span></div>';
    if (!routingOpen) return hdr;
    function togRow(dataOpt, label, on) {
      return '<div class="share-opt-row" data-opt="' + dataOpt + '">' +
        '<span class="share-opt-label">' + esc(label) + '</span>' +
        '<span class="share-opt-val">' + (on ? 'On' : 'Off') + '</span>' +
      '</div>';
    }
    return hdr + '<div class="share-opt-section">' +
      togRow('ack-request',      'Read receipt',   ackRequest) +
      togRow('restrict-forward', 'No re-sharing',  restrictForward) +
    '</div>';
  }

  function wireRoutingSection() {
    var hdr = document.getElementById('share-routing-hdr');
    if (hdr) hdr.addEventListener('click', function() {
      routingOpen = !routingOpen;
      renderTagScreen();
    });
    var rows = el.content.querySelectorAll('.share-opt-row[data-opt="ack-request"], .share-opt-row[data-opt="restrict-forward"]');
    for (var ri = 0; ri < rows.length; ri++) {
      rows[ri].addEventListener('click', (function(row) {
        return function() {
          var opt = row.getAttribute('data-opt');
          if (opt === 'ack-request')      ackRequest      = !ackRequest;
          if (opt === 'restrict-forward') restrictForward = !restrictForward;
          reEncodeAndRender();
        };
      })(rows[ri]));
    }
  }

  function reEncodeAndRender() {
    if (!currentRecord || selectedTag === '1ps') { renderTagScreen(); return; }
    if (encodeTimer) clearTimeout(encodeTimer);
    encodeTimer = setTimeout(function() {
      encodeTimer = null;
      try {
        currentUrl = encodeWithTag(currentRecord, selectedTag, null);
        renderTagScreen();
      } catch (e) {
        renderError(e.message);
      }
    }, 120);
  }

  function amendmentShareNote(rec) {
    if (!rec || typeof RecordService === 'undefined') return '';
    if (!RecordService.isAmendmentShare(rec)) return '';
    var ids = RecordService.amendmentChangedFieldIds(rec);
    if (!ids.length) return '<div class="share-amend-note">Amendment share (no field diffs vs original)</div>';
    var labels = ids.slice(0, 6).map(function(f) {
      return f.replace(/_/g, ' ');
    }).join(', ');
    var more = ids.length > 6 ? ' +' + (ids.length - 6) + ' more' : '';
    return '<div class="share-amend-note">Amendment: ' + esc(ids.length) + ' changed — ' + esc(labels) + esc(more) + '</div>';
  }

  function prefillFromRecord(rec) {
    if (!rec) return;
    if (rec.displaySchema) {
      var ds = rec.displaySchema;
      dsDisplayType = ds.displayType != null ? ds.displayType : 0;
      dsDataSource  = ds.dataSource  != null ? ds.dataSource  : 0;
      dsShowPrice   = !!ds.showPrice;
      dsShowContact = !!ds.showContact;
    }
    if (rec.formSchema) {
      var fs = rec.formSchema;
      fsSubmitAction = fs.submitAction != null ? fs.submitAction : 0;
      fsRequireName  = !!fs.requireName;
      fsRequirePhone = !!fs.requirePhone;
      fsAllowEdit    = !!fs.allowEdit;
    }
    if (rec.trigBytes && rec.trigBytes.length) {
      var tc = '';
      for (var ti = 0; ti < rec.trigBytes.length && ti < 20; ti++) {
        tc += String.fromCharCode(rec.trigBytes[ti] & 0xff);
      }
      trigCode = tc;
    }
    ackRequest      = !!rec.ackRequest;
    restrictForward = !!rec.restrictForward;
  }

  // ── Tag screen ────────────────────────────────────────────────────────────────

  function renderTagScreen() {
    var rows = TAGS.map(function(t, i) {
      var isSel     = (selectedTag === t.id);
      var isFocused = (tagFocusIdx === i);
      return '<div class="share-tag-row' + (isFocused ? ' nav-focused' : '') + '" data-idx="' + i + '">' +
        '<span class="share-tag-dot">' + (isSel ? '\u25cf' : '\u25cb') + '</span>' +
        '<span class="share-tag-label">' + esc(t.label) + '</span>' +
        '<span class="share-tag-hint">' + esc(t.hint) + '</span>' +
      '</div>';
    }).join('');

    var urlBlock = '';
    if (currentUrl) {
      var fullUrl = currentUrl.indexOf('workpads.me') !== -1 ? 'https://' + currentUrl : 'https://' + currentUrl;
      var showQr = (selectedTag === '1pb' || dsDisplayType === 3);
      urlBlock =
        '<div class="view-field">' +
          '<div class="view-field-label">Share link</div>' +
          '<div class="share-url" id="share-url-display">' + esc(fullUrl) + '</div>' +
        '</div>' +
        '<div class="share-status" id="share-status" style="display:none;">Copied!</div>' +
        (showQr ? '<div class="share-qr-wrap"><canvas id="share-qr-canvas"></canvas></div>' : '') +
        '<div class="view-field">' +
          '<div class="view-field-label">Length</div>' +
          '<div class="view-field-value">' + currentUrl.length + ' chars</div>' +
        '</div>';
    }

    var presSection     = selectedTag !== '1ps' ? renderPresentationSection() : '';
    var trigSection     = selectedTag !== '1ps' ? renderTrigSection() : '';
    var routingSection  = selectedTag !== '1ps' ? renderRoutingSection() : '';

    var amendNote = amendmentShareNote(currentRecord);
    var ratifiedNote = (currentRecord && currentRecord._ratifiedFrame)
      ? '<div class="share-amend-note">Includes ratified frame</div>' : '';

    el.content.innerHTML =
      '<div class="view-field">' +
        '<div class="view-field-label">Record</div>' +
        '<div class="view-field-value">' + esc(currentRecord.job || '(untitled)') + '</div>' +
      '</div>' +
      amendNote +
      ratifiedNote +
      '<div class="share-tag-section">' + rows + '</div>' +
      urlBlock +
      presSection +
      trigSection +
      routingSection;

    WorkpadsPanel.setContext({ screen: 'share', record: currentRecord, url: currentUrl });

    var qrCanvas = document.getElementById('share-qr-canvas');
    if (qrCanvas && currentUrl && global.WPScriptLoader) {
      var fullUrlForQr = currentUrl.indexOf('workpads.me') !== -1 ? 'https://' + currentUrl : 'https://' + currentUrl;
      WPScriptLoader.ensureQr(function() {
        if (typeof MiniQR === 'undefined') return;
        try { MiniQR.generate(fullUrlForQr, qrCanvas, 200); } catch (e) { /* ignore QR errors */ }
      }).catch(function() { /* QR optional */ });
    }

    wirePresentationSection();
    wireTrigSection();
    wireRoutingSection();
  }

  function renderError(msg) {
    el.content.innerHTML = global.EmptyState
      ? EmptyState.render('Share error', { hint: esc(msg) })
      : '<div class="empty-state">Error:<br>' + esc(msg) + '</div>';
    currentUrl = null;
  }

  // ── Encode current tag ────────────────────────────────────────────────────────

  function selectCurrentTag() {
    var tag = TAGS[tagFocusIdx].id;
    if (tag === '1ps') {
      openPassphraseOverlay();
      return;
    }
    try {
      currentUrl  = encodeWithTag(currentRecord, tag, null);
      selectedTag = tag;
      renderTagScreen();
    } catch (e) {
      renderError(e.message);
    }
  }

  function doCopy() {
    if (!currentUrl) return;
    var fullUrl = currentUrl.indexOf('workpads.me') !== -1 ? 'https://' + currentUrl : 'https://' + currentUrl;
    copyToClipboard(fullUrl).then(function() {
      linkCopied = true;
      showCopied();
    }).catch(function(e) {
      alert('Copy failed: ' + e.message);
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  function onShow(rec) {
    currentRecord    = rec;
    linkCopied       = false;
    currentUrl       = null;
    selectedTag      = '1pa';
    tagFocusIdx      = 0;
    mode             = 'tags';
    presentationOpen = false;
    trigOpen         = false;
    routingOpen      = false;
    dsDisplayType    = 0;
    dsDataSource     = 0;
    dsShowPrice      = false;
    dsShowContact    = false;
    fsSubmitAction   = 0;
    fsRequireName    = false;
    fsRequirePhone   = false;
    fsAllowEdit      = false;
    trigCode         = '';
    ackRequest       = false;
    restrictForward  = false;
    prefillFromRecord(rec);
    try {
      currentUrl = encodeWithTag(rec, '1pa', null);
    } catch (e) { /* show tag screen; URL block absent */ }
    renderTagScreen();
  }

  // ── Key handler ───────────────────────────────────────────────────────────────

  function onKey(key) {
    if (mode === 'passphrase') {
      return handlePassphraseKey(key);
    }
    switch (key) {
      case 'ArrowUp':
        tagFocusIdx = (tagFocusIdx - 1 + TAGS.length) % TAGS.length;
        renderTagScreen();
        break;
      case 'ArrowDown':
        tagFocusIdx = (tagFocusIdx + 1) % TAGS.length;
        renderTagScreen();
        break;
      case 'Enter':
        if (currentUrl) {
          doCopy();
        } else {
          selectCurrentTag();
        }
        break;
      case 'SoftLeft':   // LSK toggles WorkpadsPanel; handled by app.js
        break;
      case 'SoftRight':  // RSK = select tag
        selectCurrentTag();
        break;
      case 'Backspace':
        if (!linkCopied && currentRecord && currentRecord.id && global.RecordService) {
          RecordService.update(currentRecord.id, { tag: 'share_pending' }).then(function(updated) {
            App.showView(updated);
          }).catch(function() {
            App.showView(currentRecord);
          });
        } else {
          if (App.goBack && App.goBack()) break;
          App.showView(currentRecord);
        }
        break;
    }
  }

  function handlePassphraseKey(key) {
    if (key === 'Enter') {
      confirmPassphrase();
    } else if (key === 'Backspace') {
      if (ppBuffer.length > 0) {
        ppBuffer = ppBuffer.slice(0, -1);
        renderPassphraseOverlay();
      } else {
        closePassphraseOverlay();
      }
    } else if (key.length === 1) {
      ppBuffer += key;
      renderPassphraseOverlay();
    }
  }

  global.ShareScreen = {
    onShow: onShow,
    onKey:  onKey,
    getCurrentRecord: function() { return currentRecord; },
  };

}(window));
