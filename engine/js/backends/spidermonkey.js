import backend from './backend.js';

let data;
const start = async () => {
  if (!data) data = await (await fetch('https://mozilla-spidermonkey.github.io/sm-wasi-demo/data.json')).json();

  return await backend(data[0].url, ['js.wasm', '-f', '/input.js']);
};

start();