#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

var SRC = path.join(__dirname, '../js/panels/WorkpadsPanel.monolith.js.bak');
if (!fs.existsSync(SRC)) SRC = path.join(__dirname, '../js/panels/WorkpadsPanel.js');
var lines = fs.readFileSync(SRC, 'utf8').split('\n');

function slice(ranges) {
  var parts = [];
  for (var i = 0; i < ranges.length; i++) {
    for (var j = ranges[i][0] - 1; j < ranges[i][1]; j++) parts.push(lines[j]);
  }
  return parts.join('\n');
}

var STATE = [
  'isOpen', 'context', 'lastContext', 'finActionIdx', 'mgmtPanelFocusIdx', 'logSortMode',
  'contactPanelRoleFilter', 'jobPanelChildren', 'browseActivities', 'browseChipsOn',
  'actOvOpen', 'actOvFilter', 'actOvZone', 'actOvFocusIdx', 'actOvFilterFocusIdx',
  'actOvAddMode', 'actOvNewType', 'browseDateStart', 'browseDateEnd', 'browseFocusables',
  'browseFocusIdx', 'browseNavMode', 'browseAgg', 'datePickerOpen', 'datePickerTarget',
  'datePickerYear', 'datePickerMonth', 'datePickerDay', 'neState'
];

function protectDecls(code, names) {
  var c = code;
  for (var i = 0; i < names.length; i++) {
    var fn = names[i];
    c = c.split('function ' + fn + '(').join('__FN__' + fn + '(');
  }
  return c;
}

function restoreDecls(code, names) {
  var c = code;
  for (var i = 0; i < names.length; i++) {
    var fn = names[i];
    c = c.split('__FN__' + fn + '(').join('function ' + fn + '(');
  }
  return c;
}

function protectVarDecls(code, names) {
  var c = code;
  for (var i = 0; i < names.length; i++) {
    var v = names[i];
    c = c.replace(new RegExp('\\bvar ' + v + '\\b', 'g'), '__VAR__' + v);
  }
  return c;
}

function restoreVarDecls(code, names) {
  var c = code;
  for (var i = 0; i < names.length; i++) {
    var v = names[i];
    c = c.replace(new RegExp('__VAR__' + v, 'g'), 'var ' + v);
  }
  return c;
}

function replaceCalls(code, names) {
  var c = code;
  for (var i = 0; i < names.length; i++) {
    var fn = names[i];
    var re = new RegExp('(^|[^a-zA-Z0-9_.])' + fn + '\\(', 'gm');
    c = c.replace(re, '$1S.' + fn + '(');
  }
  return c;
}

