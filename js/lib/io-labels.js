// IO labels — Job/Work Inputs framing; COGS kept for financial summaries (R7 / IO)
// Exposes: window.IOLabels

(function(global) {
  'use strict';

  var JOB_INPUTS_KEY = 'wp_job_inputs_label'; // 'job' | 'work'

  function jobInputsMode() {
    return localStorage.getItem(JOB_INPUTS_KEY) || 'job';
  }

  function setJobInputsMode(mode) {
    localStorage.setItem(JOB_INPUTS_KEY, mode === 'work' ? 'work' : 'job');
  }

  /** User-facing label for labour/resource inputs on a job (not COGS). */
  function jobInputsLabel() {
    return jobInputsMode() === 'work' ? 'Work Inputs' : 'Job Inputs';
  }

  /** Financial / panel summaries — COGS terminology unchanged. */
  function cogsLabel() {
    return 'COGS';
  }

  function sourcedInputsLabel() {
    return 'Sourced Inputs';
  }

  function unsourcedInputsLabel() {
    return 'Unsourced Inputs';
  }

  function inputSourceLabel(src) {
    if (src === 'sourced') return sourcedInputsLabel();
    if (src === 'unsourced') return unsourcedInputsLabel();
    return 'Input';
  }

  function needLabel() { return 'Need'; }
  function offerLabel() { return 'Offer'; }
  function connectionLabel() { return 'Connection'; }

  global.IOLabels = {
    jobInputsMode: jobInputsMode,
    setJobInputsMode: setJobInputsMode,
    jobInputsLabel: jobInputsLabel,
    cogsLabel: cogsLabel,
    sourcedInputsLabel: sourcedInputsLabel,
    unsourcedInputsLabel: unsourcedInputsLabel,
    inputSourceLabel: inputSourceLabel,
    needLabel: needLabel,
    offerLabel: offerLabel,
    connectionLabel: connectionLabel,
  };

}(window));
