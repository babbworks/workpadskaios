// presentation-starters.js — bundled presentation templates (Phase K / B6)
// Exposes: window.WPPresentationStarters

(function(global) {
  'use strict';

  var STARTERS = [
    {
      uri: 'urn:workpads:tpl:starter:stall:v1',
      name: 'Market stall',
      schema: 'A',
      type: 'note',
      scope: ['note'],
      domain: 'trade',
      version: 1,
      trust: 'built-in',
      blurb: 'Quick stall note — item, qty, cash in/out',
      html: '<div class="wpt-stall">' +
          '<div class="wpt-stall-hdr">{{ts}}</div>' +
          '<div class="wpt-stall-title">{{text}}</div>' +
          '{{#stall_line}}<div class="wpt-stall-line">{{stall_line}}</div>{{/stall_line}}' +
          '{{#rec}}<div class="wpt-stall-rec">Re: {{rec.title}}</div>{{/rec}}' +
        '</div>',
      css: '.wpt-stall{padding:12px 14px;background:#1a1408;font-family:inherit;}' +
        '.wpt-stall-hdr{font-size:9px;color:#c8a050;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;}' +
        '.wpt-stall-title{font-size:13px;color:#f0e0c0;line-height:1.45;margin-bottom:8px;}' +
        '.wpt-stall-line{font-size:11px;color:#a89060;border-left:2px solid #c8a050;padding-left:6px;margin-top:4px;}' +
        '.wpt-stall-rec{font-size:10px;color:#806840;margin-top:10px;}',
    },
    {
      uri: 'urn:workpads:tpl:starter:farm:v1',
      name: 'Farm day',
      schema: 'A',
      type: 'note',
      scope: ['note'],
      domain: 'agriculture',
      version: 1,
      trust: 'built-in',
      blurb: 'Field visit — crop, plot, weather, next job',
      html: '<div class="wpt-farm">' +
          '<div class="wpt-farm-hdr">{{ts}} \u00b7 Field</div>' +
          '<div class="wpt-farm-body">{{text}}</div>' +
          '{{#plot}}<div class="wpt-farm-plot">Plot: {{plot}}</div>{{/plot}}' +
          '{{#rec}}<div class="wpt-farm-rec">{{rec.title}}</div>{{/rec}}' +
        '</div>',
      css: '.wpt-farm{padding:12px 14px;background:#0e1810;}' +
        '.wpt-farm-hdr{font-size:9px;color:#70b878;letter-spacing:0.4px;margin-bottom:6px;}' +
        '.wpt-farm-body{font-size:12px;color:#c8e0c8;line-height:1.5;}' +
        '.wpt-farm-plot{font-size:10px;color:#508858;margin-top:8px;}' +
        '.wpt-farm-rec{font-size:10px;color:#406848;margin-top:8px;border-top:1px solid #1e3020;padding-top:6px;}',
    },
    {
      uri: 'urn:workpads:tpl:starter:rocket:v1',
      name: 'Rocket job',
      schema: 'A',
      type: 'note',
      scope: ['note'],
      domain: 'trade',
      version: 1,
      trust: 'built-in',
      blurb: 'Fast job card — who, what, when done',
      html: '<div class="wpt-rocket">' +
          '<div class="wpt-rocket-tag">Quick</div>' +
          '<div class="wpt-rocket-title">{{text}}</div>' +
          '<div class="wpt-rocket-ts">{{ts}}</div>' +
          '{{#worker}}<div class="wpt-rocket-who">{{worker}}</div>{{/worker}}' +
        '</div>',
      css: '.wpt-rocket{padding:14px;background:#0c1428;border-left:4px solid #4a9eff;}' +
        '.wpt-rocket-tag{font-size:8px;font-weight:bold;color:#4a9eff;letter-spacing:0.6px;text-transform:uppercase;}' +
        '.wpt-rocket-title{font-size:14px;color:#e8f0ff;margin:6px 0 4px;line-height:1.35;}' +
        '.wpt-rocket-ts{font-size:9px;color:#5a7a9a;}' +
        '.wpt-rocket-who{font-size:10px;color:#8aa8c8;margin-top:8px;}',
    },
    {
      uri: 'urn:workpads:tpl:starter:relay:v1',
      name: 'Relay brief',
      schema: 'A',
      type: 'note',
      scope: ['note'],
      domain: 'general',
      version: 1,
      trust: 'built-in',
      blurb: 'Hand-off note for connections / gatekeeper',
      html: '<div class="wpt-relay">' +
          '<div class="wpt-relay-lbl">Relay</div>' +
          '<div class="wpt-relay-text">{{text}}</div>' +
          '{{#source}}<div class="wpt-relay-src">via {{source}}</div>{{/source}}' +
        '</div>',
      css: '.wpt-relay{padding:12px 14px;background:#140e1c;}' +
        '.wpt-relay-lbl{font-size:8px;color:#b080e0;text-transform:uppercase;letter-spacing:0.5px;}' +
        '.wpt-relay-text{font-size:12px;color:#d8c8e8;line-height:1.5;margin-top:6px;}' +
        '.wpt-relay-src{font-size:9px;color:#706080;margin-top:8px;}',
    },
  ];

  function list() {
    return STARTERS.slice();
  }

  function get(uri) {
    var i;
    for (i = 0; i < STARTERS.length; i++) {
      if (STARTERS[i].uri === uri) return STARTERS[i];
    }
    return null;
  }

  function has(uri) {
    return !!get(uri);
  }

  global.WPPresentationStarters = {
    list: list,
    get: get,
    has: has,
    SAMPLE_NOTE: {
      ts: 'Today 14:30',
      text: 'Sample note — edit in Quick note before share.',
      source: 'workpads',
      stall_line: '2 bags maize @ 120',
      plot: 'North ridge',
      worker: 'You',
      rec: { title: 'Linked record', date: '2026-05-24' },
    },
  };

}(typeof window !== 'undefined' ? window : global));