function xform(code, localFns, crossFns) {
  var allFns = localFns.concat(crossFns || []);
  var c = protectVarDecls(code, ['cpRolesExpanded']);
  c = protectDecls(c, allFns);
  c = c.replace(/(^|[^a-zA-Z0-9_])el\./gm, '$1S.el.');
  c = c.replace(/\bcontext\./g, 'S.context.');
  for (var i = 0; i < STATE.length; i++) {
    var v = STATE[i];
    var reBare = new RegExp('(^|[^a-zA-Z0-9_.])' + v + '([^a-zA-Z0-9_]|$)', 'gm');
    c = c.replace(reBare, '$1S.' + v + '$2');
  }
  c = replaceCalls(c, localFns);
  c = replaceCalls(c, crossFns || []);
  c = restoreDecls(c, allFns);
  c = restoreVarDecls(c, ['cpRolesExpanded']);
  c = c.replace(/\bvar S\.neState = \{/g, 'S.neState = {');
  c = c.replace(/f\.S\.el\b/g, 'f.el');
  c = c.replace(/S\.browseFocusables\[i\]\.S\.el/g, 'S.browseFocusables[i].el');
  return c;
}

function wrap(name, header, body, localFns, crossFns) {
  var transformed = xform(body, localFns, crossFns);
  var assigns = localFns.map(function(fn) {
    return '    S.' + fn + ' = ' + fn + ';';
  }).join('\n');
  return (
    '// ' + name + ' — WorkpadsPanel split module\n' +
    '(function(global) {\n  \'use strict\';\n\n' +
    header +
    '  function install(S) {\n' +
    transformed + '\n' +
    assigns + '\n  }\n\n  global.' + name + ' = { install: install };\n}(window));\n'
  );
}

var CROSS_SHARED = ['todayIso', 'fmtDate', 'pad2', 'pct', 'toNum', 'money', 'updateActCircle', 'createFromPanel'];
var CROSS_SHELL = ['close'];
var CROSS_BROWSE = [
  'renderListPanel', 'renderDatePicker', 'closeActOverlay', 'refreshChips', 'loadBrowseAgg',
  'renderBrowseSummaryLines', 'buildBrowseFocusables', 'applyBrowseFocus', 'openActOverlay',
  'selectPickerDay', 'openDatePicker', 'getFilteredActivities', 'renderActOverlay', 'createFromPanel'
];

var sharedFns = ['todayIso', 'fmtDate', 'pad2', 'pct', 'panelActionLabel', 'toNum', 'money', 'createFromPanel', 'updateActCircle'];
var sharedBody = slice([[91, 104], [199, 234], [236, 248]]);

var browseFns = [
  'openDatePicker', 'closeDatePicker', 'selectPickerDay', 'renderDatePicker',
  'computeAggregate', 'loadBrowseAgg', 'browseNavLine', 'browseDispLine', 'browseParentLine',
  'renderBrowseSummaryLines', 'buildBrowseFocusables', 'applyBrowseFocus', 'updateBrowseModeStrip',
  'getFilteredActivities', 'closeActOverlay', 'closeActPopup', 'renderActOverlay', 'openActOverlay',
  'handleBackKey', 'refreshChips', 'renderListPanel', 'navigateListBrowse', 'cycleListTabBrowse',
  'toggleNavModeBrowse', 'handleEnterBrowse'
];
var browseBody = slice([[106, 198], [272, 530], [532, 889]]) +
  '\n\n  function navigateListBrowse(dir) {\n' + slice([[1961, 1980], [1986, 1995]]) + '\n    return false;\n  }\n' +
  '\n  function cycleListTabBrowse(dir) {\n' + slice([[1999, 2005], [2024, 2038]]) + '\n    return false;\n  }\n' +
  '\n  function toggleNavModeBrowse() {\n' + slice([[2043, 2050]]) + '\n  }\n' +
  '\n  function handleEnterBrowse() {\n' + slice([[2054, 2076], [2088, 2129]]) + '\n    return false;\n  }\n';

var contactHeader =
  '  var LIAB_TYPES = { payable: true, receivable: true, loan: true };\n' +
  '  var CP_ROLE_CHIPS = [\n' +
  '    { val: 1, label: \'Worker\' }, { val: 0, label: \'Customer\' },\n' +
  '    { val: 2, label: \'Vendor\' }, { val: 4, label: \'Contractor\' },\n' +
  '  ];\n' +
  '  var CP_CHIP_VALS = { 1: true, 0: true, 2: true, 4: true };\n\n';
var contactFns = ['createFromContactPanel', 'renderContactPanel'];
var contactBody = slice([[917, 1169]]);

var recordFns = [
  'renderRecordPreview', 'renderLogPanel', 'renderNewEntWizardPanel', 'renderNewEntPanel',
  'neEntSectionHasContent', 'renderNewEntSectionBody', 'filterNewEntBody', 'renderJobPanel',
  'renderChildPanel', 'renderWizardContext', 'renderShareContext', 'renderManagementContext',
  'applyMgmtPanelFocus', 'scrollContent', 'navigateFinancialAction', 'navigateListRecord',
  'cycleListTabRecord', 'handleEnterRecord', 'focusedRecord'
];
var recordBody = slice([[891, 915], [1171, 1940], [1942, 1958], [2142, 2144]]) +
  '\n\n  function navigateListRecord(dir) {\n' + slice([[1981, 1985]]) + '\n    return false;\n  }\n' +
  '\n  function cycleListTabRecord(dir) {\n' + slice([[2007, 2023]]) + '\n    return false;\n  }\n' +
  '\n  function handleEnterRecord() {\n' +
  '    var rec = S.context.record;\n    if (!S.isOpen) return false;\n' +
  slice([[2079, 2087], [2130, 2139]]) + '\n    return false;\n  }\n';

var outDir = path.join(__dirname, '../js/panels');
fs.writeFileSync(path.join(outDir, 'workpads-panel-shared.js'), wrap('WorkpadsPanelShared', '', sharedBody, sharedFns, CROSS_SHELL));
fs.writeFileSync(path.join(outDir, 'workpads-panel-browse.js'), wrap(
  'WorkpadsPanelBrowse',
  '  var LIAB_TYPES = { payable: true, receivable: true, loan: true };\n  var ACT_OV_FILTER_IDS = [\'all\', \'own\', \'other\'];\n\n',
  browseBody,
  browseFns,
  CROSS_SHARED.concat(CROSS_BROWSE).concat(CROSS_SHELL)
));
fs.writeFileSync(path.join(outDir, 'workpads-panel-contact.js'), wrap('WorkpadsPanelContact', contactHeader, contactBody, contactFns, CROSS_SHARED.concat(CROSS_SHELL)));
fs.writeFileSync(path.join(outDir, 'workpads-panel-record.js'), wrap(
  'WorkpadsPanelRecord',
  '  var MGMT_TABS = [\'user\', \'records\', \'personal\', \'activities\', \'templates\'];\n' +
  '  var MGMT_TAB_LABELS = { user: \'User\', records: \'Records\', activities: \'Activities\', personal: \'Personal\', templates: \'My Templates\' };\n\n',
  recordBody,
  recordFns,
  CROSS_SHARED.concat(CROSS_BROWSE).concat(CROSS_SHELL)
));

console.log('Split modules written to js/panels/workpads-panel-*.js');
