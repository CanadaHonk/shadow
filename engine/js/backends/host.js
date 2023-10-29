const decoder = new TextDecoder('utf8');

const SERIAL_RES_SIZE = 1024 * 1024 * 10;
const decodeBuffer = new Uint8Array(SERIAL_RES_SIZE);

let lengthBuffer, lengthTyped, valueBuffer, valueTyped;

let gotBuffersPromise = new Promise(res => {
  self.addEventListener('message', e => {
    // console.log('special worker onmessage', e.data);
    if (!lengthBuffer && e.data.lengthBuffer) {
      lengthBuffer = e.data.lengthBuffer;
      lengthTyped = new Int32Array(lengthBuffer);

      valueBuffer = e.data.valueBuffer;
      valueTyped = new Uint8Array(valueBuffer);

      res();
    }
  });
});

const start = async () => {
  const js = await (await fetch('/engine/js/ipc/inside.js')).text();

  globalThis.evalQueue = [];
  globalThis.ipc = {
    send: msg => {
      // console.log('worker send', msg);
      Atomics.store(lengthTyped, 0, 0);

      // self.postMessage(JSON.parse(JSON.stringify(msg)));
      self.postMessage(msg);

      Atomics.wait(lengthTyped, 0, 0, Infinity); // wait until typed[0] != 0

      const length = Atomics.load(lengthTyped, 0);

      for (let i = 0; i < length; i++) {
        decodeBuffer[i] = Atomics.load(valueTyped, i);
      }

      const reply = JSON.parse(decoder.decode(decodeBuffer.slice(0, length)));

      if (reply.type === 'eval') {
        evalQueue.push(reply);
      }

      return reply;
    }
  };

  // console.log('worker eval', js);

  await gotBuffersPromise;

  try {
    (0, eval).bind({})(js);
  } catch (e) {
    console.error(e);
  }
};

// console.log('worker out');

start();