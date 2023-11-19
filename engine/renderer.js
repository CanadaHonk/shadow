let fpsFrameCount = 0, fpsLastUpdate = 0, fps = 0;
const fpsAcc = 1;
let lastFrame = performance.now();
let frame = 0;

let debug = 0;
let hoverEl, hoverLink;

window.scrollY = 0;

const renderScale = window.devicePixelRatio * 1;

let cWidth = window.innerWidth;
let cHeight = window.innerHeight;

export class Renderer {
  static {
    this.prototype.layout = null;
    this.prototype.lastRootPtr = 0;
  }

  constructor() {
    this.canvas = document.createElement('canvas');

    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';

    this.canvas.style.imageRendering = 'crisp-edges';

    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.ctx.imageSmoothingEnabled = false;

    this.canvas.style.width = cWidth + "px";
    this.canvas.style.height = cHeight + "px";
    this.canvas.width = cWidth * renderScale;
    this.canvas.height = cHeight * renderScale;

    this.ctx.scale(renderScale, renderScale);

    document.body.appendChild(this.canvas);

    const _update = this.update.bind(this);
    this.update = (() => {
      try {
        _update();
      } catch (e) {
        error(e);
        requestAnimationFrame(this.update);
      }
    }).bind(this);
    this.update();

    if (globalThis.node) {
      this.measureCanvas = this.canvas;
      this.measureCtx = this.ctx;
    }

    globalThis._renderer = this;
  }

  makeCanvas() {
    const el = document.createElement('canvas');
    return [ el, el.getContext('2d') ];
  }

  _measureTextCache = {};
  measureText(text, font) {
    if (text === '') return { width: 0, height: 0 };

    const key = text + font;
    if (this._measureTextCache[key]) return this._measureTextCache[key];

    if (!this.measureCanvas) {
      const [ el, ctx ] = this.makeCanvas();
      this.measureCanvas = el;
      this.measureCtx = ctx;
    }

    this.measureCtx.textAlign = 'left';
    this.measureCtx.textBaseline = 'baseline';
    this.measureCtx.font = font;
    const measure = this.measureCtx.measureText(text);

    return this._measureTextCache[key] = {
      width: measure.width,
      height: measure.height ?? (Math.abs(measure.fontBoundingBoxAscent) + Math.abs(measure.fontBoundingBoxDescent))
      // height: Math.abs(measure.actualBoundingBoxAscent) + Math.abs(measure.actualBoundingBoxDescent)
    };
  }

