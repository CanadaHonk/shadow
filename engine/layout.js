import { Node } from './dom.js';
import { CSSParser, SelectorType } from './cssparser.js';

const uaRaw = globalThis.node ? (await import('fs')).readFileSync(globalThis.uaPath, 'utf8') : await (await fetch('engine/ua.css')).text();
const uaRules = new CSSParser().parse(uaRaw);

const defaultProperties = {
  display: 'inline',

  width: 'auto',
  height: 'auto',

  cursor: 'auto',

  'font-family': '',
  'font-size': '1em',
  'font-style': 'normal',
  'font-weight': 'normal',

  'white-space': 'normal',

  'margin-top': '0px',
  'margin-bottom': '0px',
  'margin-left': '0px',
  'margin-right': '0px',

  'padding-top': '0px',
  'padding-bottom': '0px',
  'padding-left': '0px',
  'padding-right': '0px',

  // css 1.0 says 'medium' but wtf?
  'border-top-width': '0px',
  'border-bottom-width': '0px',
  'border-left-width': '0px',
  'border-right-width': '0px',
};

const inheritedProperties = [ "azimuth", "border-collapse", "border-spacing", "caption-side", "color", "cursor", "direction", "elevation", "empty-cells", "font-family", "font-style", "font-variant", "font-weight", "font", "letter-spacing", "line-height", "list-style-image", "list-style-position", "list-style-type", "list-style", "orphans", "pitch-range", "pitch", "quotes", "richness", "speak-header", "speak-numeral", "speak-punctuation", "speak", "speech-rate", "stress", "text-align", "text-indent", "text-transform", "visibility", "voice-family", "volume", "white-space", "widows", "word-spacing" ];

// eg: font-size -> fontSize
const propToFunc = x => x.replace(/\-[a-z]/g, _ => _[1].toUpperCase());

// window.colorScheme = 'light';
window.colorScheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// uh yeah this is just a constant :)
const defaultFontSize = 16; // px

export class LayoutNode extends Node {
  renderer = null;
  constructor(node, renderer) {
    super();
    Object.assign(this, { ...node, renderer });

    const cache = k => {
      const f = this[k].bind(this);
      let cached;
      this[k] = function() {
        if (cached) return cached;
        return cached = f.apply(this, arguments);
      }.bind(this);
    };

    // cache('x'); cache('y'); cache('width'); cache('height');

    if (this.tagName === 'img') this.image();
  }

  // what are our css properties?
  _cssCache = null;
  css() {
    if (this._cssCache) return this._cssCache;

    const docRules = this.document.cssRules;
    const rules = uaRules.concat(docRules);

    // basic inheritance
    let inherited = {};
    let parent = this.parent;
    while (parent) {
      const css = parent.css();
      for (const x of inheritedProperties) {
        if (!inherited[x] && css[x]) inherited[x] = css[x];
      }

      parent = parent.parent;
    }

    // apply css rules
    let props = { ...defaultProperties, ...inherited };

    for (const x of rules) {
      for (const y of x.selectors) { // a, b, c (a OR b OR c)
        let match = true;
        for (const z of y) { // a#b.c (a AND b AND c)
          if (
            !(z.type === SelectorType.Tag && this.tagName === z.text) && // tag
            !(z.type === SelectorType.Id && this.id === z.text) && // id
            !(z.type === SelectorType.Class && this.hasClass(z.text)) // class
          ) {
            match = false;
            break;
          }
        }

        if (match) {
          props = {
            ...props,
            ...x.properties
          };

          break;
        }
      }
    }

    // N shorthand hack
    if (props.margin) {
      props['margin-top'] = props['margin-bottom'] = props['margin-left'] = props['margin-right'] = props.margin;
    }

    if (this.tagName === 'font') {
      if (this.attrs.color) props.color = this.attrs.color;
    }

    // probably should do jit?
    /* for (const x in props) {
      props[x] = this.resolveValue(props[x]);
    } */

    // if (this.tagName === 'p') console.log(props);

    return this._cssCache = props;

    // possible optimizations for later:
    //   - reorder selectors internally from least to most likely
    //     eg span > .cool > #wow -> #wow > .cool > span
  }

