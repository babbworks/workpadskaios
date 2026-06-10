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
  var selectedTag      = '1pv';   // '1pv' | '1pa' | '1pb' | '1dt' | '1ps'
  var tagFocusIdx      = 0;
  var linkCopied       = false;
  var mode             = 'tags';  // 'tags' | 'passphrase'
  var ppBuffer         = '';

  // Presentation state
  var presentationOpen = false;
  var trigOpen         = false;
  var routingOpen      = false;
  var templateQrOpen   = false;
  var gatekeeperOpen   = false;
  var gatekeeperType   = 'light_ack';

  function shareProgEditor() {
    return (global.WPProgrammableCompose && WPProgrammableCompose.getEditor)
      ? WPProgrammableCompose.getEditor('share') : null;
  }

  function syncShareProgToRecord() {
    var ed = shareProgEditor();
    if (ed && currentRecord) ed.syncToRecord(currentRecord);
  }
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
  var nfcScenario      = null;
  var encodeError      = null;

  var DS_DISPLAY_OPTS = ['Standard', 'Billboard', 'Form', 'Form+QR'];
  var DS_SOURCE_OPTS  = ['Full', 'Public', 'Summary', 'Anon'];
  var FS_SUBMIT_OPTS  = ['Reply', 'Book', 'Pay', 'Enquire'];

  function ensureContentEl() {
    var node = document.getElementById('share-content');
    if (node) el.content = node;
    return el.content;
  }

  function normalizeShareRecord(rec) {
    if (!rec) return null;
    if (rec.job && String(rec.job).trim()) return rec;
    var out = global.merge ? merge({}, rec) : (function() {
      var c = {}, k;
      for (k in rec) { if (Object.prototype.hasOwnProperty.call(rec, k)) c[k] = rec[k]; }
      return c;
    })();
    out.job = String(
      rec.description || rec.customer || rec.vendor || rec.record_type || 'Record'
    ).trim().slice(0, 120) || '(untitled)';
    return out;
  }

  function updateShareChrome() {
    var crumb = document.querySelector('#screen-share .sc-label');
    if (crumb && currentRecord) {
      crumb.textContent = 'Share · ' + (currentRecord.job || '(untitled)').slice(0, 22);
    }
    var csk = document.querySelector('#screen-share .sk-csk');
    var rsk = document.querySelector('#screen-share .sk-rsk');
    if (csk) csk.textContent = currentUrl ? 'Copy' : 'Select';
    if (rsk) rsk.textContent = 'Select';
  }

  var TAGS = [
    { id: '1pa', label: 'Plain',     hint: 'pads-v1 — legacy compatible' },
    { id: '1pv', label: 'v2 Path C', hint: 'pads-v2 native groups + CRC — default' },
    { id: '1dt', label: 'Template',  hint: 'Template / billboard QR (#1dt/)' },
    { id: '1pb', label: 'Public',    hint: 'Broadcast presentation (#1pb/)' },
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

  function activeNfcScenario() {
    if (!global.WPNfcHandoff) return null;
    if (nfcScenario) return nfcScenario;
    if (selectedTag === '1pb') return WPNfcHandoff.SCENARIOS.POS_CONFIRM;
    if (currentRecord) return WPNfcHandoff.scenarioForRecord(currentRecord);
    return WPNfcHandoff.SCENARIOS.INVOICE_HANDOFF;
  }

  function nfcBlock() {
    if (!currentUrl || !global.WPNfcHandoff || !WPNfcHandoff.isAvailable()) return '';
    var scenario = activeNfcScenario();
    var label = WPNfcHandoff.scenarioLabel(scenario);
    var plat = WPNfcHandoff.platformId ? WPNfcHandoff.platformId() : '';
    var hold = plat === 'kaios-moz'
      ? ' — hold phones together, press <strong>2</strong>'
      : ' — press <strong>2</strong>';
    return '<div class="share-nfc-hint" id="share-nfc-hint">' + esc(label) + hold + '</div>';
  }

  function tryNfcShare() {
    if (!currentUrl || !global.WPNfcHandoff || !WPNfcHandoff.isAvailable()) return;
    var payload = WPNfcHandoff.fullUrl(currentUrl);
    var scenario = activeNfcScenario();
    var hint = document.getElementById('share-nfc-hint');
    if (hint) {
      hint.textContent = (WPNfcHandoff.platformId() === 'kaios-moz')
        ? 'Hold near other phone…'
        : 'Sending…';
    }
    WPNfcHandoff.writeUrl(payload, { scenario: scenario }, function() {
      if (hint) hint.textContent = 'Sent via NFC';
    }, function(err) {
      if (hint) hint.textContent = err.message || 'NFC failed';
    });
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

  function applyTemplateQrTagDefaults(tag) {
    if (tag !== '1dt' || !global.WPTemplateQr) return;
    dsDisplayType = WPTemplateQr.minDisplayTypeForTag(tag, dsDisplayType);
    if (currentRecord) currentRecord.is_template = true;
    templateQrOpen = true;
  }

  function persistShareMeta() {
    if (!currentRecord || !currentRecord.id || typeof RecordService === 'undefined') {
      return Promise.resolve();
    }
    var pOpts = buildPresentationOpts();
    currentRecord.displaySchema = pOpts.displaySchema;
    if (pOpts.formSchema) currentRecord.formSchema = pOpts.formSchema;
    else delete currentRecord.formSchema;
    if (selectedTag === '1dt') currentRecord.is_template = true;
    return RecordService.update(currentRecord.id, currentRecord).catch(function() {});
  }

  function encodeWithTag(rec, tag, passphrase) {
    syncShareProgToRecord();
    syncGatekeeperToRecord();
    applyTemplateQrTagDefaults(tag);
    var validation = WPCodec.validate(rec);
    if (!validation.valid) throw new Error('Cannot share: ' + validation.errors.join(', '));
    var opts = { tag: tag, passphrase: passphrase };
    if (tag === '1dt' || tag === '1pb') {
      var pOpts = buildPresentationOpts();
      if (tag === '1dt') {
        pOpts.displaySchema.displayType = WPTemplateQr.minDisplayTypeForTag('1dt', pOpts.displaySchema.displayType);
        dsDisplayType = pOpts.displaySchema.displayType;
      }
      opts.displaySchema = pOpts.displaySchema;
      if (pOpts.formSchema) opts.formSchema = pOpts.formSchema;
    } else if (tag !== '1ps' && hasPresentationSet()) {
      var pOpts2 = buildPresentationOpts();
      opts.displaySchema = pOpts2.displaySchema;
      if (pOpts2.formSchema) opts.formSchema = pOpts2.formSchema;
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

  function renderObligationsSection() {
    var ed = shareProgEditor();
    if (!ed) return '';
    ed.load(currentRecord);
    return '<div id="share-prog-root">' + ed.renderHtml(currentRecord, 'share-prog') + '</div>';
  }

  function wireObligationsSection() {
    var root = document.getElementById('share-prog-root');
    var ed = shareProgEditor();
    if (!root || !ed) return;
    ed.getActions = function(rec) { return (rec && rec.actions) ? rec.actions : []; };
    ed.onChange = function() {
      syncShareProgToRecord();
      reEncodeAndRender();
    };
    ed.wire(root, currentRecord, 'share-prog', function() {
      syncShareProgToRecord();
      renderTagScreen();
    });
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
        persistShareMeta().then(function() { renderTagScreen(); });
      } catch (e) {
        encodeError = e.message || String(e);
        currentUrl = null;
        renderTagScreen();
      }
    }, 120);
  }

  function renderTemplateQrSection() {
    if (selectedTag !== '1dt' || !global.WPTemplateQr) return '';
    var caret = templateQrOpen ? '&#9652;' : '&#9662;';
    var hdr = '<div class="field-more-hdr" id="share-tplqr-hdr"><span>Template QR</span><span>' + caret + '</span></div>';
    if (!templateQrOpen) return hdr;
    var preview = WPTemplateQr.renderPreviewHtml(currentRecord, dsDisplayType);
    function presetRow(dt, label) {
      var on = dsDisplayType === dt ? ' share-tpl-preset-on' : '';
      return '<div class="share-tpl-preset' + on + '" data-tpl-preset="' + dt + '">' + esc(label) + '</div>';
    }
    return hdr +
      '<div class="share-tplqr-body">' +
        '<div class="share-tplqr-hint">Production lane <code>#1dt/</code> — billboard or form for scan. Recipients can save as My Template.</div>' +
        preview +
        '<div class="share-tpl-presets">' +
          presetRow(1, 'Billboard') +
          presetRow(2, 'Form') +
          presetRow(3, 'Form + QR') +
        '</div>' +
      '</div>';
  }

  function wireTemplateQrSection() {
    var hdr = document.getElementById('share-tplqr-hdr');
    if (hdr) {
      hdr.addEventListener('click', function() {
        templateQrOpen = !templateQrOpen;
        renderTagScreen();
      });
    }
    var presets = el.content.querySelectorAll('.share-tpl-preset[data-tpl-preset]');
    for (var pi = 0; pi < presets.length; pi++) {
      (function(row) {
        row.addEventListener('click', function() {
          dsDisplayType = parseInt(row.getAttribute('data-tpl-preset'), 10) || 1;
          presentationOpen = true;
          reEncodeAndRender();
        });
      })(presets[pi]);
    }
  }

  function templateQrShareNote() {
    if (selectedTag !== '1dt') return '';
    var lbl = global.WPTemplateQr ? WPTemplateQr.displayLabel({ displayType: dsDisplayType }) : 'Template';
    return '<div class="share-amend-note">Template QR <code>#1dt/</code> · ' + esc(lbl) +
      ' — QR shown below when link is ready.</div>';
  }

  function actionListShareNote(rec) {
    if (!rec || !global.WPChainExecution) return '';
    if (WPChainExecution.isConnectionLightAckShare(rec)) {
      return '<div class="share-amend-note">Connection share — light ack (no per-action list).</div>';
    }
    if (WPChainExecution.shouldEmitActionListOnShare(rec)) {
      var n = (rec.actions && rec.actions.length) ? rec.actions.length : 0;
      var extra = n ? (' (' + n + ' action' + (n === 1 ? '' : 's') + ')') : '';
      return '<div class="share-amend-note">Action confirmation requested on receive' + esc(extra) + '.</div>';
    }
    return '';
  }

  function applyShareDefaults(rec) {
    prefillFromRecord(rec);
    if (global.WPChainExecution && WPChainExecution.isConnectionLightAckShare(rec)) {
      ackRequest = false;
    } else if (global.WPChainExecution && WPChainExecution.shouldDefaultAckRequest(rec)) {
      ackRequest = true;
    }
  }

  function syncGatekeeperToRecord() {
    if (!currentRecord || !global.WPNocGatekeeper || !WPNocGatekeeper.isConnection(currentRecord)) return;
    WPNocGatekeeper.applyPolicyToRecord(currentRecord, gatekeeperType);
  }

  function renderGatekeeperSection() {
    if (!currentRecord || !global.WPNocGatekeeper || !WPNocGatekeeper.isConnection(currentRecord)) {
      return '';
    }
    if (selectedTag === '1ps') return '';
    var caret = gatekeeperOpen ? '&#9652;' : '&#9662;';
    var hdr = '<div class="field-more-hdr" id="share-gk-hdr"><span>Gatekeeper (NOC)</span><span>' + caret + '</span></div>';
    if (!gatekeeperOpen) return hdr;
    var opts = WPNocGatekeeper.GATE_TYPES;
    var keys = Object.keys(opts);
    var body = '', ki;
    for (ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      var on = gatekeeperType === k ? ' share-gk-opt-on' : '';
      body += '<div class="share-gk-opt' + on + '" data-gk-type="' + esc(k) + '">' +
        esc(opts[k].label) + '</div>';
    }
    body += '<div class="share-gk-hint">' + esc(WPNocGatekeeper.policyHint(gatekeeperType)) + '</div>';
    return hdr + '<div class="share-gk-body">' + body + '</div>';
  }

  function wireGatekeeperSection() {
    var hdr = document.getElementById('share-gk-hdr');
    if (hdr) {
      hdr.addEventListener('click', function() {
        gatekeeperOpen = !gatekeeperOpen;
        renderTagScreen();
      });
    }
    var types = el.content.querySelectorAll('[data-gk-type]');
    var ti;
    for (ti = 0; ti < types.length; ti++) {
      types[ti].addEventListener('click', (function(row) {
        return function() {
          gatekeeperType = row.getAttribute('data-gk-type');
          syncGatekeeperToRecord();
          reEncodeAndRender();
        };
      })(types[ti]));
    }
  }

  function amendmentShareNote(rec) {
    if (!rec || typeof RecordService === 'undefined' || !RecordService.isAmendmentShare) return '';
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
    if (global.WPNocGatekeeper && WPNocGatekeeper.isConnection(rec)) {
      gatekeeperType = WPNocGatekeeper.getGateType(rec);
      if (rec.informational_ack) ackRequest = false;
    }
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
    if (!ensureContentEl()) return;

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
      var showQr = (selectedTag === '1pb' || selectedTag === '1dt' || dsDisplayType === 3);
      urlBlock =
        '<div class="view-field">' +
          '<div class="view-field-label">Share link</div>' +
          '<div class="share-url" id="share-url-display">' + esc(fullUrl) + '</div>' +
        '</div>' +
        '<div class="share-status" id="share-status" style="display:none;">Copied!</div>' +
        nfcBlock() +
        (showQr ? '<div class="share-qr-wrap"><canvas id="share-qr-canvas"></canvas></div>' : '') +
        '<div class="view-field">' +
          '<div class="view-field-label">Length</div>' +
          '<div class="view-field-value">' + currentUrl.length + ' chars</div>' +
        '</div>';
    }

    var presSection     = selectedTag !== '1ps' ? renderPresentationSection() : '';
    var trigSection     = selectedTag !== '1ps' ? renderTrigSection() : '';
    var routingSection  = selectedTag !== '1ps' ? renderRoutingSection() : '';
    var obligSection    = selectedTag !== '1ps' ? renderObligationsSection() : '';
    var tplQrSection    = selectedTag === '1dt' ? renderTemplateQrSection() : '';
    var relSection      = (global.WPRelationalUi && WPRelationalUi.renderShareSection)
      ? WPRelationalUi.renderShareSection(currentRecord, selectedTag) : '';
    var gkSection       = renderGatekeeperSection();

    var amendNote = amendmentShareNote(currentRecord);
    var gkNote    = (global.WPNocGatekeeper && WPNocGatekeeper.shareNoteHtml)
      ? WPNocGatekeeper.shareNoteHtml(currentRecord) : '';
    var tplNote   = templateQrShareNote();
    var actionNote = actionListShareNote(currentRecord);
    var ratifiedNote = (currentRecord && currentRecord._ratifiedFrame)
      ? '<div class="share-amend-note">Includes ratified frame</div>' : '';
    var balanceWarn = '';
    if (currentRecord && global.WPChainExecution) {
      RecordService.list().then(function(all) {
        var msg = WPChainExecution.conservationBalanceWarning(currentRecord, all);
        var el2 = document.getElementById('share-balance-warn');
        if (el2) {
          el2.style.display = msg ? 'block' : 'none';
          el2.textContent = msg || '';
        }
      });
      balanceWarn = '<div class="share-balance-warn" id="share-balance-warn" style="display:none"></div>';
    }

    var cardPreview = (global.GlyphCard && GlyphCard.renderSharePreview)
      ? GlyphCard.renderSharePreview(currentRecord) : '';

    var errBanner = encodeError
      ? '<div class="share-encode-err">' + esc(encodeError) + '</div>' : '';

    var rtLbl = (currentRecord.record_type || '').toUpperCase();
    var metaLine = [
      currentRecord.customer || currentRecord.worker || '',
      currentRecord.date || '',
      rtLbl,
    ].filter(Boolean).join(' · ');

    var keyHints = '<div class="share-key-hints">' +
      (currentUrl ? 'Enter = copy · 2 = NFC · ' : 'RSK = encode tag · ') +
      'Up/Down = tag · Back = record</div>';

    try {
    el.content.innerHTML =
      '<div class="share-hero">' +
        '<div class="share-hero-title">' + esc(currentRecord.job || '(untitled)') + '</div>' +
        (metaLine ? '<div class="share-hero-meta">' + esc(metaLine) + '</div>' : '') +
      '</div>' +
      errBanner +
      cardPreview +
      amendNote +
      gkNote +
      tplNote +
      actionNote +
      ratifiedNote +
      balanceWarn +
      '<div class="share-tag-section">' + rows + '</div>' +
      urlBlock +
      presSection +
      trigSection +
      routingSection +
      obligSection +
      tplQrSection +
      relSection +
      gkSection +
      keyHints;

    } catch (renderErr) {
      renderError(renderErr.message || String(renderErr));
      return;
    }

    updateShareChrome();
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
    wireObligationsSection();
    wireTemplateQrSection();
    wireGatekeeperSection();
    if (global.WPRelationalUi && WPRelationalUi.wireShareSection) {
      WPRelationalUi.wireShareSection(el.content, currentRecord, function(o) {
        if (global.App && App.showSymbols) {
          App.showSymbols({
            peerKey: o.peerKey,
            record: currentRecord,
            returnTo: 'share',
          });
        }
      });
    }
  }

  function renderError(msg) {
    if (!ensureContentEl()) return;
    el.content.innerHTML = global.EmptyState
      ? EmptyState.render('Share error', { hint: esc(msg) })
      : '<div class="empty-state">Error:<br>' + esc(msg) + '</div>' +
        '<div class="share-key-hints">Back = return to record</div>';
    currentUrl = null;
    encodeError = msg;
    updateShareChrome();
  }

  // ── Encode current tag ────────────────────────────────────────────────────────

  function selectCurrentTag() {
    var tag = TAGS[tagFocusIdx].id;
    if (tag === '1ps') {
      openPassphraseOverlay();
      return;
    }
    try {
      selectedTag = tag;
      applyTemplateQrTagDefaults(tag);
      currentUrl  = encodeWithTag(currentRecord, tag, null);
      persistShareMeta().then(function() { renderTagScreen(); });
    } catch (e) {
      encodeError = e.message || String(e);
      currentUrl = null;
      renderTagScreen();
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

  function onShow(rec, opts) {
    opts = opts || {};
    if (!ensureContentEl()) return;

    if (rec && rec.id && global.RecordService && RecordService.get &&
        (!rec.job || !String(rec.job).trim())) {
      RecordService.get(rec.id).then(function(full) {
        if (full) onShow(full, opts);
        else renderError('Record not found');
      }).catch(function() { renderError('Could not load record'); });
      return;
    }

    nfcScenario      = opts.nfcScenario || null;
    currentRecord    = normalizeShareRecord(rec);
    if (!currentRecord) {
      renderError('No record to share');
      return;
    }
    linkCopied       = false;
    currentUrl       = null;
    encodeError      = null;
    selectedTag      = (global.WPTemplateQr && WPTemplateQr.defaultShareTag)
      ? WPTemplateQr.defaultShareTag(currentRecord) : '1pv';
    tagFocusIdx      = 0;
    var ti;
    for (ti = 0; ti < TAGS.length; ti++) {
      if (TAGS[ti].id === selectedTag) { tagFocusIdx = ti; break; }
    }
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
    applyShareDefaults(currentRecord);
    if (selectedTag === '1dt') {
      applyTemplateQrTagDefaults('1dt');
      presentationOpen = true;
    }
    var progEd = shareProgEditor();
    if (progEd) progEd.load(currentRecord);
    try {
      currentUrl = encodeWithTag(currentRecord, selectedTag, null);
    } catch (e) {
      encodeError = e.message || String(e);
      currentUrl = null;
    }
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
      case '2':
        if (currentUrl) tryNfcShare();
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
