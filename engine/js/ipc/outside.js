const funcs = {
  'Element.querySelector': ({ selector, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    const target = el.querySelector(selector);
    send({ ptr: target?.ptr });
  },

  'Element.getElementById': ({ id, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    const target = el.allChildren().find(x => x.id === id);
    send({ ptr: target?.ptr });
  },

  'Element.getClassName': ({ ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    send({ value: el.className });
  },

  'Element.setClassName': ({ value, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    el.className = value;
    send({ value: el.className });
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

  'Element.getInnerHTML': ({ ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    send({ value: el.innerHTML });
  },

  'Element.setInnerHTML': ({ value, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    el.innerHTML = value;
    send({});
    // send({ value: el.innerHTML });
  },

  'Element.getContentDocument': ({ ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    send({ ptr: el.contentDocument.ptr });
  },

  'Element.appendChild': ({ value, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    const valueEl = doc.getFromPtr(value);
    el.appendChild(valueEl);
    send({});
  },

  // todo: ensure document only, return values?
  'Document.open': ({ ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    el.open();
    send({});
  },

  'Document.write': ({ value, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    el.write(value);
    send({});
  },

  'Document.close': ({ ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    el.close();
    send({});
  },

  'Document.createElement': ({ value, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    const newEl = el.createElement(value);
    send({ ptr: newEl?.ptr });
  },

  'Document.createTextNode': ({ value, ptr }, send, doc) => {
    const el = doc.getFromPtr(ptr);
    const newEl = el.createTextNode(value);
    send({ ptr: newEl?.ptr });
  },

  'Document.ptr': ({}, send, doc) => {
    send({ ptr: doc.ptr });
  },

  'parent': async ({ prop, args }, send, doc) => {
    const parentInstance = instances[doc.parentDocument?.ptr];
    if (!parentInstance) return send({});

    const value = await run(parentInstance.name, doc.parentDocument, `${prop}(${args.join(',')})`);

    send({ value });
  },

  // todo: this is not subframe friendly and hacky global
  'location.getHref': ({}, send) => {
    send({ value: window._location.url });
  },

  'location.setHref': ({ value }, send, doc) => {
    const href = doc.page.resolve(value).toString();
    window.load(href);
    send({});
  },

  'alert': ({ msg }, send) => {
    alert(msg);
    send({});
  },

  'getBeganLoad': ({}, send) => {
    send({ value: window.beganLoad });
  }
};

const backends = {
  kiesel: 'engine/js/backends/kiesel.js',
  spidermonkey: 'engine/js/backends/spidermonkey.js',
  host: 'engine/js/backends/host.js'
};

const instances = {};

const SERIAL_RES_SIZE = 1024 * 1024 * 10;

export const stopAll = () => {
  for (const x in instances) {
    if (x.worker) {
      x.worker.onmessage = null;
      delete x.worker.onmessage;
      x.worker.terminate();
      x.worker = null;
      delete x.worker;
    }

    instances[x] = null;
    delete instances[x];
  }
};

export const stop = doc => {
  let backend = instances[doc.ptr];

  console.log('stop JS backend', doc.ptr);

  if (backend) {
    backend.worker.onmessage = null;
    delete backend.worker.onmessage;
    backend.worker.terminate();
    backend.worker = null;
    delete backend.worker;
  }

  instances[doc.ptr] = null;
  delete instances[doc.ptr];
};

const worldJS = await (await fetch('/engine/js/ipc/inside.js')).text();

export const run = (backendName, doc, _js) => new Promise(async resolve => {
  if (backendName === null || !_js) return resolve(null);

  if (window.crossOriginIsolated === false) {
    console.warn('not cross-origin isolated, giving up running JS');
    // alert(`due to browser restrictions, shadow has to use a service worker and reload once to be able to use some JS features which it requires for running JS (SharedArrayBuffer). try reloading`);
    return resolve(null);
  }

  let backend = instances[doc.ptr];

  if (!backend || backend.name !== backendName) {
    console.log('new JS backend', doc.ptr, backendName, Object.keys(instances).length);
    if (backend) {
      backend.worker.onmessage = () => {};
      backend.worker.terminate();
    }

    backend = {
      name: backendName,
      queue: [],
      handlers: {}
    };

    instances[doc.ptr] = backend;

    backend.worker = new Worker(backends[backendName], { type: 'module' });

    const lengthBuffer = new SharedArrayBuffer(4);
    const lengthTyped = new Int32Array(lengthBuffer);
    lengthTyped[0] = 0;

    const valueBuffer = new SharedArrayBuffer(SERIAL_RES_SIZE);
    const valueTyped = new Uint8Array(valueBuffer);

    const encoder = new TextEncoder('utf8');

    backend.worker.postMessage({ lengthBuffer, valueBuffer, js: worldJS });

    backend.worker.onmessage = e => {
      const msg = e.data;
      // if (msg.type !== 'wait') console.log('main recv', msg);
      if (backend.handlers[msg.type]) {
        backend.handlers[msg.type](msg);
      } else if (msg.f) {
        funcs[msg.f](msg, backend.send, doc);
      } else backend.send({});
    };

    backend.send = msg => {
      // if (msg.type) console.log('main send', msg);

      // const encodeBuffer = new Uint8Array(SERIAL_RES_SIZE);

      const json = JSON.stringify(msg);
      // encoder.encodeInto(json, encodeBuffer);

      const encodeBuffer = encoder.encode(json);

      for (let i = 0; i < encodeBuffer.length; i++) {
        Atomics.store(valueTyped, i, encodeBuffer[i]);
      }

      Atomics.store(lengthTyped, 0, encodeBuffer.length);
      Atomics.notify(lengthTyped, 0);
    };

    backend.on = (type, handler) => backend.handlers[type] = handler;

    backend.on('wait', async () => {
      if (backend.queue.length === 0) await new Promise(res => backend.queuePromiseRes = res);
      backend.queuePromiseRes = null;

      backend.send({ type: 'eval', js: backend.queue.pop() });
    });
  }

  const js = _js.slice().trim();
  backend.queue.push(js);

  if (backend.queuePromiseRes) backend.queuePromiseRes();

  backend.on('done', () => {
    backend.send({});
    backend.handlers.done = null;

    resolve();
  });
});