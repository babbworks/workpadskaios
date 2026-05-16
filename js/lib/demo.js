// demo.js — seed data for browser testing
// Loaded ONLY in development. Do not include in production KaiOS build.
// Seeds 1 robust Moneybar scenario record on first load.
// Console: Demo.reset() to wipe and re-seed.

(function(global) {
  'use strict';

  var SEED_KEY = 'wp_demo_seeded_v4_single';

  function clearAll() {
    var toRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && (
        k.indexOf('wp_record_')   === 0 ||
        k.indexOf('wp_archive_')  === 0 ||
        k.indexOf('wp_activity_') === 0 ||
        k.indexOf('wp_personal_') === 0 ||
        k.indexOf('wp_block_')    === 0 ||
        k === 'wp_activity_active' ||
        k === SEED_KEY
      )) toRemove.push(k);
    }
    toRemove.forEach(function(k) { localStorage.removeItem(k); });
  }

  function seed() {
    var d1 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    var d2 = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    var d3 = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    var d4 = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);

    // ── Activity profile ───────────────────────────────────────────────
    if (!ActivityService.hasAny()) {
      ActivityService.create({
        name:   'John Clarke',
        phone:  '+44 7700 900142',
        type:   'freelance',
        locale: 'gb-v1',
      });
    }

    // ── Single full demo record: dependency-rich invoice ───────────────
    RecordService.create({
      record_type:    'invoice',
      job:            'Civic Hall electrical refit',
      customer:       'Northbank Civic Hall',
      date:           d1,
      location:       '40 Beacon Road, Manchester M3 4AB',
      worker:         'John Clarke',
      customer_phone: '+44 161 455 9080',
      start_time:     '07:30',
      end_time:       '18:10',
      meeting_time:   '07:00',
      amount:         '6850',
      currency:       'GBP',
      vat:            '20',
      draft:          false,
      actions: [
        {
          title: 'Distribution board survey and load balancing',
          notes: 'Measured legacy panel at unsafe peak load during event simulation. Designed phased board migration with temporary bypass supply.',
        },
        {
          title: 'Legacy strip-out and containment repair',
          notes: 'Removed perished runs, replaced damaged trunking in ceiling void, and documented inaccessible riser section for follow-up permit.',
        },
        {
          title: 'Install event-floor power circuits',
          notes: 'Installed three radial circuits, labelled outlets by zone, and captured thermal images after energisation.',
        },
        {
          title: 'Emergency lighting and exit compliance',
          notes: 'Commissioned 8 fittings with 3-hour backup, completed full function tests, and issued maintenance instruction sheet.',
        },
        {
          title: 'Commissioning, certification, and handover',
          notes: 'Issued EIC pack, demonstrated failover sequence, and secured signed completion with retention terms noted.',
        },
      ],
      story: 'Full venue electrical refit delivered in a live environment with staged isolation and continuity across bookings. Work packaged to support audit and insurance review.',
      details: 'Standard: BS 7671:2018. Certificate bundle: EIC-NBH-2026-115. Retention: 10% held for 30 days pending follow-up inspection.',
    }).then(function(rec) {
      var parentId = rec.id;
      // Customer-billed expenses (rich charge/action coverage)
      RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Copper busbars and isolators', amount: '740', expense_billing: 'customer', charge_type: '6', actionIdx: 0, currency: 'GBP', date: d1, draft: false });
      RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Containment and trunking repairs', amount: '420', expense_billing: 'customer', charge_type: '6', actionIdx: 1, currency: 'GBP', date: d2, draft: false })
      .then(function(exp2) {
        RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Event-floor distribution boards', amount: '910', expense_billing: 'customer', charge_type: '5', actionIdx: 2, currency: 'GBP', date: d2, draft: false })
        .then(function(exp3) {
          RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Emergency fittings and signage', amount: '560', expense_billing: 'customer', charge_type: '6', actionIdx: 3, currency: 'GBP', date: d3, draft: false })
          .then(function(exp4) {
            // COGS with mixed dependency modes
            RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Senior specialist overtime', amount: '520', expense_billing: 'cogs', charge_type: '2', actionIdx: 2, action_quoted: '910', currency: 'GBP', date: d3, draft: false });
            RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Extra containment fabrication', amount: '510', expense_billing: 'cogs', charge_type: '6', linkedExpenseId: exp2.id, actionIdx: 1, currency: 'GBP', date: d3, draft: false });
            RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Unplanned permit extension', amount: '180', expense_billing: 'cogs', charge_type: '12', currency: 'GBP', date: d4, draft: false });
            RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Load-bank retest and calibration', amount: '260', expense_billing: 'cogs', charge_type: '1', linkedExpenseId: exp3.id, actionIdx: 2, currency: 'GBP', date: d4, draft: false });
            RecordService.create({ record_type: 'expense', parentId: parentId, job: 'Warranty reserve allocation', amount: '95', expense_billing: 'cogs', charge_type: '11', linkedExpenseId: exp4.id, actionIdx: 3, currency: 'GBP', date: d4, draft: false });
          });
        });
      });

      // Payments: partial + staged + final
      RecordService.create({ record_type: 'payment', parentId: parentId, amount: '1200', story: 'Mobilisation deposit', currency: 'GBP', date: d1, draft: false });
      RecordService.create({ record_type: 'payment', parentId: parentId, amount: '2200', story: 'Mid-project valuation', currency: 'GBP', date: d3, draft: false });
      RecordService.create({ record_type: 'payment', parentId: parentId, amount: '3400', story: 'Post-handover transfer', currency: 'GBP', date: d4, draft: false });

      BlockRegistry.save('Northbank Civic Hall', '+44 161 455 9080');
    });

    // ── Personal quick note ────────────────────────────────────────────
    PersonalService.capture({
      text:   'Master demo: verify linked COGS, action-level sums, category tallies, and payment progress.',
      source: 'quick-note',
    });

    localStorage.setItem(SEED_KEY, '1');
    console.log('[workpads demo] seeded — 1 complex master record + rich financial lines');
  }

  function reset() {
    clearAll();
    seed();
    if (typeof App !== 'undefined' && App.showList) App.showList();
    console.log('[workpads demo] reset complete');
  }

  // Auto-seed on first load (v3 baseline): always enforce exactly 3 scenario mains.
  if (!localStorage.getItem(SEED_KEY)) {
    clearAll();
    seed();
  }

  global.Demo = { seed: seed, reset: reset, clear: clearAll };

}(window));
