// OverlayFocus — D-pad row focus for simple list overlays (R5)
// Exposes: window.OverlayFocus

(function(global) {
  'use strict';

  function stepRow(rows, from, dir, attr) {
    attr = attr || 'data-idx';
    var i = from;
    for (;;) {
      i += dir;
      if (i < 0 || i >= rows.length) return from;
      return i;
    }
  }

  function bindRows(container, attr, onSelect) {
    attr = attr || 'data-idx';
    var rows = container.querySelectorAll('[' + attr + ']');
    for (var r = 0; r < rows.length; r++) {
      rows[r].onclick = (function(idx) {
        return function() { onSelect(idx); };
      })(parseInt(rows[r].getAttribute(attr), 10));
    }
    return rows;
  }

  function handleKey(key, state, rowCount, render, onSelect, onClose) {
    switch (key) {
      case 'ArrowUp':
        state.idx = stepRow(rowCount, state.idx, -1);
        render();
        return true;
      case 'ArrowDown':
        state.idx = stepRow(rowCount, state.idx, 1);
        render();
        return true;
      case 'Enter':
        onSelect(state.idx);
        return true;
      case 'Backspace':
        if (onClose) onClose();
        return true;
    }
    return false;
  }

  /** Two-button overlays (confirm cancel / ok) */
  function handleChipKey(key, state, render, onSelect, onClose) {
    switch (key) {
      case 'ArrowLeft':
        state.idx = 0;
        render();
        return true;
      case 'ArrowRight':
        state.idx = 1;
        render();
        return true;
      case 'Enter':
        onSelect(state.idx);
        return true;
      case 'Backspace':
        if (onClose) onClose();
        return true;
    }
    return false;
  }

  function markChipFocus(cancelEl, okEl, idx) {
    if (cancelEl) {
      cancelEl.classList.toggle('nav-focused', idx === 0);
      cancelEl.classList.toggle('overlay-btn-focused', idx === 0);
    }
    if (okEl) {
      okEl.classList.toggle('nav-focused', idx === 1);
      okEl.classList.toggle('overlay-btn-focused', idx === 1);
    }
  }

  global.OverlayFocus = {
    stepRow: stepRow,
    bindRows: bindRows,
    handleKey: handleKey,
    handleChipKey: handleChipKey,
    markChipFocus: markChipFocus,
  };


}(window));