  // run functions, etc (probably a better name?)
  resolveValue(x) {
    if (!x) return x;

    return x.replace(/([a-z-]+)\((.*)\)/ig, (_, func, rawArgs) => {
      const args = this.resolveValue(rawArgs).split(',').map(x => x.trim());

      switch (func) {
        case 'light-dark': return args[colorScheme === 'light' ? 0 : 1];
      }

      return _;
    });
  }

  display() {
    // if (this.tagName === '#text') return 'inline';
    return this.css().display;
  }

  displayContent() {
    const findTextNode = x => {
      if (!x) return undefined;
      if (x.tagName === '#text') return x;

      for (const y of x.children) {
        const o = findTextNode(y);
        if (o) return o;
      }
    };

    switch (this.css()['white-space']) {
      case 'normal':
        let content = this.content;
        let trimStart = false, trimEnd = false;

        if (true) {
          let lastText;
          let x = this;
          while (x.parent) {
            for (let i = x.parent.children.indexOf(x) - 1; i >= 0; i--) {
              const y = x.parent.children[i];
              const o = findTextNode(y);
              if (o) {
                lastText = o;
                break;
              }
            }

            if (lastText) break;

            x = x.parent;
          }

          let nextText;
          x = this;
          while (x.parent) {
            for (let i = x.parent.children.indexOf(x) + 1; i < x.parent.children.length; i++) {
              const y = x.parent.children[i];
              const o = findTextNode(y);
              if (o) {
                nextText = o;
                break;
              }
            }

            if (nextText) break;

            x = x.parent;
          }

          trimStart = lastText && lastText.content.trimEnd() !== lastText.content;
          trimEnd = nextText && nextText.content.trimStart() !== nextText.content;
        }

        if (this.parent.isBlock() && this.parent.children.indexOf(this) === 0) trimStart = true;
        if (this.parent.isBlock() && this.parent.children.indexOf(this) === this.parent.children.length - 1) trimEnd = true;

        if (trimStart) content = content.trimStart();
        if (trimEnd) content = content.trimEnd();

        content = content.replaceAll('&gt;', '>').replaceAll('&lt;', '<')

        return content.replace(/[\t\n\r]/g, ' ').replace(/ {2,}/g, ' ');

      case 'pre':
        return this.content;
    }
  }

  isBlock() {
    return this.display() === 'block' || this.display() === 'list-item';
  }
  isInline() {
    return this.display() === 'inline';
  }

  // technically <length-percentage> but uhm yeah
  lengthAbs(i, property) {
    const x = this.resolveValue(i);

    if (property === 'font-size') {
      // :/
      switch (x) {
        case 'xx-small': return defaultFontSize * (3/5);
        case 'x-small': return defaultFontSize * (3/4);
        case 'small': return defaultFontSize * (8/9);
        case 'medium': return defaultFontSize * (1);
        case 'large': return defaultFontSize * (6/5);
        case 'x-large': return defaultFontSize * (3/2);
        case 'xx-large': return defaultFontSize * (2/1);
        case 'xxx-large': return defaultFontSize * (3/1);

        // not specified exactly :(
        case 'smaller': return this.parent.fontSize() * (5/6);
        case 'larger': return this.parent.fontSize() * (6/5);
      }
    }

    let val = '', unit = '';

    for (const c of x) {
      if (c >= 'a' || c === '%') {
        unit += c;
      } else val += c;
    }

    val = parseFloat(val);

    switch (unit) {
      case 'px': return val;

      case '%':
        // (val / 100) * parent property value
        return this.parent[propToFunc(property)] * (val / 100);

      case 'em':
        if (property === 'font-size') {
          // val * parent font size
          return this.parent.fontSize() * val;
        }

        // val * node font size
        return this.fontSize() * val;
    }
  }

  horizontalSpace(margin = false) {
    // todo: box-sizing
    return (margin ? (this.marginLeft() + this.marginRight()) : 0) + this.paddingLeft() + this.paddingRight() + this.borderLeftWidth() + this.borderRightWidth();
  }

