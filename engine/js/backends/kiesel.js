let wasmModule, WasmFs, WASI, browserBindings;
const loadWasm = async url => {
  if (wasmModule) return wasmModule;

  // todo: use 1.x versions (breaking)
  0, { WASI } = await import('https://esm.sh/@wasmer/wasi@0.12.0');
  0, browserBindings = (await import('https://esm.sh/@wasmer/wasi@0.12.0/lib/bindings/browser')).default;

  // const { WasmFs } = await import('https://esm.sh/@wasmer/wasmfs@0.12.0');
  0, { WasmFs } = await import('https://esm.sh/@wasmer/wasmfs@0.12.0');
  // if (!wasmFs) wasmFs = new WasmFs();

  const res = fetch(url);
  return wasmModule = await WebAssembly.compileStreaming(res);
};

export const run = async (js, ipcHandler = () => {}, stdinCallback = () => {}) => {
  // const wasmModule = await loadWasm('https://goose-cors.goosemod.workers.dev/?https://files.kiesel.dev/kiesel.wasm');
  const wasmModule = await loadWasm('https://files.kiesel.dev/kiesel.wasm');

  const wasmFs = new WasmFs();

  let wasi = new WASI({
    args: ['kiesel', '/input.js'],
    preopens: {'/': '/'},
    env: {},
    bindings: {
      ...browserBindings,
      fs: wasmFs.fs,
    },
  });

  let instance = await WebAssembly.instantiate(wasmModule, wasi.getImports(wasmModule));

  wasmFs.fs.writeFileSync('/input.js', js);

  wasmFs.volume.fds[1].position = 0;
  wasmFs.volume.fds[2].position = 0;

  wasmFs.fs.writeFileSync('/dev/stdin', "");
  wasmFs.fs.writeFileSync('/dev/stdout', "");
  wasmFs.fs.writeFileSync('/dev/stderr', "");

  stdinCallback(wasmFs.fs);

  let lastStdout = '';
  wasmFs.fs.watch('/dev/stdout', () => {
    const stdout = wasmFs.fs.readFileSync('/dev/stdout', 'utf8');

    const newStdout = stdout.slice(lastStdout.length);

    if (newStdout) {
      const msgs = newStdout.split('\n');
      for (const x of msgs) {
        if (x && x.endsWith('}')) {
          ipcHandler(JSON.parse(x));
          lastStdout = stdout;
        }
      }
    }
  });

  try {
    wasi.start(instance);
  } catch (e) {
    console.error(e);
  }

  console.log({ js });

  /* let stdout = wasmFs.fs.readFileSync('/dev/stdout').toString();
  let stderr = wasmFs.fs.readFileSync('/dev/stderr').toString();
  console.log({stdout, stderr}); */
};