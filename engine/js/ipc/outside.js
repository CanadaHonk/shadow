const funcs = {
  'document.querySelector': ({ selector }, send, doc) => {
    const el = doc.querySelector(selector);
    send({ ptr: el.ptr });
  },

  'Element.getTextContent': ({ ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    send({ value: el.textContent });
  },

  'Element.setTextContent': ({ value, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    el.textContent = value;
    send({ value: el.textContent });
  },

  'alert': ({ msg }, send) => {
    alert(msg);
    send({});
  }
};

const backends = {
  kiesel: 'engine/js/backends/kiesel.js',
  spidermonkey: 'engine/js/backends/spidermonkey.js'
};

let backend = null, lastDocument = 0;

const SERIAL_RES_SIZE = 1024;

export const run = (backendName, doc, _js) => new Promise(async resolve => {
  if (backendName === null) return resolve(null);

  if (window.crossOriginIsolated === false) {
    alert(`due to browser restrictions, shadow has to use a service worker and reload once to be able to use some JS features which it requires for running JS (SharedArrayBuffer). try reloading`);
    return resolve(null);
  }

  if (!backend || backend.name !== backendName || doc.ptr !== lastDocument) {
    lastDocument = doc.ptr;
    if (backend) {
      backend.worker.onmessage = () => {};
      backend.worker.terminate();
    }

    backend = {
      name: backendName,
      handlers: {}
    };

    backend.worker = new Worker(backends[backendName], { type: 'module' });

    const lengthBuffer = new SharedArrayBuffer(4);
    const lengthTyped = new Int32Array(lengthBuffer);
    lengthTyped[0] = 0;

    const valueBuffer = new SharedArrayBuffer(SERIAL_RES_SIZE);
    const valueTyped = new Uint8Array(valueBuffer);

    const encodeBuffer = new Uint8Array(SERIAL_RES_SIZE);

    const encoder = new TextEncoder('utf8');

    backend.worker.postMessage({ lengthBuffer, valueBuffer });

    backend.worker.onmessage = e => {
      // console.log('main recv', e.data);
      const msg = e.data;
      if (backend.handlers[msg.type]) {
        backend.handlers[msg.type](msg);
      } else if (msg.f) {
        funcs[msg.f](msg, backend.send, doc);
      } else backend.send({});
    };

    backend.send = msg => {
      // console.log('main send', msg);

      const json = JSON.stringify(msg);
      encoder.encodeInto(json, encodeBuffer);

      for (let i = 0; i < json.length; i++) {
        Atomics.store(valueTyped, i, encodeBuffer[i]);
      }

      Atomics.store(lengthTyped, 0, json.length);
      Atomics.notify(lengthTyped, 0);
    };

    backend.on = (type, handler) => backend.handlers[type] = handler;

    await new Promise(res => backend.on('ready', () => {
      backend.send({});
      res();
    }));
  }

  const js = _js.slice();

  backend.on('wait', () => {
    backend.send({ type: 'eval', js });

    backend.handlers.wait = null;
  });
});