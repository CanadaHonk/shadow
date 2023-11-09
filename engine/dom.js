export class Node {
  static {
    this.prototype.tagName = '';
    this.prototype.parent = null;
    this.prototype.document = null;
    this.prototype.content = '';
    this.prototype._classesCache = null;
  }

  children = [];
  attrs = {};

  constructor(tagName = '', document = null) {
    Object.assign(this, { tagName, document });
  }

  get childElements() {
    return this.children.filter(x => x.tagName !== '#text');
  }

  textNode() {
    if (this.tagName === '#text') return this;

    for (const x of this.children) {
      const o = x.textNode();
      if (o) return o;
    }
  }

  allChildren() {
    let o = [];

    for (const x of this.children) {
      o.push(x);
      o = o.concat(x.allChildren());
    }

    return o;
  }

  get id() {
    return this.attrs.id;
  }

  get className() {
    return this.attrs.class ?? '';
  }

  set className(value) {
    this.attrs.class = value ?? '';
    this.invalidateCaches();
  }

  _classesCache;
  get classes() {
    if (this._classesCache) return this._classesCache;
    return this._classesCache = this.className.split(' ');
  }

  get previousSiblings() {
    return !this.parent ? [] : this.parent.children.slice(0, this.parent.children.indexOf(this));
  }

  get siblingBefore() {
    return !this.parent ? null : this.parent.children[this.parent.children.indexOf(this) - 1];
  }
  get siblingAfter() {
    return !this.parent ? null : this.parent.children[this.parent.children.indexOf(this) + 1];
  }

  get href() {
    let href = this.attrs.href;
    if (this.document.page) return this.document.page.resolve(href);
    return href;
  }

  _hasClassCache = {};
  hasClass(x) {
    if (this._hasClassCache[x]) return this._hasClassCache[x];

    return this._hasClassCache[x] = this.classes.includes(x);
  }

  appendChild(node) {
    this.children.push(node);
    node.parent = this;
  }

  remove() {
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
  }

  getAttr(name) {
    return this.attrs[name];
  }

  setAttr(name, value) {
    this.attrs[name] = value;

    this.invalidateCaches();
  }

  invalidateCaches() {
    this._classesCache = null;
    this._hasClassCache = {};
  }

  toString(depth = -1) {
    let str = '';
    if (!['document', '#text'].includes(this.tagName)) str += `${' '.repeat(depth * 2)}<${this.tagName}${Object.keys(this.attrs).reduce((acc, x) => acc + ` ${x}="${this.attrs[x]}"`, '')}>`;

    let hasChildren = false;

    for (const x of this.children) {
      let isChild = x.tagName !== '#text';
      if (isChild) hasChildren = isChild;
      str += (isChild ? '\n' : '') + x.toString(depth + 1);
    }

    if (this.content.trim()) str += `${this.content.replace(/[\t\n\r]/g, ' ').replace(/ {2,}/g, ' ')}`;

    if (!['document', '#text'].includes(this.tagName) && !this.voidElement) str += `${hasChildren ? `\n${' '.repeat(depth * 2)}` : ''}</${this.tagName}>`;

    return str;
  }

  log(depth = -1) {
    if (this.tagName !== 'document') console.log(`${' '.repeat(depth * 2)}<${this.tagName}${Object.keys(this.attrs).reduce((acc, x) => acc + ` ${x}="${this.attrs[x]}"`, '')}>`);

    for (const x of this.children) x.log(depth + 1);

    if (this.content.trim()) console.log(`${' '.repeat((depth + 1) * 2)}${this.content.trim()}`);

    if (this.tagName !== 'document') if (!this.selfClosing) console.log(`${' '.repeat(depth * 2)}</${this.tagName}>`);
  }
}

export class Document extends Node {
  cssRules = [];

  constructor() {
    super('document', null);
    this.document = this;
  }
}