  update() {
    if (!this.layout) {
      requestAnimationFrame(this.update);
      return;
    }

    const frameTimeStart = performance.now();
    const deltaTime = frameTimeStart - lastFrame;

    this.ctx.fillStyle = this.layout.root.backgroundColor();
    this.ctx.fillRect(0, scrollY, cWidth, scrollY + cHeight);

    hoverLink = null;

    // console.log('wow');

    let cursor, hoverText = false;

    const inspects = [];

    this.ctx.textBaseline = 'bottom';
    const draw = _ => {
      if (_.display() === 'none') return;

      let x = _.x(), y = _.y(), width = _.width(), height = _.height();

      // only care about y (for now)
      const isOffscreen = y > (scrollY + cHeight) || (y + height) < scrollY;

      if (!isOffscreen && debug === 1 && _.tagName !== 'document') {
        if (lastMousePos[0] >= x && lastMousePos[0] <= (x + width) && (lastMousePos[1] + scrollY) >= y && (lastMousePos[1] + scrollY) <= (y + height)) {
          if (_.tagName !== '#text') {
            inspects.push(() => {
              this.ctx.fillStyle = `rgba(249, 204, 157, 0.5)`;

              this.ctx.fillRect(x - _.marginLeft(), y - _.marginTop(), width + _.marginLeft() + _.marginRight(), _.marginTop()); // top margin
              this.ctx.fillRect(x - _.marginLeft(), y + height, width + _.marginLeft() + _.marginRight(), _.marginBottom()); // bottom margin
              this.ctx.fillRect(x - _.marginLeft(), y, _.marginLeft(), height); // left margin
              this.ctx.fillRect(x + width, y, _.marginRight(), height); // right margin

              this.ctx.fillStyle = `rgba(195, 222, 183, 0.5)`;

              this.ctx.fillRect(x + _.paddingLeft(), y, width - _.paddingLeft() - _.paddingRight(), _.paddingTop()); // top padding
              this.ctx.fillRect(x + _.paddingLeft(), y + height - _.paddingBottom(), width - _.paddingLeft() - _.paddingRight(), _.paddingBottom()); // bottom padding
              this.ctx.fillRect(x, y, _.paddingLeft(), height); // left padding
              this.ctx.fillRect(x + width - _.paddingRight(), y, _.paddingRight(), height); // right padding

              this.ctx.fillStyle = `rgba(100, 100, 250, 0.5)`;
              this.ctx.fillRect(x + _.paddingLeft(), y + _.paddingTop(), width - _.paddingLeft() - _.paddingRight(), height - _.paddingTop() - _.paddingBottom());

              let infoY = y - _.marginTop(), infoAlignBottom = true;

              if (infoY < 20) {
                infoY = y + _.height() + _.marginBottom();
                infoAlignBottom = false;
              }

              this.infoBox(`${_.tagName} (x=${x},y=${y},w=${width},h=${height},tw=${_.totalWidth()},th=${_.totalHeight()})`, x - _.marginLeft(), infoY, infoAlignBottom);
            });
          }
        }
      }

      const bg = _.backgroundColor();
      if (!isOffscreen && bg) {
        this.ctx.fillStyle = bg;
        this.ctx.fillRect(x, y, width, height);
      }

      // this is not spec compliant lol
      if (!isOffscreen && _.display() === 'list-item') {
        const type = _.css()['list-style-type'];

        let marker;
        if (type === 'disc') marker = '• ';
        if (type === 'numeric') marker = `${_.parent.children.indexOf(_) + 1}. `;

        this.ctx.fillStyle = _.color();
        this.ctx.font = _.font();
        const measure = this.ctx.measureText(marker + '  ');

        this.ctx.fillText(marker, x - measure.width, y + (measure.height ?? (Math.abs(measure.fontBoundingBoxAscent) + Math.abs(measure.fontBoundingBoxDescent))));
      }

      if (!isOffscreen && _.tagName === '#text') {
        this.ctx.fillStyle = _.color();

        for (const c of _.textChunks()) {
          const { x, y, str, width, height } = c;
          switch (_.parent.css()['text-decoration']) {
            case 'underline':
              this.ctx.fillRect(x, y + height - 3, width, 1);
              break;
          }

          this.ctx.font = _.font();
          this.ctx.fillText(str, x, y + height);

          if (lastMousePos[0] >= x && lastMousePos[0] <= (x + width) && (lastMousePos[1] + scrollY) >= y && (lastMousePos[1] + scrollY) <= (y + height)) {
            hoverText = true;
            hoverEl = _.parent;

            const newCursor = _.parent.css().cursor;
            if (newCursor !== 'auto') cursor = newCursor;

            let parent = _.parent;
            while (parent) {
              if (parent.tagName === 'a') {
                hoverLink = parent;
                break;
              }
              parent = parent.parent;
            }
          }
        }
      }

      if (!isOffscreen && _.isImage() && _._image) {
        this.ctx.drawImage(_._image, x, y, width, height);

        if (lastMousePos[0] >= x && lastMousePos[0] <= (x + width) && (lastMousePos[1] + scrollY) >= y && (lastMousePos[1] + scrollY) <= (y + height)) {
          hoverEl = _;

          const newCursor = _.css().cursor;
          if (newCursor !== 'auto') cursor = newCursor;

          let parent = _.parent;
          while (parent) {
            if (parent.tagName === 'a') {
              hoverLink = parent;
              break;
            }
            parent = parent.parent;
          }
        }

        return;
      }

      if (_.tagName === 'html') {
        document.body.style.backgroundColor = this.ctx.fillStyle;
        // this.ctx.fillRect(x, y, width, height);
      }

      if (_.tagName === 'iframe') draw(_.contentDocument);

      for (const z of _.children) draw(z);
    };
    draw(this.layout);

    if (inspects.length > 0) inspects.pop()();
    if (hoverLink) this.infoBox(hoverLink.href, 0, scrollY + cHeight);

    cursor ??= hoverText ? 'text' : 'default';
    this.canvas.style.cursor = cursor;

    const frameTime = performance.now() - frameTimeStart;

    fpsFrameCount++;
    if (performance.now() > fpsLastUpdate + 1000 / fpsAcc) {
      fps = fpsFrameCount * fpsAcc;
      fpsLastUpdate = performance.now();
      fpsFrameCount = 0;
    }

    if (this.layout.root.ptr !== this.lastRootPtr) {
      this.lastRootPtr = this.layout.root.ptr;
      if (profile) {
        profile['first frame'] = performance.now() - frameTimeStart;
      }
    }

    if (debug > 1) {
      let graphX = cWidth - 300 - 8;
      let graphY = scrollY + 8;

      if (!this.ftData) this.ftData = [];
      if (this.ftData.length > 300) this.ftData.shift();
      this.ftData.push(frameTime);

      if (!this.dtData) this.dtData = [];
      if (this.dtData.length > 300) this.dtData.shift();
      this.dtData.push(deltaTime);

      let ftData = this.ftData;
      let dtData = this.dtData;

      this.ctx.fillStyle = `rgba(20, 24, 28, 0.5)`;
      this.ctx.fillRect(graphX, graphY, 300, 160);

      const target = deltaTime + frameTime;

      const scale = 8;

      this.ctx.fillStyle = `rgba(20, 250, 20, 0.1)`;
      this.ctx.fillRect(graphX, graphY + target * scale, 300, 160 - target * scale);

      this.ctx.font = '14px monospace';
      this.ctx.textBaseline = 'top';
      // this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.fillStyle = '#f0f4f8';

      const ftAvg = ftData.reduce((acc, x) => acc + x, 0) / ftData.length;

      const ftStartY = graphY + (160 - /* (ftData[0] + ftData[1] + ftData[2] + ftData[3] + ftData[4]) / 5 */ ftAvg * scale);

      this.ctx.fillText('t', graphX + 4, ftStartY - 18);
      this.ctx.fillText('ᶠ', graphX + 4 + 7, ftStartY - 11);

      this.ctx.font = '12px monospace';
      this.ctx.fillText(`${ftAvg.toFixed(2)}ms`, graphX + 24, ftStartY - 16);

      this.ctx.beginPath();

      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = 'rgba(0, 0, 250, 0.8)';
      this.ctx.moveTo(graphX, 160 - Math.min(160, ftData[0] * scale));
      for (let i = 0; i < ftData.length; i++) {
        // ctx.fillStyle = `rgba(0, 0, 0, 1)`;
        this.ctx.lineTo(graphX + i, graphY + (160 - Math.min(160, ftData[i] * scale)));
      }

      this.ctx.stroke();

      const dtAvg = dtData.reduce((acc, x) => acc + x, 0) / dtData.length;
      const dtStartY = graphY + (160 - /* (dtData[0] + dtData[1] + dtData[2] + dtData[3] + dtData[4]) / 5 */ dtAvg * scale);

      this.ctx.font = '14px monospace';
      this.ctx.fillText('Δt', graphX + 4, dtStartY - 18);

      this.ctx.font = '12px monospace';
      this.ctx.fillText(`${dtAvg.toFixed(2)}ms`, graphX + 24, dtStartY - 16);

      this.ctx.beginPath();
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = 'rgba(250, 0, 0, 0.8)';
      this.ctx.moveTo(graphX, 160 - Math.min(160, dtData[0] * scale));
      for (let i = 0; i < dtData.length; i++) {
        // ctx.fillStyle = `rgba(0, 0, 0, 1)`;
        this.ctx.lineTo(graphX + i, graphY + (160 - Math.min(160, dtData[i] * scale)));
      }

      this.ctx.stroke();
    }

    if (debug) {
      this.ctx.fillStyle = debug > 1 ? '#f0f4f8' : this.layout.colorAbs('CanvasText');
      this.ctx.font = 'normal normal 16px sans-serif';
      this.ctx.textBaseline = 'top';
      const str = `${fps}fps`;
      this.ctx.fillText(str, cWidth - this.ctx.measureText(str).width - 14, scrollY + 14);
    }

    if (debug === 2) {
      const text = `load profile:\n ` + Object.keys(profile).reduce((acc, x) => {
        if (x === 'start') return acc;

        return acc + `${x}: ${profile[x].toFixed(2)}ms\n ${x === 'total' ? '\n ' : ''}`;
      }, '');

      const width = 200;
      const height = 350;

      const x = cWidth - width - 8;
      const y = scrollY + 8 + 160 + 12;
      const padding = 4;

      this.ctx.fillStyle = 'rgba(20, 24, 28, 0.5)';
      this.ctx.fillRect(x, y, width, height);

      this.ctx.fillStyle = '#f0f4f8';
      this.fillWrapText('normal normal 14px sans-serif', text, width - padding * 2, x + padding, y + padding);
    }

    if (debug === 3) {
      if (!this.measursingMemory) {
        this.measuringMemory = true;
        performance.measureUserAgentSpecificMemory?.()?.then?.(x => {
          this.measuredMemory = x;
          this.measuringMemory = false;
        });
      }

      let text = 'measuring memory...';
      if (this.measuredMemory) {
        const mem = this.measuredMemory.breakdown.filter(x => x.bytes > 0).sort((a, b) => b.bytes - a.bytes);
        text = `memory usage:\n ` + mem.map(x => `${x.attribution[0]?.scope ?? '?'}/${x.types.join('-')} ${(x.bytes / 1024 / 1000).toFixed(2)}MB`.replace('DedicatedWorkerGlobalScope', 'Worker')).join('\n ');
        text += `\n total: ${(this.measuredMemory.bytes / 1024 / 1024).toFixed(2)}MB`;
      }

      const width = 200;
      const height = 350;

      const x = cWidth - width - 8;
      const y = scrollY + 8 + 160 + 12;
      const padding = 4;

      this.ctx.fillStyle = 'rgba(20, 24, 28, 0.5)';
      this.ctx.fillRect(x, y, width, height);

      this.ctx.fillStyle = '#f0f4f8';
      this.fillWrapText('normal normal 14px sans-serif', text, width - padding * 2, x + padding, y + padding);
    }

    frame++;
    lastFrame = performance.now();

    requestAnimationFrame(this.update);
  }

