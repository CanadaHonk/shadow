let fpsFrameCount = 0, fpsLastUpdate = 0, fps = 0;
const fpsAcc = 1;
let lastFrame = performance.now();
let frame = 0;

let debug = false;
let hoverEl, hoverLink;

let scrollY = 0;

const renderScale = window.devicePixelRatio * 1;

let cWidth = window.innerWidth;
let cHeight = window.innerHeight;

export class Renderer {
  layout = null;

  constructor() {
    this.canvas = document.createElement('canvas');

    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = cWidth + "px";
    this.canvas.style.height = cHeight + "px";

    this.canvas.style.imageRendering = 'crisp-edges';

    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.ctx.imageSmoothingEnabled = false;

    this.canvas.width = cWidth * renderScale;
    this.canvas.height = cHeight * renderScale;

    this.ctx.scale(renderScale, renderScale);

    document.body.appendChild(this.canvas);

    const _update = this.update.bind(this);
    this.update = (() => {
      try {
        _update();
      } catch (e) {
        this.error(e);
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

    this.ctx.clearRect(0, scrollY, cWidth, scrollY + cHeight);

    hoverLink = null;

    // console.log('wow');

    let cursor, hoverText = false;

    const doLast = [], inspects = [];

    const draw = (_, depth = 0) => {
      if (_.display() === 'none') return;

      let x = _.x(), y = _.y(), width = _.width(), height = _.height();

      // if (_.tagName === 'h1') console.log({ x, y, width, height });

      if (depth >= 0 && !['document'].includes(_.tagName)) {
        // this.ctx.fillStyle = `rgba(0, 100, 0, ${(depth + 1) * 0.1})`;
        // this.ctx.fillRect(x, y, width, height);
        if (lastMousePos[0] >= x && lastMousePos[0] <= (x + width) && (lastMousePos[1] + scrollY) >= y && (lastMousePos[1] + scrollY) <= (y + height)) {
          if (_.tagName !== '#text') {
            if (debug) inspects.push(() => {
              // this.ctx.fillStyle = `rgba(0, ${_.tagName !== '#text' ? 200 : 0}, ${_.tagName === '#text' ? 200 : 0}, 0.2)`;

              this.ctx.fillStyle = `rgba(249, 204, 157, 0.5)`;

              this.ctx.fillRect(x, y - _.marginTop(), width, _.marginTop()); // top margin
              this.ctx.fillRect(x, y + height, width, _.marginBottom()); // bottom margin
              this.ctx.fillRect(x - _.marginLeft(), y, _.marginLeft(), height); // left margin
              this.ctx.fillRect(x + width, y, _.marginRight(), height); // right margin

              this.ctx.fillStyle = `rgba(195, 222, 183, 0.5)`;

              this.ctx.fillRect(x, y, width, _.paddingTop()); // top padding
              this.ctx.fillRect(x, y + height - _.paddingBottom(), width, _.paddingBottom()); // bottom padding
              this.ctx.fillRect(x, y, _.paddingLeft(), height); // left padding
              this.ctx.fillRect(x + width - _.paddingRight(), y, _.paddingRight(), height); // right padding

              this.ctx.fillStyle = `rgba(100, 100, 250, 0.5)`;
              this.ctx.fillRect(x + _.paddingLeft(), y + _.paddingTop(), width - _.paddingLeft() - _.paddingRight(), height - _.paddingTop() - _.paddingBottom());

              this.infoBox(`${_.tagName} (x=${x},y=${y},w=${width},h=${height},tw=${_.totalWidth()},th=${_.totalHeight()})`, x - _.marginLeft(), y - _.marginTop());
            });

            hoverEl = _;

            const newCursor = _.css().cursor;
            if (newCursor !== 'auto') cursor = newCursor;
          } else hoverText = true;

          // tooltip info in bottom left
          if (_.tagName === 'a') {
            hoverLink = _;
            doLast.push(() => {
              this.infoBox(_.href, 0, scrollY + cHeight);
            });
          }
        }
      }

      const bg = _.backgroundColor();
      if (bg) {
        this.ctx.fillStyle = bg;
        this.ctx.fillRect(x, y, width, height);
      }

      if (_.tagName === '#text') {
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillStyle = _.color();

        switch (_.parent.css()['text-decoration']) {
          case 'underline':
            this.ctx.fillRect(x, y + height - 3, width, 1);
            break;
        }

        this.ctx.font = _.font();
        this.ctx.fillText(_.displayContent(), x, y + height);
      }

      if (_.tagName === 'img' && _._image) {
        this.ctx.drawImage(_._image, x, y, width, height);
      }

      if (_.tagName === 'html') {
        this.canvas.style.backgroundColor = this.ctx.fillStyle;
        // this.ctx.fillRect(x, y, width, height);
      }

      for (const z of _.children) draw(z, depth + 1);
    };
    draw(this.layout);

    for (const x of doLast) x();
    if (inspects.length > 0) inspects.pop()();

    fpsFrameCount++;
    if (performance.now() > fpsLastUpdate + 1000 / fpsAcc) {
      fps = fpsFrameCount * fpsAcc;
      fpsLastUpdate = performance.now();
      fpsFrameCount = 0;
    }

    cursor ??= hoverText ? 'text' : 'default';

    this.canvas.style.cursor = cursor;

    if (debug || true) {
      this.ctx.fillStyle = this.layout.colorAbs('CanvasText');
      this.ctx.font = 'normal 16px sans-serif';
      this.ctx.textBaseline = 'top';
      const str = `${fps}fps`;
      this.ctx.fillText(str, cWidth - this.ctx.measureText(str).width - 12, scrollY + 12);
    }

    frame++;
    lastFrame = performance.now();

    requestAnimationFrame(this.update);
  }

  infoBox(text, x = 0, y = 0) {
    this.ctx.font = 'normal 12px sans-serif';
    this.ctx.textBaseline = 'bottom';

    const boxPadding = 2;

    const measure = this.ctx.measureText(text);
    const boxHeight = measure.height ?? (Math.abs(measure.fontBoundingBoxAscent) + Math.abs(measure.fontBoundingBoxDescent) + boxPadding * 2);
    const boxY = y - boxHeight;

    this.ctx.fillStyle = '#202124';
    this.ctx.fillRect(x, boxY, measure.width + boxPadding * 4, boxHeight);

    this.ctx.fillStyle = 'white';

    this.ctx.fillText(text, x + boxPadding * 2, boxY + boxPadding + boxHeight - boxPadding * 2);
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

  error(e) {
    console.error(e);

    let title = 'Fatal error';
    if (e.stack.includes('HTMLParser')) title = 'HTML parser error';
    if (e.stack.includes('CSSParser')) title = 'CSS parser error';
    if (e.stack.includes('Render')) title = 'Render error';
    if (e.stack.includes('Layout')) title = 'Layout error';

    let detail = e.stack;

    this.layout = null;

    this.ctx.fillStyle = '#04080b';
    this.ctx.fillRect(0, scrollY, cWidth, cHeight + scrollY);

    const width = 600;
    const height = 400;

    const x = (cWidth - width) / 2;
    const y = (cHeight - height) / 2;

    const borderWidth = 4;

    this.ctx.strokeStyle = 'rgb(250, 40, 40)';
    this.ctx.lineWidth = borderWidth;
    this.ctx.fillStyle = 'rgb(20, 24, 28)';

    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.fillStyle = 'rgb(250, 40, 40)';
    this.ctx.font = '900 24px monospace';
    const measure = this.ctx.measureText(title);
    this.ctx.fillText(title, x + (width - measure.width) / 2, y + 60);

    const padding = 20;
    this.ctx.fillStyle = '#c0c4c8';
    this.ctx.font = 'normal 14px monospace';
    // this.ctx.textAlign = 'center';
    this.fillWrapText(this.ctx.font, detail, width - padding * 2, x + padding, y + 100);
    // this.fillWrapText(this.ctx.font, detail, width - padding * 2, x + padding + (width - padding * 2) / 2, y + 200);
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

  if (hoverLink) {
    if (hoverEl.attrs.target === '_parent' || e.ctrlKey) window.open(hoverEl.href.toString(), '_blank');
      else window.load(hoverEl.href.toString());
  }

  return false;
};

document.onkeydown = e => {
  const k = e.key.toLowerCase();
  if (k === 'z') debug = true;
};

document.onkeyup = e => {
  const k = e.key.toLowerCase();
  if (k === 'z') debug = false;
  if (k === 'x') window.colorScheme = window.colorScheme === 'light' ? 'dark' : 'light';
  if (k === 'c') {
    const a = document.createElement('pre');
    a.textContent = window._doc.toString();
    document.body.appendChild(a);

    setTimeout(() => {
      document.querySelector('canvas').style.display = 'none';
    }, 100);
  }
  if (k === 'v') window.load(prompt('url to load:'));
};

document.onwheel = e => {
  scrollY += e.deltaY;
  if (scrollY < 0) scrollY = 0;
  scrollY = Math.min(scrollY, window._renderer.layout.totalHeight() - cHeight);

  window._renderer.ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  window._renderer.ctx.translate(0, -scrollY);
};