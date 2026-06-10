// CurrencyUtil — currency symbol resolution and multi-currency formatting
// Rule: use the symbol when it is globally unambiguous for exactly one currency;
//       use a 2-3 character code otherwise.
// Exposes: window.CurrencyUtil

(function(global) {
  'use strict';

  // ── Symbol map ───────────────────────────────────────────────────────────────
  // Entries here use the symbol; everything else falls back to a 2-3 char code.
  var SYM = {
    // Unambiguous Unicode symbols
    'EUR': '\u20ac',   // €
    'GBP': '\u00a3',   // £
    'BTC': '\u20bf',   // ₿
    'ETH': '\u039e',   // Ξ
    'NGN': '\u20a6',   // ₦
    'INR': '\u20b9',   // ₹
    'THB': '\u0e3f',   // ฿
    'VND': '\u20ab',   // ₫
    'UAH': '\u20b4',   // ₴
    'PHP': '\u20b1',   // ₱
    'TRY': '\u20ba',   // ₺
    'AZN': '\u20bc',   // ₼
    'GEL': '\u20be',   // ₾
    'KZT': '\u20b8',   // ₸
    'KRW': '\u20a9',   // ₩
    'CRC': '\u20a1',   // ₡
    'GHS': '\u20b5',   // ₵
    'ILS': '\u20aa',   // ₪
    'RUB': '\u20bd',   // ₽
    'MNT': '\u20ae',   // ₮  Mongolian Tögrög
    'LAK': '\u20ad',   // ₭  Lao Kip
    'KHR': '\u17db',   // ៛  Cambodian Riel
    'BDT': '\u09f3',   // ৳  Bangladeshi Taka
    // $ family — USD gets bare $, others prefixed
    'USD': '$',
    'CAD': 'CA$',
    'AUD': 'AU$',
    'NZD': 'NZ$',
    'SGD': 'SG$',
    'HKD': 'HK$',
    'TWD': 'NT$',
    'MXN': 'MX$',
    'BRL': 'R$',      // Brazilian Real
    'ARS': 'AR$',
    'CLP': 'CL$',
    'COP': 'CO$',
    'ZWL': 'Z$',
    // ¥ family — JPY gets bare ¥, CNY prefixed
    'JPY': '\u00a5',
    'CNY': 'CN\u00a5',
    // Other well-known short codes / abbreviations
    'CHF': 'Fr',       // Swiss Franc
    'SEK': 'kr',       // Swedish Krona (dominant kr internationally)
    'DKK': 'DK',
    'NOK': 'NO',
    'ISK': 'IK',
    'ZAR': 'R',        // South African Rand
    'KES': 'KSh',      // Kenyan Shilling
    'TZS': 'TSh',      // Tanzanian Shilling
    'UGX': 'USh',      // Ugandan Shilling
    'ZMW': 'ZK',       // Zambian Kwacha
    'MWK': 'MK',       // Malawian Kwacha
    'BWP': 'P',        // Botswana Pula
    'NAD': 'N$',       // Namibian Dollar
    'MZN': 'MT',       // Mozambican Metical
    'ETB': 'Br',       // Ethiopian Birr
    'XOF': 'CFA',      // West African CFA Franc
    'XAF': 'CFA',      // Central African CFA Franc
    'MAD': 'DH',       // Moroccan Dirham
    'DZD': 'DA',       // Algerian Dinar
    'TND': 'DT',       // Tunisian Dinar
    'EGP': 'E\u00a3',  // Egyptian Pound
    'SAR': 'SR',       // Saudi Riyal
    'AED': 'DH',       // UAE Dirham
    'QAR': 'QR',
    'KWD': 'KD',       // Kuwaiti Dinar
    'BHD': 'BD',       // Bahraini Dinar
    'OMR': 'OR',       // Omani Rial
    'JOD': 'JD',       // Jordanian Dinar
    'PKR': 'Rs',       // Pakistani Rupee
    'LKR': 'Rs',       // Sri Lankan Rupee (same Rs; context-dependent)
    'NPR': 'Rs',       // Nepalese Rupee
    'MYR': 'RM',       // Malaysian Ringgit
    'IDR': 'Rp',       // Indonesian Rupiah
    'PEN': 'S/',       // Peruvian Sol
    'PLN': 'z\u0142',  // Polish Zloty — zł
    'CZK': 'K\u010d',  // Czech Koruna — Kč
    'HUF': 'Ft',       // Hungarian Forint
    'RON': 'lei',
    'BGN': 'lv',
    'HRK': 'kn',       // Croatian Kuna
    'RSD': 'din',      // Serbian Dinar
    'RWF': 'RF',       // Rwandan Franc
    'GNF': 'GF',       // Guinean Franc
    // Mobile money / custom tokens — kept as-is (already short)
    'MTN': 'MTN',
    'MOMO': 'MoMo',
    'MPESA': 'M-P',
  };

  // Decimal precision per currency code
  var PRECISION = {
    'BTC': 6, 'ETH': 5, 'LTC': 6, 'XRP': 4,
    'JPY': 0, 'KRW': 0, 'VND': 0, 'IDR': 0, 'HUF': 0, 'RWF': 0, 'GNF': 0, 'XOF': 0, 'XAF': 0,
  };

  function precision(code) {
    return PRECISION[(code || '').toUpperCase()] != null
      ? PRECISION[(code || '').toUpperCase()]
      : 2;
  }

  // Return display symbol or short code for a currency code
  function symbol(code) {
    if (!code) return '';
    var up = code.toUpperCase();
    if (SYM[up] !== undefined) return SYM[up];
    // Fallback: first 3 chars of code
    return up.slice(0, 3);
  }

  // Format a single amount with its currency symbol
  function fmt(amount, code) {
    if (amount === null || amount === undefined || amount === '') return '\u2014';
    var n = parseFloat(amount);
    if (isNaN(n)) return '\u2014';
    var s  = symbol(code || '');
    var dp = precision(code || '');
    return s + n.toFixed(dp);
  }

  // ── Bucket helpers ────────────────────────────────────────────────────────────
  // A "flat bucket" is { GBP: 1200, BTC: 0.018 }
  // A "keyed bucket" is { GBP: { billed: 1200, paid: 800 }, BTC: { billed: 0.018, paid: 0 } }

  function addFlat(buckets, code, amount) {
    var c = (code || 'unknown').toUpperCase();
    buckets[c] = (buckets[c] || 0) + parseFloat(amount || 0);
  }

  function addKeyed(buckets, code, key, amount) {
    var c = (code || 'unknown').toUpperCase();
    if (!buckets[c]) buckets[c] = {};
    buckets[c][key] = (buckets[c][key] || 0) + parseFloat(amount || 0);
  }

  // Format a flat bucket: { GBP: 1200, BTC: 0.018 } → "£1200.00 · ₿0.018000"
  function fmtFlat(buckets) {
    var parts = [];
    Object.keys(buckets).sort().forEach(function(cur) {
      var v = buckets[cur];
      if (v || v === 0) parts.push(fmt(v, cur));
    });
    return parts.length ? parts.join(' \u00b7 ') : '\u2014';
  }

  // Format a specific field across a keyed bucket
  // { GBP: { billed: 1200 }, BTC: { billed: 0.018 } } with field='billed' → "£1200.00 · ₿0.018000"
  function fmtKeyed(buckets, field) {
    var flat = {};
    Object.keys(buckets).forEach(function(cur) {
      var v = buckets[cur][field];
      if (v) flat[cur] = v;
    });
    return fmtFlat(flat);
  }

  // True if buckets contain more than one currency key
  function isMulti(buckets) {
    return Object.keys(buckets).length > 1;
  }

  global.CurrencyUtil = {
    symbol:    symbol,
    fmt:       fmt,
    precision: precision,
    addFlat:   addFlat,
    addKeyed:  addKeyed,
    fmtFlat:   fmtFlat,
    fmtKeyed:  fmtKeyed,
    isMulti:   isMulti,
  };

}(window));