  infoBox(text, x = 0, y = 0, alignBottom = true) {
    this.ctx.font = 'normal normal 12px sans-serif';
    this.ctx.textBaseline = 'bottom';

    const boxPadding = 3;
    const boxPaddingX = Math.ceil(boxPadding * 1.25);
    const boxPaddingY = boxPadding;

    const measure = this.ctx.measureText(text);
    const boxHeight = measure.height ?? (Math.abs(measure.fontBoundingBoxAscent) + Math.abs(measure.fontBoundingBoxDescent) + boxPaddingY * 2);
    let boxY = y - (alignBottom ? boxHeight : 0);

    if (boxY > scrollY + cHeight) {
      boxY = scrollY + cHeight - boxHeight;
    }

    this.ctx.fillStyle = '#202124';
    this.ctx.fillRect(x, boxY, measure.width + boxPaddingX * 2, boxHeight);

    this.ctx.fillStyle = 'white';

    this.ctx.fillText(text, x + boxPaddingX, boxY + boxHeight - boxPaddingY);
  }

  wrapText(font, text, width) {
    if (!this.measureCanvas) {
      const [ el, ctx ] = this.makeCanvas();
      this.measureCanvas = el;
      this.measureCtx = ctx;
    }

    // todo: options lol
    this.measureCtx.font = font;

    let lines = [], line = 0;

    let wrapNext = false;
    for (const x of text.split(' ')) {
      // if (!x) continue;

      const oldLine = lines[line];
      lines[line] = (lines[line] !== undefined ? (lines[line] + ' ') : '') + (x ?? ' ');

      const measure = this.measureCtx.measureText(lines[line]);
      if (wrapNext || measure.width > width) {
        if (wrapNext) wrapNext = false;

        lines[line] = oldLine;
        line++;
        lines.push(x);
      }

      if (x.endsWith('\n')) wrapNext = true;
    }

    return lines;
  }

