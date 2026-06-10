// roles.js — ROLE-CODEBOOK v1.1 lookup tables for pads-v1 participants block
// NOT in index.html (audit Wave 1). Tests: codec-pads-v1.test.js via readFileSync.
// Wire format: role_code byte = (ROLE_SLOT << 3) | ROLE_SIGNALS
//   ROLE_SLOT 0-30: compressed common-role codebook (§1.3)
//   ROLE_SLOT 31: extended — read next byte (§2/§3)
// ROLE_SIGNALS: bit2=CERT, bit1=AUTH, bit0=LEAD

'use strict';

(function(global) {

  // Compressed common-role codebook §1.3 — ROLE_SLOT 0–30
  var COMMON_ROLES = [
    'Subcontractor',              // 0
    'Employee / Staff',           // 1
    'Agent / Representative',     // 2
    'Authority / Inspector',      // 3
    'Business Owner / Proprietor',// 4
    'Manager',                    // 5
    'Project Manager',            // 6
    'Accountant / Bookkeeper',    // 7
    'Auditor',                    // 8
    'Tax / Revenue Officer',      // 9
    'Lawyer / Attorney',          // 10
    'Doctor / Physician',         // 11
    'Nurse / Community Health',   // 12
    'Teacher / Trainer',          // 13
    'General Contractor',         // 14
    'Electrician',                // 15
    'Plumber',                    // 16
    'Carpenter',                  // 17
    'Driver',                     // 18
    'Farmer',                     // 19
    'Market Trader / Vendor',     // 20
    'Mobile Money Agent',         // 21
    'Security Guard',             // 22
    'Cleaner / Housekeeper',      // 23
    'Cook / Caterer',             // 24
    'IT Technician',              // 25
    'Engineer',                   // 26
    'Healthcare Worker',          // 27
    'Community Leader',           // 28
    'NGO / Aid Worker',           // 29
    'Other'                       // 30
  ];

  function roleName(roleSlot) {
    if (roleSlot >= 0 && roleSlot < COMMON_ROLES.length) return COMMON_ROLES[roleSlot];
    if (roleSlot === 31) return null; // extended path — look up in full codebook
    return null;
  }

  function roleCodeByte(roleSlot, roleSignals) {
    return (((roleSlot || 0) & 0x1F) << 3) | ((roleSignals || 0) & 0x7);
  }

  function decodeRoleCodeByte(byte) {
    return { roleSlot: (byte >> 3) & 0x1F, roleSignals: byte & 0x7 };
  }

  // pads-v1 participant roleType quick-select (bits 0–1 of role byte)
  var QUICK_ROLE_TYPES = ['Customer', 'Worker', 'Supplier', 'Other'];

  function quickRoleLabel(roleType, roleText) {
    var rt = roleType != null ? roleType : 0;
    if (rt === 3 && roleText) return String(roleText);
    return QUICK_ROLE_TYPES[rt] || QUICK_ROLE_TYPES[0];
  }

  function quickRoleOptions() {
    return [
      { val: 0, label: QUICK_ROLE_TYPES[0] },
      { val: 1, label: QUICK_ROLE_TYPES[1] },
      { val: 2, label: QUICK_ROLE_TYPES[2] },
      { val: 3, label: QUICK_ROLE_TYPES[3] },
    ];
  }

  // Extended role labels (template-creator participant roleType index)
  var EXTENDED_ROLE_LABELS = [
    'Witness', 'Guarantor', 'Signatory', 'Observer', 'Approver',
    'Beneficiary', 'Agent', 'Referee', 'Representative', 'Director',
    'Shareholder', 'Auditor', 'Solicitor', 'Accountant', 'Trustee', 'Custom',
  ];

  global.WPRoles = {
    COMMON_ROLES:         COMMON_ROLES,
    QUICK_ROLE_TYPES:     QUICK_ROLE_TYPES,
    EXTENDED_ROLE_LABELS: EXTENDED_ROLE_LABELS,
    roleName:             roleName,
    roleCodeByte:         roleCodeByte,
    decodeRoleCodeByte:   decodeRoleCodeByte,
    quickRoleLabel:       quickRoleLabel,
    quickRoleOptions:     quickRoleOptions,
  };

}(typeof window !== 'undefined' ? window : global));
