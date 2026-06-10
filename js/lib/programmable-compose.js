// programmable-compose.js — edit programmable_rules on send (wizard / share)
// Spec: PROGRAMMABLE-RECORDS-LOCKED.md · lib: programmable-rules.js
(function(global) {
  'use strict';

  var MAX_RULES = 8;
  var PR = function() { return global.WPProgrammableRules; };

  var OP_CHOICES = [
    { op: 'when_confirmed',     label: 'After actions confirmed' },
    { op: 'when_declined',      label: 'If action declined' },
    { op: 'when_paid',          label: 'When payment on chain' },
    { op: 'when_date_before',   label: 'Valid until date' },
    { op: 'when_date_reached',  label: 'Active from date' },
    { op: 'when_ack_received',  label: 'When acknowledgement received' },
  ];

  var SLOT_OPTS = [
    { val: 0, label: 'Any party' },
    { val: 1, label: 'Slot 1' },
    { val: 2, label: 'Slot 2' },
    { val: 3, label: 'Slot 3' },
    { val: 4, label: 'Slot 4' },
  ];

  function cloneRules(rec) {
    var src = (rec && rec.programmable_rules) ? rec.programmable_rules : [];
    var out = [], i, nr;
    for (i = 0; i < src.length; i++) {
      nr = PR() && PR().normaliseRule(src[i]);
      if (nr) out.push(nr);
    }
    return out;
  }

  function Editor(host) {
    this.host = host;
    this.rules = [];
    this.open = false;
    this.formOpen = false;
    this.editIdx = -1;
    this.draftOp = 'when_paid';
    this.draftMask = 1;
    this.draftDate = '';
    this.draftSlot = 0;
    this.onChange = null;
    this.getActions = null;
  }

  Editor.prototype.load = function(rec) {
    this.rules = cloneRules(rec);
    if (this.rules.length) this.open = true;
  };

  Editor.prototype.syncToRecord = function(rec) {
    if (!rec) return;
    if (!this.rules.length) {
      delete rec.programmable_rules;
      delete rec._programmablePlain;
      return;
    }
    var list = [], i, nr;
    for (i = 0; i < this.rules.length; i++) {
      nr = PR().normaliseRule(this.rules[i]);
      if (nr) list.push(nr);
    }
    if (!list.length) {
      delete rec.programmable_rules;
      delete rec._programmablePlain;
      return;
    }
    rec.programmable_rules = list;
    rec._programmablePlain = PR().describeAll(list);
  };

  Editor.prototype._emit = function() {
    if (this.onChange) this.onChange(this.rules);
  };

  Editor.prototype._todayIso = function() {
    return new Date().toISOString().slice(0, 10);
  };

  Editor.prototype._actions = function(rec) {
    if (this.getActions) {
      var a = this.getActions(rec);
      if (a && a.length) return a;
    }
    return (rec && rec.actions) ? rec.actions : [];
  };

  Editor.prototype._maskFromChecks = function(root, prefix) {
    var boxes = root.querySelectorAll('.' + prefix + '-mask-chk');
    var mask = 0, bi;
    for (bi = 0; bi < boxes.length; bi++) {
      if (boxes[bi].checked) {
        mask |= (1 << parseInt(boxes[bi].getAttribute('data-bit'), 10));
      }
    }
    return mask & 0xffff;
  };

  Editor.prototype._renderMaskChecks = function(rec, prefix) {
    var acts = this._actions(rec);
    if (!acts.length) {
      return '<div class="prog-compose-hint">No actions on record — uses bit 1 (0x0001).</div>' +
        '<input class="field-input" id="' + prefix + '-mask-hex" type="text" placeholder="Mask hex e.g. 3" ' +
        'value="' + esc(('0000' + (this.draftMask || 1).toString(16)).slice(-4)) + '" maxlength="4" autocomplete="off">';
    }
    var html = '<div class="prog-compose-hint">Select actions:</div>', i;
    for (i = 0; i < acts.length && i < 16; i++) {
      var on = (this.draftMask & (1 << i)) !== 0;
      html += '<label class="prog-compose-chk">' +
        '<input type="checkbox" class="' + prefix + '-mask-chk" data-bit="' + i + '"' + (on ? ' checked' : '') + '> ' +
        esc(acts[i].title || ('Action ' + (i + 1))) +
        '</label>';
    }
    return html;
  };

  Editor.prototype.renderHtml = function(rec, prefix) {
    var self = this;
    var count = this.rules.length;
    var caret = this.open ? '&#9652;' : '&#9662;';
    var active = count ? ' (' + count + ')' : '';
    var hdr = '<div class="field-more-hdr" id="' + prefix + '-hdr"><span>Obligations' + esc(active) + '</span><span>' + caret + '</span></div>';
    if (!this.open) return hdr;

    var listHtml = '', ri;
    var pr = PR();
    for (ri = 0; ri < this.rules.length; ri++) {
      listHtml += '<div class="wiz-part-row prog-rule-row" data-prog-idx="' + ri + '">' +
        '<span class="wiz-part-name">' + esc(pr ? pr.describeRule(this.rules[ri]) : 'Rule') + '</span>' +
        '<span class="wiz-part-del" data-prog-del="' + ri + '">\u00d7</span>' +
        '</div>';
    }

    var formHtml = '';
    if (this.formOpen) {
      var opOpts = OP_CHOICES.map(function(c) {
        return '<option value="' + c.op + '"' + (c.op === self.draftOp ? ' selected' : '') + '>' + esc(c.label) + '</option>';
      }).join('');
      var slotOpts = SLOT_OPTS.map(function(s) {
        return '<option value="' + s.val + '"' + (s.val === self.draftSlot ? ' selected' : '') + '>' + esc(s.label) + '</option>';
      }).join('');
      var extra = '';
      if (this.draftOp === 'when_confirmed' || this.draftOp === 'when_declined') {
        extra = this._renderMaskChecks(rec, prefix);
      } else if (this.draftOp === 'when_date_before' || this.draftOp === 'when_date_reached') {
        extra = '<input class="field-input" id="' + prefix + '-date" type="date" value="' +
          esc(this.draftDate || this._todayIso()) + '">';
      } else if (this.draftOp === 'when_ack_received') {
        extra = '<select class="field-input" id="' + prefix + '-slot">' + slotOpts + '</select>';
      } else if (this.draftOp === 'when_paid') {
        extra = '<div class="prog-compose-hint">No extra fields.</div>';
      }
      var editLbl = this.editIdx >= 0 ? 'Edit rule' : 'Add rule';
      formHtml =
        '<div class="wiz-part-form prog-compose-form">' +
          '<div class="field-label">' + esc(editLbl) + ' (' + (this.editIdx >= 0 ? (this.editIdx + 1) : (count + 1)) + '/' + MAX_RULES + ')</div>' +
          '<select class="field-input" id="' + prefix + '-op">' + opOpts + '</select>' +
          extra +
          '<div class="wiz-part-form-btns">' +
            '<span class="wiz-part-cancel-btn" id="' + prefix + '-cancel">Cancel</span>' +
            '<span class="wiz-part-save-btn" id="' + prefix + '-save">Save</span>' +
          '</div>' +
        '</div>';
    } else if (count < MAX_RULES) {
      formHtml = '<div class="wiz-part-add-btn" id="' + prefix + '-add">+ Add obligation rule</div>';
    } else {
      formHtml = '<div class="prog-compose-hint">Maximum ' + MAX_RULES + ' rules.</div>';
    }

    return hdr + '<div class="prog-compose-body">' + listHtml + formHtml + '</div>';
  };

  Editor.prototype._readDraft = function(rec, root, prefix) {
    var opSel = root.querySelector('#' + prefix + '-op');
    if (opSel) this.draftOp = opSel.value;
    if (this.draftOp === 'when_confirmed' || this.draftOp === 'when_declined') {
      var hexIn = root.querySelector('#' + prefix + '-mask-hex');
      if (hexIn) {
        var hx = parseInt(hexIn.value.trim(), 16);
        this.draftMask = isNaN(hx) ? 1 : (hx & 0xffff);
      } else {
        this.draftMask = this._maskFromChecks(root, prefix) || 1;
      }
    }
    if (this.draftOp === 'when_date_before' || this.draftOp === 'when_date_reached') {
      var dIn = root.querySelector('#' + prefix + '-date');
      this.draftDate = dIn ? dIn.value : this._todayIso();
    }
    if (this.draftOp === 'when_ack_received') {
      var sIn = root.querySelector('#' + prefix + '-slot');
      this.draftSlot = sIn ? parseInt(sIn.value, 10) : 0;
    }
  };

  Editor.prototype._draftToRule = function() {
    var rule = { op: this.draftOp };
    if (this.draftOp === 'when_confirmed' || this.draftOp === 'when_declined') {
      rule.mask = this.draftMask || 1;
    }
    if (this.draftOp === 'when_date_before' || this.draftOp === 'when_date_reached') {
      rule.date = this.draftDate || this._todayIso();
    }
    if (this.draftOp === 'when_ack_received') {
      rule.party_slot = this.draftSlot;
    }
    return PR().normaliseRule(rule);
  };

  Editor.prototype._openForm = function(idx, rec) {
    this.formOpen = true;
    this.editIdx = idx;
    if (idx >= 0 && this.rules[idx]) {
      var r = this.rules[idx];
      this.draftOp = r.op_name || 'when_paid';
      this.draftMask = r.mask != null ? r.mask : 1;
      this.draftDate = r.date || this._todayIso();
      this.draftSlot = r.party_slot != null ? r.party_slot : 0;
    } else {
      this.draftOp = 'when_paid';
      this.draftMask = 1;
      this.draftDate = this._todayIso();
      this.draftSlot = 0;
    }
  };

  Editor.prototype.wire = function(root, rec, prefix, rerender) {
    var self = this;
    if (!root) return;

    var hdr = root.querySelector('#' + prefix + '-hdr');
    if (hdr) {
      hdr.addEventListener('click', function() {
        self.open = !self.open;
        rerender();
      });
    }

    var rows = root.querySelectorAll('.prog-rule-row[data-prog-idx]');
    for (var ri = 0; ri < rows.length; ri++) {
      (function(row) {
        row.addEventListener('click', function(e) {
          if (e.target && e.target.getAttribute('data-prog-del') != null) return;
          var idx = parseInt(row.getAttribute('data-prog-idx'), 10);
          self._openForm(idx, rec);
          rerender();
        });
      })(rows[ri]);
    }

    var dels = root.querySelectorAll('[data-prog-del]');
    for (var di = 0; di < dels.length; di++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var idx = parseInt(btn.getAttribute('data-prog-del'), 10);
          if (confirm('Remove this obligation rule?')) {
            self.rules.splice(idx, 1);
            self.formOpen = false;
            self.editIdx = -1;
            self._emit();
            rerender();
          }
        });
      })(dels[di]);
    }

    var addBtn = root.querySelector('#' + prefix + '-add');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        self._openForm(-1, rec);
        rerender();
      });
    }

    var cancelBtn = root.querySelector('#' + prefix + '-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        self.formOpen = false;
        self.editIdx = -1;
        rerender();
      });
    }

    var saveBtn = root.querySelector('#' + prefix + '-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        self._readDraft(rec, root, prefix);
        var nr = self._draftToRule();
        if (!nr) { alert('Invalid rule.'); return; }
        if (self.editIdx >= 0) self.rules[self.editIdx] = nr;
        else self.rules.push(nr);
        self.formOpen = false;
        self.editIdx = -1;
        self._emit();
        rerender();
      });
    }

    var opSel = root.querySelector('#' + prefix + '-op');
    if (opSel) {
      opSel.addEventListener('change', function() {
        self.draftOp = opSel.value;
        rerender();
      });
    }
  };

  var editors = {};

  function getEditor(host) {
    if (!editors[host]) editors[host] = new Editor(host);
    return editors[host];
  }

  global.WPProgrammableCompose = {
    OP_CHOICES: OP_CHOICES,
    getEditor: getEditor,
    cloneRules: cloneRules
  };

}(typeof window !== 'undefined' ? window : global));
