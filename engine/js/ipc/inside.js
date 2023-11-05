// JS WORLD
if (typeof ipc === 'undefined') {
  globalThis.evalQueue = [];
  globalThis.ipc = {
    send: (msg, ignoreEval) => {
      print(JSON.stringify(msg));

      return ipc.recv(ignoreEval ?? true);
    },

    recv: (ignoreEval) => {
      while (true) {
        const read = readline();
        if (!read) continue;

        let msg;
        const str = readfile('/comm');

        if (str.startsWith('JS|')) msg = { type: 'eval', js: str.slice(3) };

        if (!msg) msg = JSON.parse(str);

        if (msg.type === 'eval') { // if eval
          evalQueue.push(msg); // push to queue
          if (ignoreEval) continue; // continue if ignoring
        }

        return msg;
      }
    }
  };

  globalThis.print = globalThis.Kiesel ? Kiesel.print : print;
  globalThis.sleep = globalThis.Kiesel ? Kiesel.sleep : ms => sleep(ms / 1000);
  globalThis.readline = globalThis.Kiesel ? Kiesel.readLine : readline;
  globalThis.readfile = globalThis.Kiesel ? Kiesel.readFile : os.file.readFile;
}

class Element {
  constructor(data) {
    Object.assign(this, data);
  }

  get className() {
    return ipc.send({ f: 'Element.getClassName', ptr: this.ptr }).value;
  }

  set className(value) {
    ipc.send({ f: 'Element.setClassName', value, ptr: this.ptr });
  }

  get textContent() {
    return ipc.send({ f: 'Element.getTextContent', ptr: this.ptr }).value;
  }

  set textContent(value) {
    ipc.send({ f: 'Element.setTextContent', value, ptr: this.ptr });
  }

  get innerHTML() {
    return ipc.send({ f: 'Element.getInnerHTML', ptr: this.ptr }).value;
  }

  set innerHTML(value) {
    ipc.send({ f: 'Element.setInnerHTML', value, ptr: this.ptr });
  }

  get contentDocument() {
    return new Element(ipc.send({ f: 'Element.getContentDocument', ptr: this.ptr }));
  }

  appendChild(value) {
    ipc.send({ f: 'Element.appendChild', value: value.ptr, ptr: this.ptr });
  }

  querySelector(selector) {
    return makeEl(ipc.send({ f: 'Element.querySelector', selector, ptr: this.ptr }));
  }

  getElementById(id) {
    return makeEl(ipc.send({ f: 'Element.getElementById', id, ptr: this.ptr }));
  }

  // todo: ensure document only, return values?
  open() {
    ipc.send({ f: 'Document.open', ptr: this.ptr });
  }

  write(value) {
    ipc.send({ f: 'Document.write', value, ptr: this.ptr });
  }

  close() {
    ipc.send({ f: 'Document.close', ptr: this.ptr });
  }

  createElement(value) {
    return makeEl(ipc.send({ f: 'Document.createElement', value, ptr: this.ptr }));
  }

  createTextNode(value) {
    return makeEl(ipc.send({ f: 'Document.createTextNode', value, ptr: this.ptr }));
  }
}

const makeEl = data => {
  if (!data.ptr) return null;
  return new Element(data);
};

globalThis.document = makeEl(ipc.send({ f: 'Document.ptr' }));

globalThis.alert = msg => {
  ipc.send({ f: 'alert', msg });
};

globalThis.parent = new Proxy({}, {
  get(target, prop) {
    // hack!! presume they want a function
    return (...args) => ipc.send({ f: 'parent', prop, args }).value;
  }
});

globalThis.window = globalThis;

Object.defineProperty(globalThis, 'location', {
  get() {
    const href = ipc.send({ f: 'location.getHref' }).value;

    // todo: setters here
    const obj = {
      toString: () => href,
      search: href.slice(href.indexOf('?'))
    };

    return obj;
  },

  // location = 'https://example.com'
  set(value) {
    ipc.send({ f: 'location.setHref', value });
  }
});

