import * as SpiderMonkey from './backends/spidermonkey.js';
import * as Kiesel from './backends/kiesel.js';

import * as Runner from './ipc/outside.js';

const backends = {
  kiesel: Kiesel,
  spidermonkey: SpiderMonkey
};
let backend = null;
export let backendName = null;

export const setBackend = async (name, preload = true) => {
  console.log('js backend is now', name);
  if (name === null) {
    backendName = null;
    backend = null;
    return;
  }

  backendName = name.toLowerCase();

  backend = backends[backendName];

  if (preload) await run(null, '');
};

export const run = async (doc, js) => {
  if (!backend) return false;

  await Runner.run(backend, doc, js);

  return true;
};