import { Node } from './dom.js';
import { CSSParser, CSSRule, SelectorType, CombinatorType } from './cssparser.js';
import { HTMLParser } from './htmlparser.js';

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

const byPtr = {};
export class LayoutNode extends Node {
  renderer = null;

  cache = {};
  constructor(node, renderer) {
    super();
    Object.assign(this, { ...node, renderer });

    this.ptr = parseInt(Math.random().toString().slice(2, 12));
    byPtr[this.ptr] = this;

    const cache = k => {
      const f = this[k].bind(this);

      this[k] = function() {
        if (this.cache[k]) return this.cache[k];
        return this.cache[k] = f.apply(this, arguments);
      }.bind(this);
    };

    cache('x'); cache('y'); cache('width'); cache('height');
    // cache('display'); cache('isBlock'); cache('isInline');
    // cache('contentWidth'); cache('contentHeight');
    // cache('totalWidth'); cache('totalHeight');

    if (this.tagName === 'img') this.image();
  }

  getFromPtr(ptr) {
    return byPtr[ptr];
  }

  testCSSConditions(conds) {
    for (const x of conds) { // a#b.c (a AND b AND c)
      if (
        !(x.type === SelectorType.Tag && this.tagName === x.text) && // tag
        !(x.type === SelectorType.Id && this.id === x.text) && // id
        !(x.type === SelectorType.Class && this.hasClass(x.text)) && // class
        !(x.type === SelectorType.Universal) // universal (*)
      ) return false;
    }

    return true;
  }

  // selectors (a, b, c)
  //  combinators (a b > c)
  //   conditions (a#bc)
  //    condition (#b)
  matchesCSS(selectors) {
    let target = this;

    selectorLoop: for (const _combs of selectors) { // a, b, c (a OR b OR c)
      // reverse so:
      //   a > b > c (parent --> child)
      // becomes:
      //   c > b > a (child --> parent)

      let combs = _combs.slice().reverse(); // slow!
      const first = combs.shift();

      if (!this.testCSSConditions(first.conds)) continue;

      let lastCType = first.type;
      target = target.parent;
      combCheck: for (const comb of combs) {  // c > b a
        parentCheck: while (target) {
          switch (lastCType) {
            case CombinatorType.Descendant: { // a b
              const match = target.testCSSConditions(comb.conds);
              lastCType = comb.type;

              target = target.parent;
              if (match) continue combCheck; // this parent matches, go to next comb

              continue parentCheck;
            }

            case CombinatorType.Child: { // a > b (direct child)
              const match = target.testCSSConditions(comb.conds);
              if (!match) continue selectorLoop; // these combs will not match

              lastCType = comb.type;
              target = target.parent;
              continue combCheck;
            }
          }
        }

        // no parent matched this comb
        // these combs will not match
        continue selectorLoop;
      }

      return true;
    }

    return false;
  }

  querySelector(text) {
    const selector = CSSRule.parseSelector(text);

    const find = x => {
      if (x.matchesCSS(selector)) return x;

      for (const y of x.children) {
        const o = find(y);
        if (o) return o;
      }
    };
    return find(this);
  }

