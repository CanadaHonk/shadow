import * as Runner from './ipc/outside.js';

export let backendName = null;

export const setBackend = async (name, preload = true) => {
  console.log('js backend is now', name);
  if (name === null) {
    backendName = null;
    backend = null;
    return;
  }

  backendName = name.toLowerCase();

  if (preload) await run(null, '');
};

export const run = async (doc, js) => {
  await Runner.run(backendName, doc, js);

  return true;
};