  measureWrapText(font, text, width) {

  }

  fillWrapText(font, text, width, x, y) {
    this.ctx.font = font;

    const lines = this.wrapText(font, text, width);
    for (const l of lines) {
      this.ctx.fillText(l, x, y);

      const measure = this.ctx.measureText(l);
      y += measure.height ?? (Math.abs(measure.fontBoundingBoxAscent) + Math.abs(measure.fontBoundingBoxDescent));
    }
  }
}

let lastMousePos = [ 0, 0 ];
document.onmousedown = e => {
  lastMousePos = [ e.clientX, e.clientY ];
  e.preventDefault();

  return false;
};

document.onmousemove = e => {
  lastMousePos = [ e.clientX, e.clientY ];
  e.preventDefault();
  return false;
};

document.onmouseup = e => {
  lastMousePos = [ e.clientX, e.clientY ];
  e.preventDefault();

  if (debug && hoverEl) {
    window.t = hoverEl;
  }

  if (hoverLink) {
    if (hoverEl.attrs.target === '_parent' || e.ctrlKey) window.open(hoverLink.href.toString(), '_blank');
      else window.load(hoverLink.href.toString());
  }

  if (hoverEl) {
    if (hoverEl.attrs.onclick) window._js.run(window._renderer.layout, hoverEl.attrs.onclick);
  }

  return false;
};

