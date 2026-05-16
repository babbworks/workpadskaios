// utils.js — shared utilities, loaded first in the script chain
// All exports are placed on window so IIFEs can call them without qualification.

window.esc = function(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

// ES5-safe Object.assign equivalent. Copies own enumerable properties
// from each source argument into target. Returns target.
window.merge = function(target) {
  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (!src) continue;
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
  }
  return target;
};
