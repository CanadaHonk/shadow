const decoder = new TextDecoder('utf8');

const SERIAL_RES_SIZE = 1024 * 1024 * 10;
const decodeBuffer = new Uint8Array(SERIAL_RES_SIZE);

let lengthBuffer, lengthTyped, valueBuffer, valueTyped, js;
self.addEventListener('message', e => {
  // console.log('special worker onmessage', e.data);
  if (!lengthBuffer && e.data.lengthBuffer) {
    lengthBuffer = e.data.lengthBuffer;
    lengthTyped = new Int32Array(lengthBuffer);

    valueBuffer = e.data.valueBuffer;
    valueTyped = new Uint8Array(valueBuffer);

    js = e.data.js;
  }
});

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

export default async (url, args) => {
  const wasmModule = await loadWasm(url);

  // hack: kiesel does not have await yet and isn't even called so just remove it
  if (args[0] === 'kiesel') js = js.replace('await ', '');

  const wasmFs = new WasmFs();

  let wasi = new WASI({
    args,
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

  wasmFs.fs.writeFileSync('/comm', "");
  wasmFs.fs.writeFileSync('/dev/stdin', "");
  wasmFs.fs.writeFileSync('/dev/stdout', "");
  wasmFs.fs.writeFileSync('/dev/stderr', "");

  let lastStdout = '';
  wasmFs.fs.watch('/dev/stdout', () => {
    const stdout = wasmFs.fs.readFileSync('/dev/stdout', 'utf8');

    const newStdout = stdout.slice(lastStdout.length);
    lastStdout = stdout;

    if (newStdout) {
      const msgs = newStdout.split('\n');
      for (const x of msgs) {
        if (x) {
          let msg;
          try {
            msg = JSON.parse(x);
          } catch {
            console.warn(x);
            continue;
          }

          // console.log('worker postmessage', msg);

          Atomics.store(lengthTyped, 0, 0); // typed[0] = 0
          // Atomics.notify(typed, 0);

          self.postMessage(msg);

          Atomics.wait(lengthTyped, 0, 0, Infinity) // wait until typed[0] != 0

          const length = Atomics.load(lengthTyped, 0);

          for (let i = 0; i < length; i++) {
            decodeBuffer[i] = Atomics.load(valueTyped, i);
          }

          const _reply = decoder.decode(decodeBuffer.slice(0, length));
          // console.log('worker postmessage reply', reply);

          let reply = _reply;
          if (reply.startsWith('{"type":"eval')) {
            reply = 'JS|' + JSON.parse(_reply).js;
          }

          wasmFs.fs.writeFileSync('/comm', reply + '\n');
          wasmFs.fs.appendFileSync('/dev/stdin', 'A\n');
        }
      }
    }
  });

  try {
    wasi.start(instance);
  } catch (e) {
    console.error(e);
  }

  let stdout = wasmFs.fs.readFileSync('/dev/stdout').toString();
  let stderr = wasmFs.fs.readFileSync('/dev/stderr').toString();
  console.log({stdout, stderr});
};