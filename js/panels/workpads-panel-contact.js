// WorkpadsPanelContact — WorkpadsPanel split module
(function(global) {
  'use strict';

  var LIAB_TYPES = { payable: true, receivable: true, loan: true };
  var CP_ROLE_CHIPS = [
    { val: 1, label: 'Worker' }, { val: 0, label: 'Customer' },
    { val: 2, label: 'Vendor' }, { val: 4, label: 'Contractor' },
  ];
  var CP_CHIP_VALS = { 1: true, 0: true, 2: true, 4: true };

  function install(S) {
  // The 4 standard role filter chips always shown in the contact panel
  var CP_ROLE_CHIPS = [
    { val: 1, label: 'Worker'     },
    { val: 0, label: 'Customer'   },
    { val: 2, label: 'Vendor'     },
    { val: 4, label: 'Contractor' },
  ];
  var CP_CHIP_VALS = { 1: true, 0: true, 2: true, 4: true };

  var cpRolesExpanded = false;  // extra-roles dropdown visible

  function createFromContactPanel(kind, contactRec) {
    S.close();
    if (kind === 'payable' || kind === 'receivable' || kind === 'loan') {
      App.showLiabilities({
        type:          kind,
        linkedContact: contactRec,
        returnTo:      'list',
      });
    } else {
      var typeMap = { 'out': 'expense', 'cogs': 'cogs', 'in': 'payment' };
      App.showLedger({
        type:          typeMap[kind] || 'expense',
        linkedContact: contactRec,
        linkMode:      'none',
      });
    }
  }

  function renderContactPanel(contactRec) {
    var contactName = (contactRec.job || contactRec.name || '').trim();
    var CAT_MAP = {
      0:'Customer',1:'Client',2:'Vendor',3:'Supplier',4:'Contractor',5:'Sub-contractor',
      6:'Partner',7:'Employee',8:'Agent',9:'Accountant',10:'Bank / Lender',11:'Insurer',
      12:'Landlord',13:'Government',14:'Utility',15:'Referral',16:'Prospect',17:'General',
    };
    var catLabel;
    if (Array.isArray(contactRec.roles) && contactRec.roles.length) {
      catLabel = contactRec.roles.map(function(rv) { return CAT_MAP[rv] || ''; }).filter(Boolean).join(' · ');
    } else {
      var catNum = contactRec.category != null ? contactRec.category : null;
      catLabel = catNum != null ? (CAT_MAP[catNum] || '') : '';
    }

    // Build role chip bar: 4 standard + optional extras dropdown
    var contactRoles = Array.isArray(contactRec.roles) && contactRec.roles.length
      ? contactRec.roles
      : (contactRec.category != null ? [contactRec.category] : []);
    var extraRoles = contactRoles.filter(function(rv) { return !CP_CHIP_VALS[rv]; });

    var roleFilterHtml = CP_ROLE_CHIPS.map(function(chip) {
      var active = chip.val === S.contactPanelRoleFilter;
      return '<span class="cp-role-btn' + (active ? ' active' : '') + '" data-cp-role="' + chip.val + '">' + esc(chip.label) + '</span>';
    }).join('');

    if (extraRoles.length) {
      var extraOpen = cpRolesExpanded;
      roleFilterHtml += '<span class="cp-role-btn cp-role-more' + (extraOpen ? ' active' : '') + '" id="cp-more-roles">' +
        (extraOpen ? '\u25b4' : '\u25be') + '</span>';
      if (extraOpen) {
        roleFilterHtml += extraRoles.map(function(rv) {
          var lbl = CAT_MAP[rv] || String(rv);
          var active = rv === S.contactPanelRoleFilter;
          return '<span class="cp-role-btn' + (active ? ' active' : '') + '" data-cp-role="' + rv + '">' + esc(lbl) + '</span>';
        }).join('');
      }
    }

    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    S.el.content.innerHTML =
      '<div class="pb-controls" id="pb-controls">' +
        '<div class="cp-hdr">' +
          '<span class="cp-name">' + esc(contactName || 'Contact') + '</span>' +
          '<span class="cp-hdr-btn" id="cp-btn-open">Open</span>' +
          '<span class="cp-hdr-btn" id="cp-btn-edit">Edit</span>' +
        '</div>' +
        '<div class="pb-qc-row">' +
          '<div class="pb-qc pb-qc-exp"  data-cpqc="out">Exp</div>' +
          '<div class="pb-qc pb-qc-cogs" data-cpqc="cogs">COGS</div>' +
          '<div class="pb-qc pb-qc-inc"  data-cpqc="in">Inc</div>' +
        '</div>' +
        '<div class="pb-qc-row pb-qc-row2">' +
          '<div class="pb-qc pb-qc-payable"    data-cpqc="payable">Payable</div>' +
          '<div class="pb-qc pb-qc-loan"       data-cpqc="loan">Loan</div>' +
          '<div class="pb-qc pb-qc-receivable" data-cpqc="receivable">Receivable</div>' +
        '</div>' +
        '<div class="cp-role-bar" id="cp-role-bar">' + roleFilterHtml + '</div>' +
      '</div>' +
      '<div class="pb-contact-records" id="pb-contact-records">' +
        '<div style="padding:8px;font-size:10px;color:var(--text-muted);">Loading\u2026</div>' +
      '</div>';

    var qcEls = S.el.content.querySelectorAll('[data-cpqc]');
    for (var qi = 0; qi < qcEls.length; qi++) {
      qcEls[qi].addEventListener('click', (function(kind) {
        return function() { S.createFromContactPanel(kind, contactRec); };
      })(qcEls[qi].getAttribute('data-cpqc')));
    }

    var openBtn = document.getElementById('cp-btn-open');
    var editBtn = document.getElementById('cp-btn-edit');
    if (openBtn) openBtn.addEventListener('click', function() { S.close(); App.showView(contactRec); });
    if (editBtn) editBtn.addEventListener('click', function() { S.close(); App.showWizard(contactRec); });

    var moreBtn = document.getElementById('cp-more-roles');
    if (moreBtn) {
      moreBtn.addEventListener('click', function() {
        cpRolesExpanded = !cpRolesExpanded;
        S.renderContactPanel(contactRec);
      });
    }

    var roleBtns = S.el.content.querySelectorAll('[data-cp-role]');
    for (var ri2 = 0; ri2 < roleBtns.length; ri2++) {
      roleBtns[ri2].addEventListener('click', (function(btn) {
        return function() {
          var v = parseInt(btn.getAttribute('data-cp-role'), 10);
          // Toggle: clicking the active chip clears the filter (back to All)
          S.contactPanelRoleFilter = (S.contactPanelRoleFilter === v) ? null : v;
          S.renderContactPanel(contactRec);
        };
      })(roleBtns[ri2]));
    }

    if (!contactName) return;

    RecordService.list().then(function(records) {
      var nameLower = contactName.toLowerCase();
      var contactId = contactRec.id;
      var roleF = S.contactPanelRoleFilter;

      // Match records by linkedContactId (reliable) OR by name (legacy fallback)
      var related = records.filter(function(r) {
        if (!r || r.id === contactRec.id) return false;
        var byId = contactId && r.linkedContactId === contactId;
        var asCustomer = byId || (r.customer || '').toLowerCase() === nameLower;
        var asParticipant = false;
        var partRole = null;
        if (Array.isArray(r.participants)) {
          for (var pi = 0; pi < r.participants.length; pi++) {
            var p = r.participants[pi];
            if (p && (p.name || '').toLowerCase() === nameLower) {
              asParticipant = true;
              partRole = typeof p.role === 'number' ? p.role : null;
              break;
            }
          }
        }
        if (!asCustomer && !asParticipant) return false;
        if (roleF === null) return true;
        if (roleF === 0) return asCustomer || partRole === 0;
        if (asParticipant && partRole === roleF) return true;
        return false;
      });

      related.sort(function(a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); });

      // Financial aggregates — per currency
      var expByc = {}, incByc = {}, payableByc = {}, payableOpenByc = {},
          receivableByc = {}, receivableOpenByc = {};
      related.forEach(function(r) {
        var rt  = (r.record_type || r.recordType || '').toLowerCase();
        var cur = (r.currency || 'unknown').toUpperCase();
        var amt = parseFloat(r.amount || 0);
        if (rt === 'expense' || rt === 'cogs') CurrencyUtil.addFlat(expByc, cur, amt);
        else if (rt === 'payment') CurrencyUtil.addFlat(incByc, cur, amt);
        else if (rt === 'payable') {
          CurrencyUtil.addFlat(payableByc, cur, amt);
          if (!r.paidAt) CurrencyUtil.addFlat(payableOpenByc, cur, amt);
        }
        else if (rt === 'receivable') {
          CurrencyUtil.addFlat(receivableByc, cur, amt);
          if (!r.paidAt) CurrencyUtil.addFlat(receivableOpenByc, cur, amt);
        }
        else if (!rt || rt === 'job' || rt === 'quote' || rt === 'invoice' || rt === 'receipt') {
          CurrencyUtil.addFlat(incByc, cur, amt);
        }
      });

      var listEl = document.getElementById('pb-contact-records');
      if (!listEl) return;

      function nonZero(byc) { return Object.keys(byc).some(function(c) { return byc[c]; }); }
      function notSame(a, b) {
        return Object.keys(a).some(function(c) { return a[c] !== (b[c] || 0); }) ||
               Object.keys(b).some(function(c) { return b[c] !== (a[c] || 0); });
      }

      function tallyRow(label, byc, rtFilter, alertCls) {
        if (!nonZero(byc)) return '';
        var cls = 'cp-sum-row cp-tally-nav' + (alertCls ? ' cp-sum-alert' : '');
        return '<div class="' + cls + '" data-ct-rt="' + (rtFilter || '') + '">' +
          '<span class="cp-sum-lbl">' + esc(label) + '</span>' +
          '<span class="cp-sum-val">' + esc(CurrencyUtil.fmtFlat(byc)) + '</span>' +
          '<span class="cp-sum-arr">\u203a</span>' +
        '</div>';
      }

      var summaryHtml = '';
      if (related.length) {
        summaryHtml =
          '<div class="cp-summary">' +
            tallyRow('Exp',          expByc,             'expense') +
            tallyRow('Inc',          incByc,             'payment') +
            tallyRow('Owed (open)',  payableOpenByc,     'payable',    true) +
            (nonZero(payableByc) && notSame(payableByc, payableOpenByc)
              ? tallyRow('Payable', payableByc, 'payable') : '') +
            tallyRow('Recv (open)',  receivableOpenByc,  'receivable', true) +
            (nonZero(receivableByc) && notSame(receivableByc, receivableOpenByc)
              ? tallyRow('Receivable', receivableByc, 'receivable') : '') +
          '</div>';
      }

      var TYPE_LABELS2 = { quote:'Quote', invoice:'Invoice', receipt:'Receipt', pads:'Basic', newent:'Business', contact:'Contact', expense:'Exp', cogs:'COGS', payment:'Inc', payable:'Paybl', receivable:'Recv', loan:'Loan' };
      var listHtml = related.length
        ? related.map(function(r) {
            var rt = r.record_type || r.recordType || '';
            var badge = TYPE_LABELS2[rt] || (rt ? rt.slice(0,3).toUpperCase() : 'JOB');
            return '<div class="cp-rec-row" data-rel-id="' + esc(r.id) + '">' +
              '<span class="cp-rec-badge">' + esc(badge) + '</span>' +
              '<span class="cp-rec-title">' + esc(r.job || r.description || 'Untitled') + '</span>' +
              (r.amount ? '<span class="cp-rec-amt">' + esc(CurrencyUtil.fmt(r.amount, r.currency)) + '</span>' : '') +
            '</div>';
          }).join('')
        : '<div style="padding:8px 10px;font-size:10px;color:var(--text-muted);">No records' + (roleF !== null ? ' for this role' : '') + '.</div>';

      listEl.innerHTML = summaryHtml + listHtml;

      // Tally row navigation → filtered main list
      var tallyEls = listEl.querySelectorAll('.cp-tally-nav');
      for (var ti = 0; ti < tallyEls.length; ti++) {
        tallyEls[ti].addEventListener('click', (function(row) {
          return function() {
            var rt = row.getAttribute('data-ct-rt') || null;
            if (typeof ListScreen !== 'undefined' && typeof App !== 'undefined') {
              S.close();
              ListScreen.setContactFilter(contactRec, rt);
              App.showList();
            }
          };
        })(tallyEls[ti]));
      }

      var rowEls = listEl.querySelectorAll('[data-rel-id]');
      for (var ri3 = 0; ri3 < rowEls.length; ri3++) {
        rowEls[ri3].addEventListener('click', (function(id) {
          return function() {
            RecordService.get(id).then(function(r) { if (r) { S.close(); App.showView(r); } });
          };
        })(rowEls[ri3].getAttribute('data-rel-id')));
      }
    });
  }
    S.createFromContactPanel = createFromContactPanel;
    S.renderContactPanel = renderContactPanel;
  }

  global.WorkpadsPanelContact = { install: install };
}(window));
