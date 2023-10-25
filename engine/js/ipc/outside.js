const insideJS = await (await fetch('engine/js/ipc/inside.js')).text();

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
  }
};

export const run = async (backend, doc, _js) => {
  const js = insideJS + '\n\n' + _js.slice();
  let send;

  await backend.run(js, msg => {
    // console.log('recv', msg);
    funcs[msg.f](msg, send, doc);
  },
  fs => {
    send = msg => {
      // console.log('send', msg);
      fs.appendFileSync('/dev/stdin', JSON.stringify(msg) + '\n');
    };
  })
};