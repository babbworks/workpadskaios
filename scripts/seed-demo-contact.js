// Demo seed: creates a contact "Alex Rivera" with linked financial records
// Run in browser console on the app page.
// Usage: paste this entire script into the browser console.

(function() {
  var today = new Date();
  function daysAgo(n) {
    var d = new Date(today); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // First create (or look up) a demo Activity to give records a shared context
  var activityName = 'Riverside Reno';
  var activities = WorkActivityService.listAll();
  var demoActivity = null;
  for (var ai = 0; ai < activities.length; ai++) {
    if (activities[ai].name === activityName) { demoActivity = activities[ai]; break; }
  }
  if (!demoActivity) {
    demoActivity = WorkActivityService.create(activityName, 'own');
    activities = WorkActivityService.listAll();
    for (var ai2 = 0; ai2 < activities.length; ai2++) {
      if (activities[ai2].name === activityName) { demoActivity = activities[ai2]; break; }
    }
  }
  var actId = demoActivity ? demoActivity.id : undefined;
  console.log('[seed] Activity:', actId, activityName);

  // Create the contact record
  RecordService.create({
    record_class: 'contact',
    job:          'Alex Rivera',
    customer:     'Rivera Building Co.',
    customer_phone: '555-0142',
    location:     'North Side',
    roles:        [1, 2, 5],   // Worker · Vendor · Sub-contractor
    category:     1,            // Worker (primary, backward compat)
    draft:        false,
  }).then(function(contact) {
    console.log('[seed] Contact created:', contact.id, contact.job);
    var cid = contact.id;
    var cName = contact.job;

    var records = [
      // Expenses
      {
        record_type: 'expense', expense_billing: 'customer',
        job: 'Lumber & hardware — deck framing',
        amount: '340.00', date: daysAgo(18), activityId: actId,
        customer: cName, linkedContactId: cid, draft: false,
      },
      {
        record_type: 'expense', expense_billing: 'customer',
        job: 'Permit application fee',
        amount: '95.00', date: daysAgo(14),
        customer: cName, linkedContactId: cid, draft: false,
      },
      // COGS
      {
        record_type: 'expense', expense_billing: 'cogs', charge_type: '2',
        job: 'Subcontract: electrical rough-in',
        amount: '1200.00', date: daysAgo(10), activityId: actId,
        customer: cName, linkedContactId: cid, draft: false,
      },
      {
        record_type: 'expense', expense_billing: 'cogs', charge_type: '3',
        job: 'Equipment hire — auger & compactor',
        amount: '420.00', date: daysAgo(6),
        customer: cName, linkedContactId: cid, draft: false,
      },
      // Income
      {
        record_type: 'payment',
        job: 'Deposit — 30% project advance',
        amount: '2850.00', date: daysAgo(20), activityId: actId,
        customer: cName, linkedContactId: cid, draft: false,
      },
      {
        record_type: 'payment',
        job: 'Progress payment — stage 1 complete',
        amount: '1900.00', date: daysAgo(5),
        customer: cName, linkedContactId: cid, draft: false,
      },
      // Payables — open (no paidAt)
      {
        record_type: 'payable',
        job: 'Labour invoice — framing week 1',
        description: 'Labour invoice — framing week 1',
        amount: '960.00', counterparty: cName,
        date: daysAgo(9), activityId: actId,
        linkedContactId: cid, draft: false,
      },
      {
        record_type: 'payable',
        job: 'Materials: plumbing fixtures (not yet paid)',
        description: 'Materials: plumbing fixtures',
        amount: '387.50', counterparty: cName,
        date: daysAgo(3),
        linkedContactId: cid, draft: false,
      },
      // Payable — settled (has paidAt)
      {
        record_type: 'payable',
        job: 'Tool rental reimbursement',
        description: 'Tool rental reimbursement',
        amount: '120.00', counterparty: cName,
        date: daysAgo(25), paidAt: Date.now() - 86400000 * 20,
        linkedContactId: cid, draft: false,
      },
      // Receivable — open
      {
        record_type: 'receivable',
        job: 'Client owes: final stage payment',
        description: 'Final stage payment outstanding',
        amount: '1500.00', counterparty: cName,
        date: daysAgo(4), activityId: actId,
        linkedContactId: cid, draft: false,
      },
      // Loan
      {
        record_type: 'loan', loan_direction: 'owing',
        job: 'Equipment loan — table saw',
        description: 'Table saw purchased on credit',
        amount: '650.00', counterparty: cName,
        date: daysAgo(30),
        linkedContactId: cid, draft: false,
      },
    ];

    var chain = Promise.resolve();
    records.forEach(function(fields) {
      chain = chain.then(function() {
        return RecordService.create(fields).then(function(r) {
          console.log('[seed]', r.record_type, r.job, '$' + r.amount);
          return RecordService.save(r.id, r);
        });
      });
    });

    return chain.then(function() {
      console.log('[seed] Done! Open the contact list, find Alex Rivera, then press ArrowLeft to see the panel.');
    });
  }).catch(function(err) {
    console.error('[seed] Error:', err);
  });
}());