  verticalSpace(margin = false) {
    // todo: box-sizing
    return (margin ? (this.marginTop() + this.marginBottom()) : 0) + this.paddingTop() + this.paddingBottom() + this.borderTopWidth() + this.borderBottomWidth();
  }

  contentWidth() {
    if (this.tagName === 'document') return this.renderer.canvas.width;

    // manually set width
    if (this.css().width !== 'auto') {
      return this.lengthAbs(this.css().width, 'width');
    }

    if (this.tagName === 'img') return this._image?.width ?? 0;

    if (this.isBlock()) {
      // take up as much as we can?
      return this.parent.contentWidth() - this.horizontalSpace(true);
    }

    // todo: this presumes everything is just on one row !!
    // how the heck to fix?

    let width = 0;
    for (const x of this.children) {
      width += x.width();
    }
    return width;

    // take up our content width
    // todo: children (!!!!)

    // text
  }

  contentHeight() {
    // if (this.tagName === 'div') console.log(this.css().height);
    // manually set width
    if (this.css().height !== 'auto') {
      return this.lengthAbs(this.css().height, 'height');
    }

    if (this.tagName === 'img') return this._image?.height ?? 0;

    if (true) {
    // if (this.isBlock()) {
      // min content?

      // todo: this presumes everything is just on one column !!
      // how the heck to fix?

      let height = 0, inlineBlock = 0;
      for (const x of this.children) {
        if (x.isBlock()) {
          if (inlineBlock) {
            height += inlineBlock;
            inlineBlock = 0;
          }

          height += x.height();
        }

        if (x.isInline()) inlineBlock = Math.max(inlineBlock, x.height());
      }

      if (inlineBlock) {
        height += inlineBlock;
        inlineBlock = 0;
      }

      return height;
    }
  }

  width() {
    if (this.display() === 'none') return 0;

    // todo: min-width and max-width lol
    if (this.tagName === '#text') return this.renderer.measureText(this.displayContent(), this.parent.font()).width;

    return this.contentWidth() + this.horizontalSpace();
  }

  height() {
    if (this.display() === 'none') return 0;

    if (this.tagName === '#text') return this.renderer.measureText(this.displayContent(), this.parent.font()).height;

    return this.contentHeight() + this.verticalSpace();
  }

  x() {
    if (!this.parent) return 0;

    let x = this.marginLeft();
    if (this.siblingBefore && this.siblingBefore.isInline() && this.isInline()) {
      x += this.siblingBefore.x();
      x += this.siblingBefore.width() + this.siblingBefore.marginRight();
    } else {
      x += this.parent.x();
      x += this.parent.paddingLeft();
    }

    // if (this.siblingBefore?.tagName === 'a' && this.siblingBefore.children[0]?.content?.includes?.('hyper')) console.log(x, this.isInline());

    return x;
  }

  get visibleSiblingBefore() {
    let x = this.siblingBefore;
    while (x && x.height() === 0) {
      x = x.siblingBefore;
    }

    return x;
  }

  y() {
    if (!this.parent) return 0;

    /*
    let y = this.parent.y();

    y += this.parent.marginTop();

    for (const x of this.previousSiblings) {
      if (x.isBlock()) {
        y += x.height();

        if (x.marginTop() >= x.siblingBefore?.marginBottom?.()) y -= x.siblingBefore.marginBottom();
      }
    } */

    // if (this.tagName === 'img' && this.attrs.src === 'banner2.png') console.log(this.parent.marginTop());

    let y = this.marginTop();
    if (this.siblingBefore) {
      y += this.siblingBefore.y();
      if (this.isBlock() || this.siblingBefore.isBlock()) y += this.siblingBefore.height() + this.siblingBefore.marginBottom();
    } else {
      y += this.parent.y();
      y += this.parent.paddingTop();
    }

    // basic collapsing margin
    // if (this.id === 't') console.log(this.marginTop(), this.siblingBefore?.marginBottom?.());
    if (this.marginTop() >= this.siblingBefore?.marginBottom?.()) y -= this.siblingBefore.marginBottom();

    // ??
    if (this.siblingBefore?.marginBottom?.() > this.marginTop()) y -= this.marginTop();

    // ??
    // if (this.tagName === 'h1') console.log(y, this.marginTop(), this.parent.marginTop());
    if (!this.siblingBefore && this.marginTop() >= this.parent.marginTop()) {
      // y = this.parent.marginTop() - this.marginTop();
      y -= this.marginTop();
      y += this.parent.marginTop();
    }

    return y;
  }

