import * as Runner from './ipc/outside.js';

export let backendName = null;

export const setBackend = async (name, preload = true) => {
  console.log('js backend is now', name);
  if (name === null) {
    backendName = null;
    return;
  }

  backendName = name.toLowerCase();

  // Fif (preload) await run(null, '');
};

export const stop = doc => Runner.stop(doc);
export const stopAll = () => Runner.stopAll();

export const run = async (doc, js) => {
  await Runner.run(backendName, doc, js);

  return true;
};

// setBackend('spidermonkey');
if (!globalThis.node) setBackend('host');