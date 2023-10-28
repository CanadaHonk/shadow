import backend from './backend.js';

const start = async () => {
  return await backend('https://files.kiesel.dev/kiesel.wasm', ['kiesel', '/input.js']);
};

start();