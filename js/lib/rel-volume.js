// RelVolume — relationship volume / rhythm scoring (IO C11)
// Exposes: window.RelVolume

(function(global) {
  'use strict';

  var STORAGE_KEY = 'wp_rel_volume_dials';

  var DEFAULT_DIALS = {
    windowDays:        90,
    minInteractions:   2,
    weightSale:        2,
    weightReceipt:     1.5,
    weightInvoice:     1,
    weightPayment:     1,
    weightNeed:        0.5,
    weightOffer:       0.75,
    weightConnection:  1,
    weightExpense:     0.5,
    weightJob:         0.35,
    decayPerDay:       0.01,
    rhythmThreshold:   4,
    warmThreshold:     2,
    advancedOpen:      false,
  };

  var TYPE_LABELS = {
    sale: 'Sale',
    receipt: 'Receipt',
    invoice: 'Invoice',
    payment: 'Payment',
    need: 'Need',
    offer: 'Offer',
    connection: 'Connection',
    expense: 'Expense',
    job: 'Job / work',
  };

  function merge(base, extra) {
    var out = {};
    var keys = Object.keys(base);
    for (var i = 0; i < keys.length; i++) out[keys[i]] = base[keys[i]];
    if (extra) {
      keys = Object.keys(extra);
      for (i = 0; i < keys.length; i++) out[keys[i]] = extra[keys[i]];
    }
    return out;
  }

  function getDials() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return merge(DEFAULT_DIALS, raw);
    } catch (_) {
      return merge({}, DEFAULT_DIALS);
    }
  }

  function setDials(partial) {
    var cur = getDials();
    var keys = Object.keys(partial || {});
    for (var i = 0; i < keys.length; i++) cur[keys[i]] = partial[keys[i]];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
  }

  function resetDials() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function contactKey(rec) {
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    if (rt === 'contact') {
      return (rec.job || rec.name || rec.customer || '').trim().toLowerCase();
    }
    return (rec.customer || rec.worker || rec.vendor || '').trim().toLowerCase();
  }

  function contactLabel(rec) {
    return (rec.job || rec.name || rec.customer || rec.worker || '(contact)').trim();
  }

  function buildContactIndex(records) {
    var byId = {};
    var byKey = {};
    var i, r, ck;
    for (i = 0; i < records.length; i++) {
      r = records[i];
      if ((r.record_type || r.recordType || '').toLowerCase() !== 'contact') continue;
      if (r.parentId) continue;
      byId[r.id] = r;
      ck = contactKey(r);
      if (ck) byKey[ck] = r.id;
    }
    return { byId: byId, byKey: byKey };
  }

  function resolveContactId(rec, index) {
    if (!rec || !index) return null;
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    if (rt === 'contact') return rec.id;
    if (rec.linkedContactId && index.byId[rec.linkedContactId]) return rec.linkedContactId;
    var ck = contactKey(rec);
    return ck ? (index.byKey[ck] || null) : null;
  }

  function recordWeight(rec, dials) {
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    if (rt === 'sale') return dials.weightSale;
    if (rt === 'receipt') return dials.weightReceipt;
    if (rt === 'invoice') return dials.weightInvoice;
    if (rt === 'payment') return dials.weightPayment;
    if (rt === 'need') return dials.weightNeed;
    if (rt === 'offer') return dials.weightOffer;
    if (rt === 'connection') return dials.weightConnection;
    if (rt === 'expense' || rt === 'cogs') return dials.weightExpense;
    if (rt === 'job' || rt === 'work_record') return dials.weightJob;
    return 0.25;
  }

  function recordTs(rec) {
    var ts = rec.updatedAt || rec.createdAt || 0;
    if (typeof ts === 'string') ts = Date.parse(ts) || 0;
    return ts;
  }

  function decayFactor(ageDays, dials) {
    if (!dials.decayPerDay || dials.decayPerDay <= 0) return 1;
    return Math.max(0.15, 1 - ageDays * dials.decayPerDay);
  }

  function bandForScore(score, dials) {
    dials = dials || getDials();
    if (score >= dials.rhythmThreshold) return 'rhythm';
    if (score >= dials.warmThreshold) return 'warm';
    if (score >= dials.minInteractions) return 'quiet';
    return 'other';
  }

  function bandLabel(band) {
    if (band === 'rhythm') return 'In rhythm';
    if (band === 'warm') return 'Warming';
    if (band === 'quiet') return 'Quiet ties';
    return 'Directory';
  }

  function scoreByContact(records, dials) {
    dials = dials || getDials();
    var cutoff = Date.now() - dials.windowDays * 86400000;
    var index = buildContactIndex(records);
    var scores = {};
    var now = Date.now();
    var i, r, cid, w, ts, age, pts, rt;

    for (i = 0; i < records.length; i++) {
      r = records[i];
      if (r.parentId) continue;
      cid = resolveContactId(r, index);
      if (!cid) continue;
      ts = recordTs(r);
      if (ts && ts < cutoff) continue;
      if (!scores[cid]) {
        scores[cid] = {
          contactId: cid,
          key: contactKey(index.byId[cid] || r),
          label: contactLabel(index.byId[cid] || r),
          score: 0,
          count: 0,
          byType: {},
        };
      }
      w = recordWeight(r, dials);
      age = ts ? (now - ts) / 86400000 : 0;
      pts = w * decayFactor(age, dials);
      scores[cid].score += pts;
      scores[cid].count += 1;
      rt = (r.record_type || r.recordType || 'other').toLowerCase();
      if (!scores[cid].byType[rt]) scores[cid].byType[rt] = { count: 0, points: 0 };
      scores[cid].byType[rt].count += 1;
      scores[cid].byType[rt].points += pts;
    }

    var list = [];
    var keys = Object.keys(scores);
    for (i = 0; i < keys.length; i++) {
      var s = scores[keys[i]];
      s.band = bandForScore(s.score, dials);
      s.bandLabel = bandLabel(s.band);
      if (s.score >= dials.minInteractions || index.byId[s.contactId]) list.push(s);
    }
    list.sort(function(a, b) { return b.score - a.score || a.label.localeCompare(b.label); });
    return list;
  }

  /** Legacy name-key scoring (compat) */
  function scoreRecords(records, dials) {
    var byContact = scoreByContact(records, dials);
    var out = [];
    var i;
    for (i = 0; i < byContact.length; i++) {
      out.push({
        key: byContact[i].key,
        score: byContact[i].score,
        count: byContact[i].count,
        label: byContact[i].label,
        contactId: byContact[i].contactId,
        band: byContact[i].band,
      });
    }
    return out;
  }

  function scoreForContactId(contactId, records, dials) {
    var all = scoreByContact(records, dials);
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i].contactId === contactId) return all[i];
    }
    return {
      contactId: contactId,
      score: 0,
      count: 0,
      band: 'other',
      bandLabel: bandLabel('other'),
      byType: {},
      label: '',
    };
  }

  function explainContact(contactId, records, dials) {
    dials = dials || getDials();
    var sc = scoreForContactId(contactId, records, dials);
    var lines = [];
    var types = Object.keys(sc.byType || {});
    types.sort(function(a, b) {
      return (sc.byType[b].points || 0) - (sc.byType[a].points || 0);
    });
    var i, t;
    for (i = 0; i < types.length; i++) {
      t = types[i];
      lines.push({
        type: t,
        label: TYPE_LABELS[t] || t,
        count: sc.byType[t].count,
        points: Math.round(sc.byType[t].points * 10) / 10,
      });
    }
    var totals = { sale: 0, buy: 0, need: 0, offer: 0, connection: 0, other: 0 };
    var index = buildContactIndex(records);
    for (i = 0; i < records.length; i++) {
      var r = records[i];
      if (resolveContactId(r, index) !== contactId) continue;
      var rt = (r.record_type || '').toLowerCase();
      if (rt === 'sale') totals.sale++;
      else if (rt === 'payment' || rt === 'expense' || rt === 'cogs') totals.buy++;
      else if (rt === 'need') totals.need++;
      else if (rt === 'offer') totals.offer++;
      else if (rt === 'connection') totals.connection++;
      else totals.other++;
    }
    return {
      contactId: contactId,
      label: sc.label,
      score: Math.round(sc.score * 10) / 10,
      band: sc.band,
      bandLabel: sc.bandLabel,
      windowDays: dials.windowDays,
      lines: lines,
      totals: totals,
      summary: 'Score ' + (Math.round(sc.score * 10) / 10) + ' in last ' + dials.windowDays +
        'd — ' + sc.bandLabel + '. Recent activity weighs more (decay ' + dials.decayPerDay + '/day).',
    };
  }

  function rhythmContactIds(records, dials) {
    dials = dials || getDials();
    var scored = scoreByContact(records, dials);
    var ids = {};
    var i;
    for (i = 0; i < scored.length; i++) {
      if (scored[i].band === 'rhythm' || scored[i].band === 'warm') {
        ids[scored[i].contactId] = true;
      }
    }
    return ids;
  }

  function recordInRhythmNetwork(rec, records, dials) {
    var index = buildContactIndex(records);
    var cid = resolveContactId(rec, index);
    if (!cid) return false;
    var ids = rhythmContactIds(records, dials);
    return !!ids[cid];
  }

  function networkSummary(records, dials) {
    dials = dials || getDials();
    var scored = scoreByContact(records, dials);
    var bands = { rhythm: 0, warm: 0, quiet: 0, other: 0 };
    var i;
    for (i = 0; i < scored.length; i++) bands[scored[i].band] = (bands[scored[i].band] || 0) + 1;
    var needs = 0, offers = 0, openConn = 0;
    for (i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.parentId) continue;
      var rt = (r.record_type || '').toLowerCase();
      if (rt === 'need') needs++;
      else if (rt === 'offer') offers++;
      else if (rt === 'connection' && r.receivedAt && global.WPNocGatekeeper &&
        WPNocGatekeeper.needsGatekeeperReceive(r, records)) openConn++;
    }
    return {
      bands: bands,
      needs: needs,
      offers: offers,
      openConnections: openConn,
      topRhythm: scored.filter(function(s) { return s.band === 'rhythm'; }).slice(0, 5),
    };
  }

  var PRESETS = {
    market: {
      label: 'Market stall',
      windowDays: 30,
      minInteractions: 1.5,
      weightSale: 3,
      weightReceipt: 2,
      rhythmThreshold: 3,
      warmThreshold: 1.5,
      decayPerDay: 0.02,
    },
    field: {
      label: 'Field jobs',
      windowDays: 90,
      minInteractions: 2,
      weightJob: 1.2,
      weightInvoice: 1.2,
      weightPayment: 1,
      decayPerDay: 0.008,
    },
    quiet: {
      label: 'Quiet network',
      windowDays: 120,
      minInteractions: 3,
      rhythmThreshold: 5,
      warmThreshold: 3,
      decayPerDay: 0.005,
    },
  };

  function applyPreset(id) {
    if (!PRESETS[id]) return false;
    setDials(merge(PRESETS[id], {}));
    return true;
  }

  global.RelVolume = {
    DEFAULT_DIALS: DEFAULT_DIALS,
    PRESETS: PRESETS,
    TYPE_LABELS: TYPE_LABELS,
    getDials: getDials,
    setDials: setDials,
    resetDials: resetDials,
    applyPreset: applyPreset,
    contactKey: contactKey,
    scoreRecords: scoreRecords,
    scoreByContact: scoreByContact,
    scoreForContactId: scoreForContactId,
    explainContact: explainContact,
    bandForScore: bandForScore,
    bandLabel: bandLabel,
    rhythmContactIds: rhythmContactIds,
    recordInRhythmNetwork: recordInRhythmNetwork,
    networkSummary: networkSummary,
  };

}(window));