document.onkeydown = e => {
  // const k = e.key.toLowerCase();
};

document.onkeyup = async e => {
  const k = e.key.toLowerCase();
  if (k === 'z') {
    if (e.shiftKey) {
      debug = Math.max(2, (debug + 1) % 4);
    } else {
      if (debug) debug = 0;
        else debug = 1;
    }
  }

  if (k === 'x') {
    window.colorScheme = window.colorScheme === 'light' ? 'dark' : 'light';
    window._renderer?.layout?.invalidateCaches?.();
  }

  if (k === 'c') {
    const a = document.createElement('pre');
    a.textContent = window._doc.toString();
    document.body.appendChild(a);

    setTimeout(() => {
      document.querySelector('canvas').style.display = 'none';
    }, 100);
  }
  if (k === 'v') window.omniload(prompt('url to load:'));
  if (k === 'h') window.welcome();
  if (k === 'j') {
    const current = window._js.backendName;
    const backends = [ 'host', null, 'spidermonkey', 'kiesel' ];
    window._js.setBackend(backends[(backends.indexOf(current) + 1) % backends.length]);

    // reload page
    window.reload();
  }
  if (k === 'r') window.reload();
  if (k === 'p') {
    let url = _location.realURL;
    let openURL = url;

    if (url.startsWith('data:')) openURL = '';

    let win = window.open(openURL, '_blank');

    if (url.startsWith('data:')) {
      const data = await (await fetch(url)).text();
      win.document.write(data);
    }
  }
};

document.onwheel = e => {
  scrollY += e.deltaY;
  if (scrollY < 0) scrollY = 0;
  scrollY = Math.min(scrollY, Math.max(0, (window._renderer.layout?.totalHeight?.() || 0) - cHeight));

  window._renderer.ctx.setTransform(renderScale, 0, 0, renderScale, 0, -scrollY * renderScale);
};

window.onresize = x => {
  cWidth = window.innerWidth;
  cHeight = window.innerHeight;

  window._renderer.canvas.style.width = cWidth + "px";
  window._renderer.canvas.style.height = cHeight + "px";
  window._renderer.canvas.width = cWidth * renderScale;
  window._renderer.canvas.height = cHeight * renderScale;

  window._renderer.ctx.setTransform(renderScale, 0, 0, renderScale, 0, -scrollY * renderScale);

  if (x !== 'ignore_last') window._renderer.layout?.invalidateCaches?.();
};