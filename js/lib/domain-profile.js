// Domain profiles — v0.4 scaffold (wire id byte on 1pv bridge ext)
// Exposes: window.WPDomainProfile

(function(global) {
  'use strict';

  var BYTES = {
    0: 'generic',
    1: 'service_work.v1'
  };

  var NAMES = {
    generic: 0,
    'service_work.v1': 1
  };

  function profileByteForRecord(rec) {
    if (!rec) return 0;
    var id = rec.profile_id || rec.domain_profile;
    if (id == null || id === '' || id === 'generic') return 0;
    var n = String(id).toLowerCase();
    return NAMES[n] != null ? NAMES[n] : 0;
  }

  function profileNameFromByte(b) {
    return BYTES[b & 0xff] || 'generic';
  }

  global.WPDomainProfile = {
    BYTES: BYTES,
    NAMES: NAMES,
    profileByteForRecord: profileByteForRecord,
    profileNameFromByte: profileNameFromByte,
    defaultProfile: function() { return 'generic'; },
    firstShipProfile: function() { return 'service_work.v1'; }
  };

}(typeof window !== 'undefined' ? window : global));
