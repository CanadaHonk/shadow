// JS WORLD
const evalQueue = [];
const ipc = {
  send: (msg, ignoreEval) => {
    msg.id = Math.random();
    if (globalThis.Kiesel) {
      Kiesel.print(msg, { pretty: true });
    } else {
      print(JSON.stringify(msg));
    }

    return ipc.recv(ignoreEval ?? true);
  },

  recv: (ignoreEval) => {
    while (true) {
      const str = globalThis.Kiesel ? Kiesel.readLine() : readline();
      if (!str) continue;

      const msg = JSON.parse(str);

      // if eval
      if (msg.type === 'eval') {
        evalQueue.push(msg); // push to queue
        if (ignoreEval) continue; // continue if ignoring
      }

      return msg;
    }
  }
};

class Element {
  constructor(data) {
    Object.assign(this, data);
  }

  get textContent() {
    return ipc.send({ f: 'Element.getTextContent', ptr: this.ptr }).value;
  }

  set textContent(value) {
    ipc.send({ f: 'Element.setTextContent', value, ptr: this.ptr });
  }
}

globalThis.document = {
  querySelector(selector) {
    const data = ipc.send({ f: 'document.querySelector', selector });

    return new Element(data);
  }
};

globalThis.alert = msg => {
  ipc.send({ f: 'alert', msg });
};

globalThis.window = globalThis;

ipc.send({ type: 'ready' });

while (true) {
  // console.log('before wait');
  ipc.send({ type: 'wait' }, false);
  // console.log('after wait');

  if (evalQueue.length === 0) continue;

  // while (evalQueue.length === 0) console.log('while no eval queue') || ipc.recv(false);

  // console.log('evaling');

  const ret = eval(evalQueue.pop().js);
  ipc.send({ type: 'done', ret });
}