  // parse a [ b [ c [ d ] ] ] shorthand (eg margin, padding) into [top, bottom, left, right]
  parse4Shorthand(x) {
    x = this.resolveValue(x);
    const spl = x.split(' ').filter(x => x);

    switch (spl.length) {
      case 1: return [ spl[0], spl[0], spl[0], spl[0] ];
      case 2: return [ spl[0], spl[0], spl[1], spl[1] ];
      case 3: return [ spl[0], spl[2], spl[1], spl[1] ];
      case 4: return spl;
    }
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

    if (this.tagName === '#text') return this._cssCache = props;

    for (const x of rules) {
      if (this.matchesCSS(x.selectors)) {
        props = {
          ...props,
          ...x.properties
        };
      }
    }

    if (this.tagName === 'font') {
      if (this.attrs.color) props.color = this.attrs.color;
    }

    if (props.margin) {
      const [ marginTop, marginBottom, marginLeft, marginRight ] = this.parse4Shorthand(props.margin);

      // todo: this does not follow specificity lol
      props['margin-top'] = marginTop;
      props['margin-bottom'] = marginBottom;
      props['margin-left'] = marginLeft;
      props['margin-right'] = marginRight;
    }

    if (props.padding) {
      const [ paddingTop, paddingBottom, paddingLeft, paddingRight ] = this.parse4Shorthand(props.padding);

      // todo: this does not follow specificity lol
      props['padding-top'] = paddingTop;
      props['padding-bottom'] = paddingBottom;
      props['padding-left'] = paddingLeft;
      props['padding-right'] = paddingRight;
    }

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
    if (this.tagName === 'noscript' && this.attrs.dynamic) return window._js.backendName ? 'none' : 'inline';

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

        content = content.replaceAll('&gt;', '>').replaceAll('&lt;', '<');

        return content.replace(/[\t\n\r]/g, ' ').replace(/ {2,}/g, ' ').replaceAll('&nbsp;', ' ');

      case 'pre':
        return this.content;
    }
  }

  isBlock() {
    // if we have block children with width: auto, become block
    if (this.children.some(x => x.isBlock() && x.css().width === 'auto')) return true;

    return this.display() === 'block' || this.display() === 'list-item';
  }
  isInline() {
    return !this.isBlock();
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

    unit ||= 'px';

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

  collapseVerticalMargin(y) {
    if (this.marginTop() >= this.siblingBefore?.marginBottom?.()) y -= this.siblingBefore.marginBottom();

    // ??
    if (this.siblingBefore?.marginBottom?.() > this.marginTop()) y -= this.marginTop();

    // ??
    if (!this.siblingBefore && this.parent && this.marginTop() >= this.parent.marginTop()) {
      y -= this.marginTop();
      y += this.parent.marginTop();
    }

    return y;
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

    let width = 0;
    for (const x of this.children) {
      width += x.width();
    }
    return width;
  }

  contentHeight() {
    // if (this.tagName === 'div') console.log(this.css().height);
    // manually set width
    if (this.css().height !== 'auto') {
      return this.lengthAbs(this.css().height, 'height');
    }

    if (this.tagName === 'img') return this._image?.height ?? 0;

    if (true) {
      let height = 0, inlineBlock = 0;
      for (const x of this.children) {
        if (x.isBlock()) {
          if (inlineBlock) {
            height += inlineBlock;
            inlineBlock = 0;
          }

          height += x.totalHeight();
        }

        if (x.isInline()) inlineBlock = Math.max(inlineBlock, x.totalHeight());
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

  totalWidth() {
    if (this.display() === 'none') return 0;
    return this.width() + this.marginLeft() + this.marginRight();
  }

  totalHeight() {
    if (this.display() === 'none') return 0;

    let y = this.height() + this.marginTop() + this.marginBottom();

    y = this.collapseVerticalMargin(y);

    return y;
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

    y = this.collapseVerticalMargin(y);

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
      case 'LinkText': return colorScheme === 'dark' ? '#9E9EFF' : '#0000EE';
      case 'ButtonFace': return colorScheme === 'dark' ? '#202020' : '#f0f0f0';
      case 'ButtonText': return colorScheme === 'dark' ? '#ffffff' : '#000000';
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

    this._image.onload = () => this.invalidateCaches();

    return this._image;
  }

  marginTop() {
    return this.lengthAbs(this.css()['margin-top'], 'margin-top');
  }
  marginBottom() {
    return this.lengthAbs(this.css()['margin-bottom'], 'margin-bottom');
  }
  marginLeft() {
    const val = this.css()['margin-left'];

    if (val === 'auto') {
      return (this.parent.width() - this.width()) / 2;
    }

    return this.lengthAbs(val, 'margin-left');
  }
  marginRight() {
    const val = this.css()['margin-right'];

    if (val === 'auto') return 0; // todo: actually auto

    return this.lengthAbs(val, 'margin-right');
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

  get textContent() {
    let str = '';

    for (const x of this.children) {
      str += x.displayContent();
    }

    return str;
  }

  set textContent(value) {
    this.children.forEach(x => x.remove());

    const text = new LayoutNode(new Node('#text', this.document), this.renderer);
    text.content = value.toString();

    this.appendChild(text);
  }

  get innerHTML() {
    // https://html.spec.whatwg.org/#escapingString
    const escapeString = (str, attribute = false) => {
      // Replace any occurrence of the "&" character by the string "&amp;".
      str = str.replaceAll('&', '&amp;');

      // Replace any occurrences of the U+00A0 NO-BREAK SPACE character by the string "&nbsp;".
      str = str.replaceAll('\u00A0', '&nbsp;');

      if (attribute) {
        // If the algorithm was invoked in the attribute mode,
        // replace any occurrences of the """ character by the string "&quot;"
        str = str.replaceAll('"', '&quot;');
      } else {
        // If the algorithm was not invoked in the attribute mode,
        // replace any occurrences of the "<" character by the string "&lt;",
        // and any occurrences of the ">" character by the string "&gt;"
        str = str.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      }

      return str;
    };

    // https://html.spec.whatwg.org/#serialising-html-fragments
    // 1. If the node serializes as void, then return the empty string.
    if (this.voidElement) return '';

    // 2. Let s be a string, and initialize it to the empty string.
    let s = '';

    // 4. For each child node of the node, in tree order, run the following steps:
    for (const child of this.children) {
      if (child.tagName === '#text') {
        // If current node is a Text node
        if (
          // If the parent of current node is a style, script, xmp, iframe, noembed, noframes, or plaintext element
          ['style', 'script', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext'].includes(this.tagName) ||

          // todo: or if the parent of current node is a noscript element and scripting is enabled for the node
          false
        ) {
          s += child.content;
        } else {
          s += escapeString(child.content);
        }

        continue;
      }

      // Append a U+003C LESS-THAN SIGN character (<), followed by tagname.
      s += '<' + child.tagName;

      // For each attribute that the element has
      for (const attr in child.attrs) {
        // append a U+0020 SPACE character
        s += ' ';

        // the attribute's (serialized) name
        s += attr;

        // a U+003D EQUALS SIGN character (=), a U+0022 QUOTATION MARK character (")
        s += '="';

        // the attribute's value, escaped as described below in attribute mode
        s += escapeString(child.attrs[attr]);

        // and a second U+0022 QUOTATION MARK character (").
        s += '"';
      }

      // Append a U+003E GREATER-THAN SIGN character (>).
      s += '>';

      // If current node serializes as void, then continue on to the next child node at this point.
      if (!child.voidElement) {
        // Append the value of running the HTML fragment serialization algorithm on the current node element
        s += child.innerHTML;

        // followed by a U+003C LESS-THAN SIGN character (<), a U+002F SOLIDUS character (/)
        s += '</';

        // tagname again
        s += child.tagName;

        // and finally a U+003E GREATER-THAN SIGN character (>)
        s += '>';
      }
    }

    return s;
  }

  set innerHTML(value) {
    const parser = new HTMLParser();
    const dom = parser.parse(value, false);

    this.children = [];

    const process = x => {
      x = new LayoutNode(x, this.renderer);
      x.document = this.document;

      x.children = x.children.map(y => {
        const z = process(y);
        z.parent = x;
        return z;
      });

      return x;
    };
    const layout = process(dom);

    for (const x of layout.children) {
      this.appendChild(x);
    }
  }

  invalidateCaches(sub = false) {
    super.invalidateCaches();

    // just invalidate the entire document
    // todo: not do this
    if (!sub) {
      this.document.invalidateCaches(true);
      for (const x of this.document.allChildren()) x.invalidateCaches(true);
    }

    // if (this.parent) this.parent.invalidateCaches();

    this._cssCache = null;
    this.cache = {};
  }

  async process() {
    if (this.tagName === 'style') {
      this.rules = new CSSParser().parse(this.children[0].content);
      this.document.cssRules = this.document.cssRules.concat(this.rules);
      this.document.invalidateCaches();
    }

    // should this be blocking? - yes?
    if (this.tagName === 'link' && this.attrs.rel === 'stylesheet') {
      const text = await (await this.document.page.fetch(this.attrs.href)).text();
      this.rules = new CSSParser().parse(text);

      this.document.cssRules = this.document.cssRules.concat(this.rules);
      this.document.invalidateCaches();
    }

    if (this.tagName === 'script') {
      if (this.attrs.src) {
        const text = await (await this.document.page.fetch(this.attrs.src)).text();
        await window._js.run(this.document, text);
      }

      const content = this.children[0]?.content;
      if (content) await window._js.run(this.document, content);
    }

    for (const x of this.children) await x.process();
  }
}

export const constructLayout = async (document, renderer) => {
  const assembleLayoutNodes = x => {
    const a = new LayoutNode(x, renderer);
    a.children = a.children.map(y => {
      const z = assembleLayoutNodes(y);
      z.parent = a;
      return z;
    });

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

  await doc.process();

  return doc;
};

window.$ = x => window._renderer.layout.querySelector(x);