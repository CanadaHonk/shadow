// JS WORLD
const ipc = {
  send: msg => {
    msg.id = Math.random();
    if (globalThis.Kiesel) {
      Kiesel.print(msg, { pretty: true });
    } else {
      print(JSON.stringify(msg));
    }
  },

  recv: () => {
    if (globalThis.Kiesel) {
      return eval(Kiesel.readLine());
    } else {
      return JSON.parse(readline());
    }
  }
};

class Element {
  constructor(data) {
    Object.assign(this, data);
  }

  get textContent() {
    ipc.send({ f: 'Element.getTextContent', ptr: this.ptr });
    return ipc.recv().value;
  }

  set textContent(value) {
    ipc.send({ f: 'Element.setTextContent', value, ptr: this.ptr });
  }
}

globalThis.document = {
  querySelector(selector) {
    ipc.send({ f: 'document.querySelector', selector });
    const data = ipc.recv();

    return new Element(data);
  }
};