// demo.js — seed data for browser testing
// Loaded ONLY in development. Do not include in production KaiOS build.
// Console: Demo.reset() to wipe all wp_* data and re-seed two showcase records.
//
// Writes directly to localStorage using a fixed activity ID so RecordService
// finds records immediately after reload — no async/migration timing issues.

(function(global) {
  'use strict';

  var SEED_KEY    = 'wp_demo_seeded_v10';
  var DEMO_ACT_ID = 'act_demo_v1';

  function merge(a, b) {
    var out = {};
    var k;
    for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k]; }
    for (k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k]; }
    return out;
  }

  /** Remove every Workpads local key (records, profile, notes, blocks, sale, symbols, prefs). */
  function clearAll() {
    var toRemove = [];
    var i, k;
    for (i = 0; i < localStorage.length; i++) {
      k = localStorage.key(i);
      if (!k) continue;
      if (k.indexOf('wp_') === 0 ||
          k.indexOf('wp_record_') === 0 ||
          k.indexOf('wp_archive_') === 0) {
        toRemove.push(k);
      }
    }
    for (i = 0; i < toRemove.length; i++) {
      localStorage.removeItem(toRemove[i]);
    }
  }

  function seed() {
    var now = Date.now();
    function dago(n) { return new Date(now - n * 86400000).toISOString().slice(0, 10); }
    var d0 = dago(0);
    var d2 = dago(2);
    var d5 = dago(5);
    var d8 = dago(8);

    var WACT_ID = 'wact_demo_studio';
    var CHAIN   = 'chain_demo_studio';

    // ── Demo activity profile (fixed ID — not your personal profile) ───────────
    localStorage.setItem('wp_activity_' + DEMO_ACT_ID, JSON.stringify({
      id:            DEMO_ACT_ID,
      name:          'Workpads Demo',
      phone:         '+44 7700 900000',
      type:          'freelance',
      locale:        'gb-v1',
      currency:      'GBP',
      tax_label:     'VAT',
      tax_rate:      '20',
      template_pack: 'gb',
      isBusiness:    true,
      vatRegistered: true,
      vatNumber:     'GB 000 0000 00',
      color:         '#4a9eff',
    }));
    localStorage.setItem('wp_activity_active', DEMO_ACT_ID);

    // ── Work activity bucket (Manage → Activities) ───────────────────────────
    localStorage.setItem('wp_wact_' + WACT_ID, JSON.stringify({
      id:        WACT_ID,
      name:      'Riverside Studio — electrical',
      type:      'own',
      setting:   'field',
      color:     '#50c878',
      createdAt: now,
      updatedAt: now,
    }));

    var pfx = 'wp_rec_' + DEMO_ACT_ID + '_';

    function put(rec) {
      var full = merge({
        chainRef:   rec.chainRef || rec.id,
        worker:     'Workpads Demo',
        currency:   'GBP',
        activityId: WACT_ID,
        createdAt:  now,
        updatedAt:  now,
        draft:      false,
      }, rec);
      if (!full.activityId) full.activityId = WACT_ID;
      localStorage.setItem(pfx + full.id, JSON.stringify(full));
      return full;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Record 1 — Commercial invoice (list + view + financials + share + chain)
    // Focus list: this invoice only. Children: expenses + payment (hidden).
    // ════════════════════════════════════════════════════════════════════════
    var inv = put({
      id: 'demo_invoice',
      chainRef: CHAIN,
      record_type: 'invoice',
      job: 'First-fix rewire — Riverside Studio',
      customer: 'Riverside Studio Co-op',
      customer_phone: '+44 7700 900201',
      date: d2,
      location: 'Unit 4, Riverside Works, Bristol BS1 6XN',
      ref_number: 'INV-DEMO-2026-001',
      amount: '2850',
      vat: '20',
      qty: '3',
      rate: '950',
      qty_unit: 'days',
      start_time: '07:30',
      end_time: '16:00',
      ackRequest: true,
      participants: [
        { role: 0, name: 'Riverside Studio Co-op', phone: '+44 7700 900201', note: 'Bill to — site contact Maya' },
        { role: 1, name: 'Jordan Lee', phone: '+44 7700 900202', note: 'Lead spark — demo worker' },
        { role: 2, name: 'Cable Wholesale Ltd', phone: '+44 117 900 3300', note: 'Materials supplier' },
      ],
      actions: [
        { title: 'Isolate and strip first-fix routes', notes: 'Board isolated. Old containment removed on level 1.' },
        { title: 'Pull 18 circuits — level 1', notes: 'Radial lighting and ring finals to new board positions.' },
        { title: 'Test, label and handover pack', notes: 'Zs at each circuit. Schedule issued. Client walkthrough booked.' },
      ],
      programmable_rules: [
        { op: 'when_confirmed', mask: 7 },
        { op: 'when_paid' },
      ],
      story: 'Three-day first-fix during studio refit. Access 07:30–16:00. Client requested staged power for edit suites.',
      details: 'Stage pay: 40% deposit, balance on test sign-off. EIC to follow second-fix phase.',
      compound_lines: [
        { name: 'Labour — lead spark', amount: '1650', lineType: 0, taxMode: 0 },
        { name: 'Labour — mate (1 day)', amount: '600', lineType: 0, taxMode: 0 },
        { name: 'Materials handling', amount: '200', lineType: 1, taxMode: 0 },
      ],
      compound_lines_subtotals: true,
    });

    put({
      id: 'demo_exp_materials',
      chainRef: CHAIN,
      record_type: 'expense',
      parentId: inv.id,
      job: 'Twin & earth, clips, back boxes',
      amount: '420',
      expense_billing: 'customer',
      charge_type: '6',
      date: d2,
    });
    put({
      id: 'demo_exp_cogs',
      chainRef: CHAIN,
      record_type: 'expense',
      parentId: inv.id,
      job: 'Cable trade price (COGS)',
      amount: '265',
      expense_billing: 'cogs',
      charge_type: '6',
      date: d2,
    });
    put({
      id: 'demo_pay_deposit',
      chainRef: CHAIN,
      record_type: 'payment',
      parentId: inv.id,
      amount: '1140',
      job: 'Deposit 40%',
      date: d5,
      story: 'BACS ref RS-DEMO-40',
    });

    // ════════════════════════════════════════════════════════════════════════
    // Record 2 — PADS job record (wizard / In-Out / process + actions + story)
    // ════════════════════════════════════════════════════════════════════════
    put({
      id: 'demo_pads',
      chainRef: 'chain_demo_pads',
      record_class: 'pads',
      record_type: 'pads',
      pads_process: 'Quote follow-up: second-fix and certification for Riverside Studio',
      job: 'Second-fix & certify — Riverside Studio',
      customer: 'Riverside Studio Co-op',
      customer_phone: '+44 7700 900201',
      date: d0,
      location: 'Unit 4, Riverside Works, Bristol BS1 6XN',
      start_time: '08:00',
      end_time: '17:00',
      actions: [
        { title: 'Second-fix accessories and face plates', notes: 'Align with client finish schedule.' },
        { title: 'Full test schedule + EIC pack', notes: 'Issue certs and O&M sheet for edit suites.' },
      ],
      story: 'Follows demo invoice first-fix. Client wants single chain thread in list filter by work activity.',
      details: 'PADS record shows process-first editing. Link to invoice via shared customer and work activity.',
    });

    if (global.BlockRegistry && BlockRegistry.save) {
      BlockRegistry.save('Riverside Studio Co-op', '+44 7700 900201');
      BlockRegistry.save('Jordan Lee', '+44 7700 900202');
    }

    if (global.PersonalService && PersonalService.capture) {
      PersonalService.capture({
        text:   'Demo v10: two records only — (1) Invoice with participants, actions, programmable rules, qty×rate, compound lines, expenses, partial payment, ACK. (2) PADS job for process/actions/story. Work activity: Riverside Studio. Run Demo.reset() to wipe.',
        source: 'quick-note',
      });
    }

    localStorage.setItem(SEED_KEY, '1');
    console.log('[workpads demo] seeded v10 — 2 primary records (invoice + PADS), 3 children, 1 work activity');
  }

  function reset() {
    clearAll();
    seed();
    console.log('[workpads demo] reset complete — reloading');
    window.location.reload();
  }

  if (!localStorage.getItem(SEED_KEY)) {
    clearAll();
    seed();
    window.location.reload();
  }

  global.Demo = { seed: seed, reset: reset, clear: clearAll };

}(window));
