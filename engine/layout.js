import { Document, Node } from './dom.js';
import { CSSParser, CSSRule, SelectorType, CombinatorType, RuleType } from './cssparser.js';
import { HTMLParser } from './htmlparser.js';

const uaRaw = globalThis.node ? (await import('fs')).readFileSync(globalThis.uaPath, 'utf8') : await (await fetch('engine/ua.css')).text();
const uaRules = new CSSParser().parse(uaRaw);

const defaultProperties = {
  display: 'inline',
  position: 'static',

  width: 'auto',
  height: 'auto',

  cursor: 'auto',

  'text-align': 'left',

  'font-family': 'normal',
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

  top: 'auto',
  bottom: 'auto',
  left: 'auto',
  right: 'auto',

  'color-scheme': 'normal',
  'line-height': 'normal',

  'max-width': 'none'
};

const inheritedProperties = [ "azimuth", "border-collapse", "border-spacing", "caption-side", "color", "cursor", "direction", "elevation", "empty-cells", "font-family", "font-style", "font-variant", "font-weight", "font", "letter-spacing", "line-height", "list-style-image", "list-style-position", "list-style-type", "list-style", "orphans", "pitch-range", "pitch", "quotes", "richness", "speak-header", "speak-numeral", "speak-punctuation", "speak", "speech-rate", "stress", "text-align", "text-indent", "text-transform", "visibility", "voice-family", "volume", "white-space", "widows", "word-spacing", "color-scheme" ];

// eg: font-size -> fontSize
const propToFunc = x => x.replace(/\-[a-z]/g, _ => _[1].toUpperCase());

// window.colorScheme = 'light';
window.colorScheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// uh yeah this is just a constant :)
const defaultFontSize = {
  default: 16,
  monospace: 13
}; // px

// yes.
const CM = 37.8; // px
const IN = 96; // px

const byPtr = {};
export class LayoutNode extends Node {
  static {
    this.prototype.renderer = null;
  }

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

        this.cache[k] = f.apply(this, arguments);
        if (Number.isNaN(this.cache[k])) {
          console.warn('NaN', k, this.tagName);

          // hack: set to 0 instead of NaN
          this.cache[k] = 0;

          // throw new Error(`NaN ${k} (${this.tagName})`);
          // debugger;
        }

