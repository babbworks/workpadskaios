// boot-safety.js — dev fallback when App boot fails or list never rendered
(function(global) {
  'use strict';

  function showBanner(msg, isErr) {
    var id = 'wp-boot-banner';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:absolute;top:0;left:0;right:0;z-index:9999;padding:8px 10px;font-size:11px;line-height:1.4;';
      var host = document.getElementById('screen-list') || document.body;
      host.appendChild(el);
    }
    el.style.background = isErr ? '#fff1f2' : '#eff6ff';
    el.style.color = isErr ? '#be123c' : '#1d4ed8';
    el.style.borderBottom = '1px solid rgba(0,0,0,0.15)';
    el.textContent = msg;
  }

  function clearBanner() {
    var el = document.getElementById('wp-boot-banner');
    if (el) el.remove();
  }

  function listContentReady() {
    var content = document.getElementById('list-content');
    if (!content) return false;
    var html = content.innerHTML || '';
    if (html.length < 40) return false;
    if (document.getElementById('list-boot-placeholder')) return false;
    return true;
  }

  function tryBootList() {
    if (!global.App || !App.showList) return false;
    var list = document.getElementById('screen-list');
    var content = document.getElementById('list-content');
    if (!list || !content) return false;
    if (!list.classList.contains('active')) return false;
    if (listContentReady()) return true;

    if (global.ListScreen && ListScreen.render) {
      ListScreen.render();
    } else {
      App.showList({ restoreNav: true });
    }
    return listContentReady();
  }

  function checkEmptyLibrary() {
    if (!global.RecordService || !RecordService.list) return;
    RecordService.list().then(function(records) {
      if (listContentReady()) return;
      var list = document.getElementById('screen-list');
      if (!list || !list.classList.contains('active')) return;
      if (records && records.length) {
        tryBootList();
        return;
      }
      showBanner(
        'No records in this profile. Dev: open console and run Demo.reset() then reload.',
        false
      );
    }).catch(function() {});
  }

  if (location.protocol === 'file:') {
    showBanner('Use a local server: cd repos/workpadskaios && npm start → http://localhost:3000/', true);
  }

  if (!global.App) {
    showBanner('App failed to start — hard-refresh (Shift+reload) and check the console.', true);
    return;
  }

  clearBanner();

  if (global.ActivityService && ActivityService.hasAny()) {
    setTimeout(function() {
      if (tryBootList()) {
        clearBanner();
        return;
      }
      setTimeout(function() {
        if (tryBootList()) {
          clearBanner();
          return;
        }
        checkEmptyLibrary();
      }, 400);
    }, 0);
  }
})(window);
