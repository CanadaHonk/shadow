import { Node, Document } from './dom.js';

const AttrState = {
  None: 0,
  Name: 1,
  Value: 2
};

const TagState = {
  None: 0,
  Name: 1,
  Attrs: 2
};

const StringState = {
  None: 0,
  Single: 1,
  Double: 2
};

const VOID_ELEMENTS = [ "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr", "nextid", "basefont" ];
const SELF_CLOSING_RULES = {
  p: {
    proceededBy: [ "address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "main", "menu", "nav", "ol", "p", "pre", "search", "section", "table", "ul" ],
    parentIsNot: [ "a", "audio", "del", "ins", "map", "noscript", "video" ]
  },
  li: {
    proceededBy: [ "li" ],
    parentIsNot: []
  },
  dt: {
    proceededBy: [ "dt", "dd" ]
  },
  dd: {
    proceededBy: [ "dd", "dt" ],
    parentIsNot: []
  }
};

export class HTMLParser {
  static {
    this.prototype.attrState = AttrState.None;
    this.prototype.tagState = TagState.None;
    this.prototype.stringState = StringState.None;
    this.prototype.escaping = false;
  
    this.prototype.currentAttrName = '';
    this.prototype.currentAttrValue = '';
  
    this.prototype.currentName = '';
    this.prototype.currentNode = null;
    this.prototype.textNode = null;
  }

  document = new Document();
  parent = this.document;

  constructor() {}

  parse(input, autoParent = true) {
    const checkToken = (a, b) => !this.escaping && a === b;

    const checkSES = c => {
      if (this.escaping) {
        return false;
      }

      if (c != '"' && c != '\'') {
        return false;
      }

      const state = c == '"' ? StringState.Double : StringState.Single;

      // start
      if (this.stringState == StringState.None) {
        this.stringState = state;
        return true;
      }

      // end
      if (this.stringState == state) {
        this.stringState = StringState.None;
        return true;
      }

      return false;
    };

    const isspace = c => c === ' ' || c === '\n';
    const isclosing = c => c === '>' || c === '/';

    const isVoidEl = (name = this.currentName) => VOID_ELEMENTS.includes(name);

    input = input.replace(/<!DOCTYPE .*?>/i, '').replace(/<!--[\w\W]*?-->/g, '')
      .replaceAll('\r\n', '\n').replaceAll('\r', '\n'); // normalize newlines

    for (let i = 0; i < input.length; i++) {
      const peek = () => input[i + 1];

      const c = input[i];
      if (c == '\\') {
        this.escaping = true;
        continue;
      }

      // console.log(`${c} | parent: ${this.parent.tagName} | attr state: ${this.attrState}. tag state: ${this.tagState}`);

      switch (this.attrState) {
        case AttrState.Name: {
          if (checkToken(c, '=')) {
            this.attrState = AttrState.Value;
            continue;
          }

          if (isclosing(c)) {
            this.currentNode.setAttr(this.currentAttrName, true);

            this.attrState = AttrState.None;

            if (isclosing(c)) i--;

            this.escaping = false;
            continue;
          }

          this.currentAttrName += c.toLowerCase();

          this.escaping = false;
          continue;
        }

        case AttrState.Value: {
          const isSES = checkSES(c);

          // if not in string and (whitespace or >) or
          // was in string and just left it
          if ((this.stringState == StringState.None && (isspace(c) || isclosing(c))) ||
              (isSES && this.stringState == StringState.None)) {
            this.currentNode.setAttr(this.currentAttrName, this.currentAttrValue);

            this.attrState = AttrState.None;

            if (isclosing(c)) i--;

            this.escaping = false;
            continue;
          }

          if (!isSES) {
            this.currentAttrValue += c;
          }

          this.escaping = false;
          continue;
        }

        case AttrState.None: {
        }
      }

      switch (this.tagState) {
        case TagState.Name: {
          if (isspace(c) || isclosing(c)) {
            // self close last node if we should
            const selfCloseRuleLast = SELF_CLOSING_RULES[this.parent?.tagName];
            if (selfCloseRuleLast?.proceededBy && selfCloseRuleLast.proceededBy.includes(this.currentName)) {
              this.parent = this.parent.parent;
            }

            this.currentNode = new Node(this.currentName, this.document);

            this.tagState = TagState.Attrs;

            this.currentNode.voidElement = isVoidEl();

            if (isclosing(c)) i--;

            this.escaping = false;
            continue;
          }

          this.currentName += c.toLowerCase();

          this.escaping = false;
          continue;
        }

        case TagState.Attrs: {
          if (isspace(c)) {
            this.escaping = false;
            continue;
          }

          if (c == '/') {
            // ignore i guess?
            this.attrState = AttrState.None;
            continue;
          }

          if (c == '>') {
            this.textNode = null;

            this.parent.appendChild(this.currentNode);

            if (!this.currentNode.voidElement) this.parent = this.currentNode;

            // uhh ??
            this.currentNode = null;

            this.tagState = TagState.None;

            this.escaping = false;

            if (this.parent.tagName === 'script' || this.parent.tagName === 'style'
              || this.parent.tagName === 'svg' // hack!
            ) {
              const start = i + 1;
              const endTag = '</' + this.parent.tagName + '>';
              const end = input.indexOf(endTag, start);

              const text = input.slice(start, end);

              if (text) {
                const node = new Node('#text', this.document);
                node.content = text;
                this.parent.appendChild(node);
              }

              this.parent = this.parent.parent;

              i = end + endTag.length - 1;
            }

            continue;
          }

          this.currentAttrName = c.toLowerCase();
          this.currentAttrValue = "";

          this.attrState = AttrState.Name;

          this.escaping = false;
          continue;
        }

        case TagState.None: {
        }
      }

      if (c == '<') {
        // closing tag
        if (peek() == '/') {
          let closingName = '';

          i++;
          // uhm this is less spec compliant than trident
          // just skip the closing tag (!!! wtf !!!)
          while (input[++i] != '>') closingName += input[i].toLowerCase();

          // self close last node if we should. jank?
          const selfCloseRuleLast = SELF_CLOSING_RULES[this.parent?.tagName];
          if (closingName !== this.parent.tagName && selfCloseRuleLast?.parentIsNot && !selfCloseRuleLast.parentIsNot.includes(this.parent?.parent?.tagName)) {
            this.parent = this.parent.parent;
          }

          if (this.parent.tagName !== closingName) console.warn(`HTMLParser: mismatched close. real: ${this.parent.tagName}, tag: ${closingName}`);

          let parent = this.parent;
          while (parent && parent.tagName !== closingName) {
            parent = parent.parent;
          }

          if (!parent) {
            // ignore
          } else {
            this.parent = parent.parent;
          }

          // this.parent = this.parent.parent;
          this.textNode = null;

          continue;
        }

        this.tagState = TagState.Name;
        this.currentName = "";

        this.escaping = false;
        continue;
      }

      if (!this.currentNode && this.parent) {
        if (!this.textNode) {
          this.textNode = new Node('#text', this.document);
          this.parent.appendChild(this.textNode);
        }

        this.textNode.content += c;
      }
    }

    // remove any empty #text
    const cleanup = x => {
      for (let i = 0; i < x.children.length; i++) {
        const y = x.children[i];
        if (y.tagName === '#text' && y.content === '') {
          x.children.splice(i, 1);
          i--;
          continue;
        }

        cleanup(y);
      }
    };
    cleanup(this.document);

    // add <html> if not there
    if (autoParent && this.document.childElements[0]?.tagName !== 'html') {
      const x = new Node('html', this.document);
      x.children = [...this.document.children];
      this.document.children = [x];
    }

    return this.document;
  }
}