        return this.cache[k];
      }.bind(this);
    };

    cache('x'); cache('y'); cache('width'); cache('height');
    cache('display'); cache('isBlock'); cache('isInline');
    cache('color'); cache('backgroundColor');
    cache('contentWidth'); cache('contentHeight');
    cache('totalWidth'); cache('totalHeight');
    cache('marginTop'); cache('marginBottom'); cache('marginLeft'); cache('marginRight');
    cache('paddingTop'); cache('paddingBottom'); cache('paddingLeft'); cache('paddingRight');
    cache('displayContent');
    cache('colorScheme');
    cache('lineHeight'); cache('maxWidth');
    cache('availableParent'); cache('availableWidth'); cache('availableTotalWidth');
    cache('textChunks'); cache('endX'); cache('endY');
    cache('fontSize'); cache('defaultFontSize');
    cache('font');
  }

  getFromPtr(ptr) {
    return byPtr[ptr];
  }

  isImage() {
    return this.tagName === 'img' || this.tagName === 'svg';
  }

  testCSSConditions(conds) {
    const pseudoCheck = text => {
      switch (text) {
        case 'root':
          return this.tagName === 'html';

        case 'link': // we have no history recorded (yet)
        case 'any-link':
          return this.tagName === 'a' && !!this.attrs.href;
      }

      return false;
    };

    for (const x of conds) { // a#b.c (a AND b AND c)
      if (
        !(x.type === SelectorType.Tag && this.tagName === x.text) && // tag
        !(x.type === SelectorType.Id && this.id === x.text) && // id
        !(x.type === SelectorType.Class && this.hasClass(x.text)) && // class
        !(x.type === SelectorType.Pseudo && pseudoCheck(x.text)) && // pseudo classes
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
    selectorLoop: for (const _combs of selectors) { // a, b, c (a OR b OR c)
      // reverse so:
      //   a > b > c (parent --> child)
      // becomes:
      //   c > b > a (child --> parent)

      let combs = _combs.slice().reverse(); // slow!
      const first = combs.shift();

      if (!this.testCSSConditions(first.conds)) continue;

      let lastCType = first.type;
      let target = this.parent;
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

  querySelectorAll(text) {
    const selector = CSSRule.parseSelector(text);

    const out = [];
    const find = x => {
      if (x.matchesCSS(selector)) out.push(x);

      for (const y of x.children) {
        const o = find(y);
        if (o) return o;
      }
    };

    find(this);

    return out;
  }

  // parse a [ b ]? shorthand (eg margin-inline) into [a, b]
  parse2Shorthand(x) {
    // x = this.resolveValue(x);
    const spl = x.split(' ').filter(x => x);

    switch (spl.length) {
      case 1: return [ spl[0], spl[0] ];
      case 2: return spl;
    }
  }

  // parse a [ b [ c [ d ]? ]? ]? shorthand (eg margin, padding) into [top, bottom, left, right]
  parse4Shorthand(x) {
    // x = this.resolveValue(x);
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

      // cache css variables in us
      // todo: experiment if this is slower/faster. leave for now
      /* const keys = Object.keys(css);
      for (const x of keys) {
        if (x.startsWith('--') && !inherited[x] && css[x]) inherited[x] = css[x];
      } */

      parent = parent.parent;
    }

    // apply css rules
    let props = { ...defaultProperties, ...inherited };

    if (this.tagName === '#text') return this._cssCache = props;

    const checkRule = rule => {
      if (this.matchesCSS(rule.selectors)) {
        for (const x in rule.properties) {
          const v = rule.properties[x];

          // todo: cssparser should have to care about parsing longhands, not layout
          switch (x) {
            case 'margin':
            case 'padding': {
              const [ top, bottom, left, right ] = this.parse4Shorthand(v);

              props[x + '-top'] = top;
              props[x + '-bottom'] = bottom;
              props[x + '-left'] = left;
              props[x + '-right'] = right;
              break;
            }

            case 'margin-inline':
            case 'margin-block': {
              const [ start, end ] = this.parse2Shorthand(v);

              props[x + '-start'] = start;
              props[x + '-end'] = end;
              break;
            }

            case 'background': {
              // just alias for background-color for now
              props['background-color'] = v;
              break;
            }

            default:
              props[x] = v;
              break;
          }
        }
      }
    };

    for (const rule of rules) {
      // at rule
      if (rule.type === RuleType.NestedAt) {
        // check we match it
        switch (rule.atName) {
          case 'media':
            // todo

          default:
            // console.warn(`layout: unsupported @rule: ${rule.atName}`);
            continue;
        }

        for (const x of rule.rules) {
          checkRule(x);
        }

        continue;
      }

      if (rule.type === RuleType.RegularAt) {
        // ignore for now as we support none
        continue;
      }

      checkRule(rule);
    }

    if (this.tagName === 'font') {
      if (this.attrs.color) props.color = this.attrs.color;
    }

    if (this.tagName === 'document') {
      // todo: use this.querySelector('meta[name="color-scheme"]') once supported
      const colorSchemeMeta = this.querySelectorAll('meta').find(x => x.attrs.name === 'color-scheme');
      if (colorSchemeMeta) props['color-scheme'] = colorSchemeMeta.attrs.content;
    }

    return this._cssCache = props;

    // possible optimizations for later:
    //   - reorder selectors internally from least to most likely
    //     eg span > .cool > #wow -> #wow > .cool > span
  }

  // run functions, etc (probably a better name?)
  resolveValue(x, property, parent = this.parent) {
    if (!x) return x;

    if (x === 'inherit') {
      return parent[propToFunc(property)]();
    }

    return x.replace(/([a-z-]+)\((.*)\)/ig, (_, func, rawArgs) => {
      const args = this.resolveValue(rawArgs, property, parent).split(',').map(x => x.trim());

      switch (func) {
        case 'var': {
          const [ name, fallback ] = args;

          let parent = this;
          while (parent) {
            let value = parent.css()[name];
            if (value) return this.resolveValue(value, property, parent);

            parent = parent.parent;
          }

          return fallback ?? _;
        }

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

  position() {
    return this.css().position;
  }

  isAbsolute() {
    return this.position() === 'absolute';
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

    let content = this.content;
    let trimStart = false, trimEnd = false;

    // https://developer.mozilla.org/en-US/docs/Web/CSS/white-space#formal_definition
    // todo: remove end of line spaces?
    // todo: use longer hand white-space-collapse

    const whiteSpace = this.css()['white-space']
    const pre = whiteSpace === 'pre' || whiteSpace === 'pre-wrap';

    if (!pre) {
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

      // ???
      if (this.parent.isBlock() && !this.siblingBefore) trimStart = true;
      if (this.parent.isBlock() && !this.siblingAfter) trimEnd = true;

      if (trimStart) content = content.trimStart();
      if (trimEnd) content = content.trimEnd();
    }

    content = content.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&quot;', '"').replaceAll('&apos;', '\'').replaceAll('&amp;', '&')
      .replace(/&#(x?)([A-Za-z0-9]+);/, (_, hex, digits) => String.fromCodePoint(hex ? parseInt(digits, 16) : digits));

    content = content.replaceAll('\r\n', '\n');
    if (!pre) content = content.replace(/[\t\n\r]/g, ' ').replace(/ {2,}/g, ' ');

    return content.replaceAll('&nbsp;', ' ');
  }

  isBlock() {
    // if we have block children with width: auto, become block
    if (this.children.some(x => x.isBlock() && x.css().width === 'auto')) return true;

    return this.display() === 'block' || this.display() === 'list-item' || this.display() === 'flex';
  }
  isInline() {
    return !this.isBlock();
  }

  defaultFontSize() {
    const fontFamily = this.css()['font-family'];
    return defaultFontSize[fontFamily] ?? defaultFontSize.default;
  }

  // technically <length-percentage> but uhm yeah
  lengthAbs(i, property, parent = this.parent) {
    const x = this.resolveValue(i ?? '', property, parent);
    if (typeof x === 'number') return x;

    if (property === 'font-size') {
      if (this.tagName === 'document') return this.defaultFontSize();

      // :/
      switch (x) {
        case 'xx-small': return this.defaultFontSize() * (3/5);
        case 'x-small': return this.defaultFontSize() * (3/4);
        case 'small': return this.defaultFontSize() * (8/9);
        case 'medium': return this.defaultFontSize() * (1);
        case 'large': return this.defaultFontSize() * (6/5);
        case 'x-large': return this.defaultFontSize() * (3/2);
        case 'xx-large': return this.defaultFontSize() * (2/1);
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

    if (!unit) {
      switch (property) {
        case 'line-height':
          unit = 'em';
          break;

        default:
          unit = 'px';
          break;
      }
    }

    val = parseFloat(val);
    if (Number.isNaN(val)) val = 0;

    switch (unit) {
      case 'px': return val;

      case 'cm': return val * CM;
      case 'mm': return val * (CM / 10);
      case 'Q': return val * (CM / 40);
      case 'in': return val * IN;
      case 'pc': return val * (IN / 6);
      case 'pt': return val * (IN / 72);

      case '%':
        let prop = property;

        if (prop === 'top' || prop === 'bottom') {
          // prop = 'height';
          return window.innerHeight * (val / 100);
        }
        if (prop === 'left' || prop === 'right') {
          // prop = 'width';
          return window.innerWidth * (val / 100);
        }

        if (prop === 'height') {
          // hack: uh oh! this is hard to summarize
          // say we have a block height % inside another block (height: auto)
          // we want to get the height of the usable parent, eg has a specified height
          // honestly idk how to do this legitTM (easily)

          let usableParent = parent;
          while (usableParent && !usableParent.cssHeight()) {
            usableParent = usableParent.parent;
          }

          let height;

          // ultrahack: no usable parent, use renderer height
          if (!usableParent) height = this.renderer.canvas.height;
            else height = usableParent.height();

          return height * (val / 100);
        }

        // (val / 100) * parent property value
        return parent[propToFunc(prop)]() * (val / 100);

      case 'em':
        if (property === 'font-size') {
          // val * parent font size
          return parent.fontSize() * val;
        }

        // val * node font size
        return this.fontSize() * val;
    }

    return 0;
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
      // y -= this.parent.marginTop();
      y -= this.marginTop();
      // y += this.parent.marginTop();
    }

    if (!this.siblingBefore && this.parent && this.parent.marginTop() > this.marginTop()) {
      y -= this.marginTop();
    }

    return y;
  }

  imageRatio() {
    return (this._image?.width || 1) / (this._image?.height || 1);
  }

  cssWidth() {
    if (this.isInline()) return null;

    let val = this.css().width;
    if (val === 'auto') return null;

    return this.lengthAbs(val, 'width');
  }

  cssHeight() {
    if (this.isInline()) return null;

    let val = this.css().height;
    if (val === 'auto') return null;

    return this.lengthAbs(val, 'height');
  }

  imageWidth() {
    let cssWidth;
    if (cssWidth = this.cssWidth()) return cssWidth;

    if (this.attrs.width) return this.lengthAbs(this.attrs.width, 'width-attr');
    if (this.attrs.height || this.css().height !== 'auto') return this.imageHeight() * this.imageRatio();

    return this._image?.width ?? 0;
  }

  imageHeight() {
    let cssHeight;
    if (cssHeight = this.cssHeight()) return cssHeight;

    if (this.attrs.height) return this.lengthAbs(this.attrs.height, 'height-attr');
    if (this.attrs.width || this.css().width !== 'auto') return this.imageWidth() / this.imageRatio();

    return this._image?.height ?? 0;
  }

  lineHeight() {
    let val = this.css()['line-height'];
    if (val === 'normal') {
      // get default line-height based on font "properties" (lol)
      // return this.renderer.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', this.font()).height;
      return Math.ceil(this.renderer.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', this.font()).height) + 1;
    }

    return this.lengthAbs(val, 'line-height');
  }

  maxWidth() {
    const val = this.css()['max-width'];
    if (val === 'none') return null;

    return this.lengthAbs(val, 'max-width');
  }

  availableParent() {
    // get nearest block/non auto inline parent
    let parent = this.parent;
    while (true) {
      if (parent.isBlock() || parent.cssWidth() !== null || parent.maxWidth() !== null) break;
      parent = parent.parent;
    }

    return parent;
  }

  availableTotalWidth() {
    // get nearest block/non auto inline parent
    let parent = this.availableParent();

    // inline parents depend on our width so we do not care
    // get total parent content width
    let width = parent.maxWidth() ?? parent.contentWidth();

    // - our horizontal spacing
    width -= this.horizontalSpace(true);

    return width;
  }

  // work out how much width
  availableWidth() {
    let parent = this.availableParent();

    // inline parents depend on our width so we do not care
    // get total parent content width
    let width = parent.contentWidth();

    // - our horizontal spacing
    width -= this.horizontalSpace(true);

    // - our x compared to parent x
    width -= this.x() - parent.x();

    return width;
  }

  // return an array of text chunks as { x, y, width, str }
  textChunks() {
    const chunks = [];

    const startX = this.x();
    const startY = this.y();

    const parent = this.availableParent();
    const baseX = parent.x() + parent.paddingLeft();

    let available = this.availableWidth();

    const text = this.displayContent();
    const font = this.font();
    const lineHeight = this.lineHeight();

    let x = startX;
    let y = startY;

    let str = '', wrapNext = false, firstWord = false;

    // hack: separate by word and newline but keep newline at the end of lines
    const words = text.split(' ').flatMap(x => {
      const out = [];
      const spl = x.split('\n');
      let i = 0;
      for (const y of spl) {
        out.push(y + (i < spl.length - 1 ? '\n' : ''));
        i++;
      }
      return out;
    });
    for (const w of words) {
      let add = (firstWord ? ' ' : '') + w;
      let nextStr = str + add;

      const measure = this.renderer.measureText(nextStr, font);

      if (measure.width > available || wrapNext) {
        wrapNext = false;
        const finalMeasure = this.renderer.measureText(str, font);

        chunks.push({ x, y, str, width: finalMeasure.width, height: lineHeight });
        available = this.availableTotalWidth();
        str = w;

        x = baseX;
        // y += measure.height;
        y += lineHeight;
      } else {
        str = nextStr;
      }

      if (w.endsWith('\n')) wrapNext = true;

      firstWord = true;
    }

    if (str || chunks.length === 0) {
      const measure = this.renderer.measureText(str, font);
      chunks.push({ x, y, str, width: measure.width, height: lineHeight });
    }

    return chunks;
  }

  contentWidth() {
    if (this.tagName === 'document') return this.renderer.canvas.width;

    if (this.isImage()) return this.imageWidth();

    // manually set width
    let cssWidth;
    if (cssWidth = this.cssWidth()) return cssWidth;

    if (this.isBlock()) {
      let space = this.horizontalSpace();
      if (this.css()['margin-left'] !== 'auto') space += this.marginLeft();
      if (this.css()['margin-right'] !== 'auto') space += this.marginRight();

      // take up as much as we can?
      return (this.parent ?? this.frame).contentWidth() - space;
    }

    let width = 0;
    for (const x of this.children) {
      width += x.width();
    }
    return width;
  }

  contentHeight() {
    if (this.isImage()) return this.imageHeight();

    // manually set height
    let cssHeight;
    if (cssHeight = this.cssHeight()) return cssHeight;

    if (true) {
      let maxY = 0;
      if (this.children.length > 0) {
        /* let target = this.children[this.children.length - 1];
        while (target.css().display === 'none') {
          target = target.siblingBefore;
        }

        maxY = target.endY();
        if (!target.isBlock()) {
          if (target.tagName === '#text') {
            maxY += target.lineHeight();
          } else {
            maxY += target.height();
          }
        } */

        for (const x of this.children) {
          let y = x.endY();
          if (!x.isBlock()) {
            if (x.tagName === '#text') {
              y += x.lineHeight();
            } else {
              y += x.height();
            }
          }

          maxY = Math.max(y, maxY);
        }
      } else {
        maxY = this.y();
        // oh god what ??
        // if (this.isBlock()) maxY += this.height() + this.marginBottom();
      }

      // maxY = this.collapseVerticalMargin(maxY);

      return maxY - this.y() - this.paddingTop();

      /* let height = 0, inlineBlock = 0;
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

      return height; */
    }
  }

  width() {
    if (this.display() === 'none') return 0;

    // todo: min-width and max-width lol
    if (this.tagName === '#text') {
      const chunks = this.textChunks();

      let minLeft = Infinity, maxRight = 0;
      for (const c of chunks) {
        minLeft = Math.min(minLeft, c.x);
        maxRight = Math.max(maxRight, c.x + c.width);
      }

      return maxRight - minLeft;

      // return this.renderer.measureText(this.displayContent(), this.parent.font()).width;
    }

    return this.contentWidth() + this.horizontalSpace();
  }

  height() {
    if (this.display() === 'none') return 0;

    if (this.tagName === '#text') {
      const chunks = this.textChunks();

      let minTop = Infinity, maxBottom = 0;
      for (const c of chunks) {
        minTop = Math.min(minTop, c.y);
        maxBottom = Math.max(maxBottom, c.y + c.height);
      }

      return maxBottom - minTop;

      // return this.renderer.measureText(this.displayContent(), this.parent.font()).height;
    }

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

  endX() {
    if (this.isAbsolute() || this.display() === 'none') return this.x();

    if (this.tagName === '#text') {
      const chunks = this.textChunks();
      const lastChunk = chunks[chunks.length - 1];
      return lastChunk.x + lastChunk.width;
    }

    if (this.children.length > 0) {
      const lastChild = this.children[this.children.length - 1];
      return lastChild.endX() + this.marginRight();
    }

    return this.x() + this.width() + this.marginRight();
    // return this.x() + this.totalWidth();
  }

  endY() {
    if (this.isAbsolute() || this.display() === 'none') return this.y();

    if (this.tagName === '#text') {
      const chunks = this.textChunks();
      const lastChunk = chunks[chunks.length - 1];
      return lastChunk.y;
    }

    if (this.isInline() && this.children.length > 0) {
      const lastChild = this.children[this.children.length - 1];
      return lastChild.endY() + this.marginBottom();
    }

    let y = this.y();
    if (this.isBlock()) y += this.height() + this.marginBottom();

    // if (this.isBlock()) y += this.totalHeight();

    return y;
  }

  x() {
    const parent = this.parent ?? this.frame;
    if (!parent) return 0;

    if (this.isAbsolute()) {
      // todo: actual relative root, not just doc
      const relativeRoot = this.document;

      const left = this.css().left;
      if (left !== 'auto') return relativeRoot.x() + this.lengthAbs(left, 'left', relativeRoot);

      const right = this.css().right;
      if (right !== 'auto') return relativeRoot.x() + relativeRoot.width() - this.lengthAbs(right, 'right', relativeRoot) - this.totalWidth();

      return 0;
    }

    let x = this.marginLeft();
    if (this.siblingBefore && this.siblingBefore.isInline() && this.isInline()) {
      x += this.siblingBefore.endX();
    } else {
      x += parent.x();
      x += parent.paddingLeft();
    }

    if (this.isInline() && this.css()['text-align'] !== 'left') {
      // hack: align next time as we cannot compute our own width here
      if (!this.cache._alignWidth) {
        if (this.cache._alignWidth === undefined) {
          this.cache._alignWidth = null;
          setTimeout(() => {
            this.cache._alignWidth = this.totalWidth();
            this.cache._alignWidthParent = this.parent.contentWidth();
            this.invalidateCaches(false, ['_alignWidth', '_alignWidthParent']);
          }, 0);
        }

        return this._alignTmp ?? -9999;
      }

      switch (this.css()['text-align']) {
        case 'center': return this._alignTmp = x + ((this.cache._alignWidthParent ?? 0) - (this.cache._alignWidth ?? 0)) / 2;
        case 'right': return this._alignTmp = x + ((this.cache._alignWidthParent ?? 0) - (this.cache._alignWidth ?? 0));
      }
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
    const parent = this.parent ?? this.frame;
    if (!parent) return 0;

    if (this.isAbsolute()) {
      // todo: actual relative root, not just doc
      const relativeRoot = this.document;

      const top = this.css().top;
      if (top !== 'auto') return relativeRoot.y() + this.lengthAbs(top, 'top', relativeRoot);

      const bottom = this.css().bottom;
      if (bottom !== 'auto') return relativeRoot.y() + relativeRoot.height() + this.lengthAbs(bottom, 'bottom', relativeRoot) - this.totalHeight();

      return 0;
    }

    let y = this.marginTop();
    if (this.children[0]?.marginTop()) y = Math.max(y, this.children[0]?.marginTop());

    if (this.siblingBefore) {
      y += this.siblingBefore.endY();
      if (this.isBlock() && !this.siblingBefore.isBlock()) y += this.siblingBefore.height() + this.siblingBefore.marginBottom();
    } else {
      y += parent.y();
      y += parent.paddingTop();
    }

    y = this.collapseVerticalMargin(y);

    return y;
  }

  font() {
    return `${this.css()['font-style']} ${this.css()['font-weight']} ${this.fontSize()}px ${this.css()['font-family']}`;
  }

  colorScheme() {
    const val = this.css()['color-scheme'];
    if (val === 'light' || val === 'dark') return val;

    // most pages expect light so shrug?
    if (val === 'normal') return 'light';

    const pageSupports = val.split(' ');
    const pagePrefers = pageSupports[0];
    const userPrefers = window.colorScheme;

    if (pageSupports.includes(userPrefers)) return userPrefers;

    return pagePrefers;
  }

  colorAbs(i, property, parent = this.parent) {
    const x = this.resolveValue(i, property, parent);
    const colorScheme = this.colorScheme();

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
    return this.colorAbs(this.css().color, 'color');
  }

  backgroundColor() {
    let val = this.css()['background-color'];
    if (this.tagName === 'html' && (!val || val === 'Canvas')) {
      // try to use body bg color if html bg color is not set (???)
      const bodyVal = this.querySelector('body')?.css?.()?.['background-color'];
      if (bodyVal) val = bodyVal;
    }

    return this.colorAbs(val, 'background-color');
  }

  _image;
  async loadImage() {
    if (this._image !== undefined) return;

    this._image = null;

    let blob;
    switch (this.tagName) {
      case 'img': {
        const res = await this.document.page.fetch(this.attrs.src);
        const type = res.headers.get('Content-Type');
        const data = await res.arrayBuffer();

        blob = new Blob([ new Uint8Array(data) ], { type });
        break;
      }

      // hack: load svg from content
      case 'svg': {
        const svg = this.serialize(false);
        this.children = [];

        console.log(svg);

        blob = new Blob([ svg ], { type: 'image/svg+xml' });
        break;
      }
    }

    const image = new Image();
    image.src = URL.createObjectURL(blob);

    image.style.display = 'none';
    document.body.appendChild(image);

    image.onload = () => {
      this._image = image;
      this.invalidateCaches();
    };
  }

  marginTop() {
    return this.lengthAbs(this.css()['margin-top'], 'margin-top');
  }
  marginBottom() {
    return this.lengthAbs(this.css()['margin-bottom'], 'margin-bottom');
  }

  marginLeft() {
    const val = this.css()['margin-left'];

    if (this.isBlock() && val === 'auto') {
      return (this.parent.width() - (this.contentWidth() + this.paddingLeft() + this.paddingRight())) / 2;
    }

    return this.lengthAbs(val, 'margin-left');
  }
  marginRight() {
    const val = this.css()['margin-right'];

    if (this.isBlock() && val === 'auto') {
      return (this.parent.width() - (this.contentWidth() + this.paddingLeft() + this.paddingRight())) / 2;
    }

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

  serialize(shouldEscapeText = true) {
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

    // 2. Let s be a string, and initialize it to the empty string.
    let s = '';

    if (this.tagName === '#text') {
      // If current node is a Text node
      if (
        // If the parent of current node is a style, script, xmp, iframe, noembed, noframes, or plaintext element
        ['style', 'script', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext'].includes(this.tagName) ||

        // todo: or if the parent of current node is a noscript element and scripting is enabled for the node
        false ||

        // forced by argument
        !shouldEscapeText
      ) {
        s += this.content;
      } else {
        s += escapeString(this.content);
      }

      return s;
    }

    // Append a U+003C LESS-THAN SIGN character (<), followed by tagname.
    s += '<' + this.tagName;

    // For each attribute that the element has
    for (const attr in this.attrs) {
      // append a U+0020 SPACE character
      s += ' ';

      // the attribute's (serialized) name
      s += attr;

      // a U+003D EQUALS SIGN character (=), a U+0022 QUOTATION MARK character (")
      s += '="';

      // the attribute's value, escaped as described below in attribute mode
      s += escapeString(this.attrs[attr]);

      // and a second U+0022 QUOTATION MARK character (").
      s += '"';
    }

    // Append a U+003E GREATER-THAN SIGN character (>).
    s += '>';

    // If current node serializes as void, then continue on to the next child node at this point.
    if (!this.voidElement) {
      // Append the value of running the HTML fragment serialization algorithm on the current node element
      for (const child of this.children) {
        s += child.serialize(shouldEscapeText);
      }

      // followed by a U+003C LESS-THAN SIGN character (<), a U+002F SOLIDUS character (/)
      s += '</';

      // tagname again
      s += this.tagName;

      // and finally a U+003E GREATER-THAN SIGN character (>)
      s += '>';
    }

    return s;
  }

  get outerHTML() {
    return this.serialize();
  }

  get innerHTML() {
    // perf todo:
    //  - cache this, invalidate on self/child change

    if (this.voidElement) return '';

    let s = '';

    for (const child of this.children) {
      s += child.serialize();
    }

    return s;
  }

  set innerHTML(value) {
    // perf todo:
    //  - just take value for bulk calls and do not parse/etc each time

    // megahack: only remove if we have a child needing clean up
    if (this.children[0]?.tagName === 'iframe') {
      // is proper but really slow
      for (const x of this.children) x.remove();
    } else {
      this.children = [];
    }

    if (!value) { // set to empty, just stop here
      this.invalidateCaches();
      return;
    }

    const parser = new HTMLParser();
    const dom = parser.parse(value, this._innerHTMLHTMLTag ?? false);
    this._innerHTMLHTMLTag = false;

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

    removeDeadTextNodes(layout);

    for (const x of layout.children) {
      this.appendChild(x);
    }

    this.process();

    // probably should do but slow?
    // this.invalidateCaches();
    // this.parent.invalidateDirectCaches();
  }

  // todo: this section should all be document only!
  writing = false;
  open() {
    this.writing = true;
    this.innerHTML = ''; // layout!

    return this;
  }

  write(str) {
    if (!this.writing) this.open();

    this._innerHTMLHTMLTag = true; // sorry.

    // big hack energy
    this.innerHTML = str; // layout!
  }

  close() {
    this.writing = false;
  }

  createElement(tagName) {
    const el = new LayoutNode(new Node(tagName, this.document), this.renderer);
    return el;
  }

  createTextNode(str) {
    const el = new LayoutNode(new Node('#text', this.document), this.renderer);
    el.content = str;
    return el;
  }

  remove() {
    super.remove();

    // cleanup
    if (this.contentDocument) window._js.stop(this.contentDocument);

    this.invalidateCaches();
  }

  /* appendChild(node) {
    super.appendChild(node);

    this.invalidateCaches();
  } */

  invalidateCaches(sub = false, exclude = []) {
    super.invalidateCaches();

    // just invalidate the entire document
    // todo: not do this
    if (!sub) {
      this.document.invalidateCaches(true, exclude);
      for (const x of this.document.allChildren()) x.invalidateCaches(true, exclude);
    }

    // if (this.parent) this.parent.invalidateCaches();

    this._cssCache = null;

    const oldCache = {};

    for (const x of exclude) {
      oldCache[x] = this.cache[x];
    }

    this.cache = oldCache;
  }

  invalidateDirectCaches() {
    super.invalidateCaches();
    this.invalidateCaches(true);

    for (const x of this.children) x.invalidateDirectCaches();
  }

  async process() {
    if (this.tagName === 'style') {
      const t = performance.now();
      this.rules = new CSSParser().parse(this.children[0].content);
      this.document.cssRules = this.document.cssRules.concat(this.rules);
      this.document.invalidateCaches();
      processTime.style += performance.now() - t;
    }

    // should this be blocking? - yes?
    if (this.tagName === 'link' && this.attrs.rel === 'stylesheet') {
      const t = performance.now();
      try {
        const text = await (await this.document.page.fetch(this.attrs.href)).text();
        this.rules = new CSSParser().parse(text);

        this.document.cssRules = this.document.cssRules.concat(this.rules);
        this.document.invalidateCaches();
      } catch (e) {
        console.warn('failed to load external stylesheet', this.attrs.href, e);
      }
      processTime.link_stylesheet += performance.now() - t;
    }

    if (this.tagName === 'script') {
      const t = performance.now();
      try {
        if (this.attrs.src) {
          const text = await (await this.document.page.fetch(this.attrs.src)).text();
          await window._js.run(this.document, text);
        }

        const content = this.children[0]?.content;
        if (content) await window._js.run(this.document, content);
      } catch (e) {
        console.warn('failed to load <script>', this.attrs.src, e);
      }
      processTime.script += performance.now() - t;
    }

    if (this.tagName === 'iframe') {
      const doc = new LayoutNode(new Document(), this.renderer);
      doc.document = doc;
      doc.parentDocument = this.document;
      doc.frame = this;

      doc.page = this.document.page; // hack: we should make our own page!

      this.contentDocument = doc;

      const proc = x => {
        x.document = doc;
        x.root = doc.children[0];
        for (const y of x.children) proc(y);
      };

      for (const y of this.children) {
        y.parent = doc;
        proc(y);
      }

      this.children = [];
    }

    if (this.isImage()) this.loadImage();

    for (const x of this.children) await x.process();
  }
}

let processTime;

const removeDeadTextNodes = x => {
  // if (x.tagName === '#text' && x.displayContent() === '') {
  // if (x.tagName === '#text' && x.parent.tagName === 'body') console.log(x.content, x.content.trim() === '');

  x.children = x.children.filter(y => {
    if (y.tagName === '#text') {
      if (y.content.trim() === '') {
        if (y.content.length > 0 && y.siblingAfter && y.siblingBefore?.isInline?.() && y.siblingAfter.isInline()) {
          const t = y.siblingAfter.textNode();
          if (t && !t.content.startsWith(' ')) t.content = ' ' + t.content;
        }

        return false;
      }
    } else {
      removeDeadTextNodes(y);
    }

    return true;
  });
};

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
  doc.root = doc.querySelector('html');
  profileSubstep('assemble');

  const reSetDoc = x => {
    x.document = doc;
    x.root = doc.root; // <html>/:root
    for (const y of x.children) reSetDoc(y);
  };
  reSetDoc(doc);
  profileSubstep('reset doc');

  removeDeadTextNodes(doc);
  profileSubstep('rm dead text');

  profileStep('construct layout');

  processTime = {
    style: 0,
    link_stylesheet: 0,
    script: 0
  };

  await doc.process();

  for (const x in processTime) {
    profileSubsteps[x.replaceAll('_', ' ')] = processTime[x];
  }
  profile.lastSub = true;

  profileStep('process layout');

  // go to top of page
  scrollY = 0;
  if (window.onresize) window.onresize('ignore_last'); // hack: update it

  renderer.layout = doc;

  const body = doc.querySelector('body');
  if (body && body.attrs.onload) setTimeout(() => {
    window._js.run(doc, body.attrs.onload);
  }, 10);

  return doc;
};

window.$ = x => window._renderer.layout.querySelector(x);