// todo: make our own modern-er impl of this. temporary as we have bigger problems atm lol.
/* Implementation of HTML Timers (setInterval/setTimeout) based on sleep.
 *
 * This file is provided under the following terms (MIT License):
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
function makeWindowTimer(target, sleep) {
  "use strict";

  var counter = 1,
      inCallback = false,
      // Map handle -> timer
      timersByHandle = {},
      // Min-heap of timers by time then handle, index 0 unused
      timersByTime = [ null ];

  /** Compares timers based on scheduled time and handle. */
  function timerCompare(t1, t2) {
      // Note:  Only need less-than for our uses
      return t1.time < t2.time ? -1 :
              (t1.time === t2.time && t1.handle < t2.handle ? -1 : 0);
  }

  /** Fix the heap invariant which may be violated at a given index */
  function heapFixDown(heap, i, lesscmp) {
      var j, tmp;

      j = i * 2;
      while (j < heap.length) {
          if (j + 1 < heap.length &&
                  lesscmp(heap[j + 1], heap[j]) < 0) {
              j = j + 1;
          }

          if (lesscmp(heap[i], heap[j]) < 0) {
              break;
          }

          tmp = heap[j];
          heap[j] = heap[i];
          heap[i] = tmp;
          i = j;
          j = i * 2;
      }
  }

  /** Fix the heap invariant which may be violated at a given index */
  function heapFixUp(heap, i, lesscmp) {
      var j, tmp;
      while (i > 1) {
          j = i >> 1;     // Integer div by 2

          if (lesscmp(heap[j], heap[i]) < 0) {
              break;
          }

          tmp = heap[j];
          heap[j] = heap[i];
          heap[i] = tmp;
          i = j;
      }
  }

  /** Remove the minimum element from the heap */
  function heapPop(heap, lesscmp) {
      heap[1] = heap[heap.length - 1];
      heap.pop();
      heapFixDown(heap, 1, lesscmp);
  }

  /** Create a timer and schedule code to run at a given time */
  function addTimer(code, delay, repeat, argsIfFn) {
      var handle, timer;

      if (typeof code !== "function") {
          code = String(code);
          argsIfFn = null;
      }
      delay = Number(delay) || 0;
      if (inCallback) {
          delay = Math.max(delay, 4);
      }
      // Note:  Must set handle after argument conversion to properly
      // handle conformance test in HTML5 spec.
      handle = counter;
      counter += 1;

      timer = {
          args: argsIfFn,
          cancel: false,
          code: code,
          handle: handle,
          repeat: repeat ? Math.max(delay, 4) : 0,
          time: new Date().getTime() + delay
      };

      timersByHandle[handle] = timer;
      timersByTime.push(timer);
      heapFixUp(timersByTime, timersByTime.length - 1, timerCompare);

      return handle;
  }

  /** Cancel an existing timer */
  function cancelTimer(handle, repeat) {
      var timer;

      if (timersByHandle.hasOwnProperty(handle)) {
          timer = timersByHandle[handle];
          if (repeat === (timer.repeat > 0)) {
              timer.cancel = true;
          }
      }
  }

  function clearInterval(handle) {
      cancelTimer(handle, true);
  }
  target.clearInterval = clearInterval;

  function clearTimeout(handle) {
      cancelTimer(handle, false);
  }
  target.clearTimeout = clearTimeout;

  function setInterval(code, delay) {
      return addTimer(
          code,
          delay,
          true,
          Array.prototype.slice.call(arguments, 2)
      );
  }
  target.setInterval = setInterval;

  function setTimeout(code, delay) {
      return addTimer(
          code,
          delay,
          false,
          Array.prototype.slice.call(arguments, 2)
      );
  }
  target.setTimeout = setTimeout;

  return function timerLoop(nonblocking) {
      var now, timer;

      // Note: index 0 unused in timersByTime
      while (timersByTime.length > 1) {
          timer = timersByTime[1];

          if (timer.cancel) {
              delete timersByHandle[timer.handle];
              heapPop(timersByTime, timerCompare);
          } else {
              now = new Date().getTime();
              if (timer.time <= now) {
                  inCallback = true;
                  try {
                      if (typeof timer.code === "function") {
                          timer.code.apply(undefined, timer.args);
                      } else {
                          eval(timer.code);
                      }
                  } finally {
                      inCallback = false;
                  }

                  if (timer.repeat > 0 && !timer.cancel) {
                      timer.time += timer.repeat;
                      heapFixDown(timersByTime, 1, timerCompare);
                  } else {
                      delete timersByHandle[timer.handle];
                      heapPop(timersByTime, timerCompare);
                  }
              } else if (!nonblocking) {
                  sleep(timer.time - now);
              } else {
                  return true;
              }
          }
      }

      return false;
  };
}

// hack: unspec queueMicrotask(f) = setTimeout(f, 0)
globalThis.queueMicrotask = f => setTimeout(f, 0);

const _performance = globalThis.performance;
globalThis.performance = {
  now() {
    let base;
    if (_performance) {
      base = _performance.now() + (_performance.timeOrigin || 0);
    } else {
      base = Date.now();
    }

    return base - this.timeOrigin;
  },

  get timeOrigin() {
    delete this.timeOrigin;
    return this.timeOrigin = ipc.send({ f: 'getBeganLoad' }).value;
  }
};

if (globalThis.setTimeout) {
  (async () => {
    while (true) {
      const reply = await ipc.sendAsync({ type: 'wait' }, false);
      let ret;
      try {
        ret = (0, eval)(reply.js);
      } catch (e) {
        console.warn('js eval error', e);
        ret = e;
      }

      ipc.send({ type: 'done' });
    }
  })();
} else {
  let timerLoop = makeWindowTimer(globalThis, sleep);

  ipc.send({ type: 'ready' });

  while (true) {
    timerLoop(true);

    ipc.send({ type: 'wait' }, false);

    if (evalQueue.length === 0) continue;

    let ret;
    try {
      // ret = (0, eval)(evalQueue.pop().js);
      ret = eval(evalQueue.pop().js);
    } catch (e) {
      ret = e;
    }

    ipc.send({ type: 'done', ret });
    // ipc.send({ type: 'done', ret });
  }
}