  font() {
    return `${this.css()['font-style']} ${this.css()['font-weight']} ${this.fontSize()}px ${this.css()['font-family']}`;
  }

  colorAbs(i) {
    const x = this.resolveValue(i);
    switch (x) {
      case 'Canvas': return colorScheme === 'dark' ? '#121212' : '#ffffff';
      case 'CanvasText': return colorScheme === 'dark' ? '#ffffff' : '#000000';
    }

    return x;
  }

  color() {
    return this.colorAbs(this.css().color);
  }

  backgroundColor() {
    return this.colorAbs(this.css()['background-color']);
  }

  _image;
  async image() {
    if (this._image !== undefined) return this._image;

    this._image = null;

    const data = await (await this.document.page.fetch(this.attrs.src)).arrayBuffer();

    const blob = new Blob([ new Uint8Array(data) ]);

    this._image = new Image();
    this._image.src = URL.createObjectURL(blob);

    this._image.style.display = 'none';
    document.body.appendChild(this._image);

    return this._image;
  }

  marginTop() {
    return this.lengthAbs(this.css()['margin-top'], 'margin-top');
  }
  marginBottom() {
    return this.lengthAbs(this.css()['margin-bottom'], 'margin-bottom');
  }
  marginLeft() {
    return this.lengthAbs(this.css()['margin-left'], 'margin-left');
  }
  marginRight() {
    return this.lengthAbs(this.css()['margin-right'], 'margin-right');
  }

  borderTopWidth() {
    return this.lengthAbs(this.css()['border-top-width'], 'border-top-width');
  }
  borderBottomWidth() {
    return this.lengthAbs(this.css()['border-bottom-width'], 'border-bottom-width');
  }
  borderLeftWidth() {
    return this.lengthAbs(this.css()['border-left-width'], 'border-left-width');
  }
  borderRightWidth() {
    return this.lengthAbs(this.css()['border-right-width'], 'border-right-width');
  }

  paddingTop() {
    return this.lengthAbs(this.css()['padding-top'], 'padding-top');
  }
  paddingBottom() {
    return this.lengthAbs(this.css()['padding-bottom'], 'padding-bottom');
  }
  paddingLeft() {
    return this.lengthAbs(this.css()['padding-left'], 'padding-left');
  }
  paddingRight() {
    return this.lengthAbs(this.css()['padding-right'], 'padding-right');
  }

  fontSize() {
    if (this.tagName === '#text') return this.parent.fontSize();

    return this.lengthAbs(this.css()['font-size'], 'font-size');
  }

  invalidateCaches() {
    super.invalidateCaches();

    this._cssCache = null;
  }
}

export const constructLayout = (document, renderer) => {
  const assembleLayoutNodes = x => {
    const a = new LayoutNode(x, renderer);
    a.children = a.children.map(y => assembleLayoutNodes(y));

    for (const y of a.children) {
      y.parent = a;
    }

    return a;
  };

  const doc = assembleLayoutNodes(document);

  const reSetDoc = x => {
    x.document = doc;
    for (const y of x.children) reSetDoc(y);
  };
  reSetDoc(doc);

  const removeDeadTextNodes = x => {
    // if (x.tagName === '#text' && x.displayContent() === '') {
    // if (x.tagName === '#text' && x.parent.tagName === 'body') console.log(x.content, x.content.trim() === '');
    if (x.tagName === '#text' && x.content.trim() === '') {
      if (x.content.length > 0 && x.siblingAfter && x.siblingBefore?.isInline?.() && x.siblingAfter.isInline()) {
        const t = x.siblingAfter.textNode();
        if (t && !t.content.startsWith(' ')) t.content = ' ' + t.content;
      }

      x.remove();
    }

    for (const y of x.children.slice()) removeDeadTextNodes(y);
  }
  removeDeadTextNodes(doc);

  return doc;
};