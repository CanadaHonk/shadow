const MainState = {
  None: 0,
  Property: 1,
  Value: 2,
};

const StringState = {
  None: 0,
  Single: 1,
  Double: 2,
};

const AtState = {
  None: 0,
  Name: 1,
  Cond: 2,
};

export const RuleType = {
  None: 0,
  NestedAt: 1,
  RegularAt: 2,
};

export const SelectorType = {
  Tag: 0,
  Id: 1,
  Class: 2,
  Universal: 3,
  Pseudo: 4,
};

export const CombinatorType = {
  Descendant: 0,
  Child: 1,
};

const isspace = c => c === ' ' || c === '\n';

export class CSSRule {
  static {
    this.prototype.type = RuleType.None;
  }
  selectors = [];
  properties = {};

  static parseSelector(input) {
    input = input.trim()
      .replaceAll('\r\n', '\n'); // normalize newlines

    const out = [];

    for (let x of input.split(',')) {
      x = x.trim();

      let cType = CombinatorType.Descendant;
      let sType = SelectorType.Tag;
      let text = '';

      const sels = [];
      let conds = [];

      const pushCond = () => {
        if (text || sType === SelectorType.Universal) conds.push({ type: sType, text });
        sType = SelectorType.Tag;
        text = '';
      };

      const isCombinator = c => [' ', '>'].includes(c);

      for (let i = 0; i < x.length; i++) {
        const c = x[i];

        if (isCombinator(c) && text && (c !== ' ' || (!isCombinator(x[i + 1]) && !isspace(x[i + 1])))) {
          pushCond();

          sels.push({ type: cType, conds });
          conds = [];

          if (c === ' ') cType = CombinatorType.Descendant;
          if (c === '>') cType = CombinatorType.Child;

          continue;
        }

        if (['#', '.', '*', ':'].includes(c) || i === x.length - 1) {
          if (i === x.length - 1) text += c;

          if (c === '*') sType = SelectorType.Universal;
          pushCond();

          if (c === '#') sType = SelectorType.Id;
          if (c === '.') sType = SelectorType.Class;
          if (c === ':') sType = SelectorType.Pseudo;

          continue;
        }

        if (!isspace(c)) text += c;
      }

      if (conds.length > 0) sels.push({ type: cType, conds });

      out.push(sels);
    }

    return out;
  }

  constructor(selectors) {
    this.selectorText = selectors.trim();
    this.selectors = CSSRule.parseSelector(selectors);
  }

  addProperty(property, value) {
    property = property.trim();
    if (!property) return;

    this.properties[property] = value.trim();
  }
}

class CSSRegularAtRule {
  static {
    this.prototype.type = RuleType.RegularAt;
    this.prototype.atName = '';
    this.prototype.atCond = '';
  }

  constructor(name, cond) {
    this.atName = name;
    this.atCond = cond;
  }
}

class CSSNestedAtRule {
  static {
    this.prototype.type = RuleType.NestedAt;
    this.prototype.atName = '';
    this.prototype.atCond = '';
  }
  rules = [];

  constructor(name, cond) {
    this.atName = name;
    this.atCond = cond;
  }
}

export class CSSParser {
  static {
    this.prototype.mainState = MainState.None;
    this.prototype.stringState = StringState.None;
    this.prototype.atState = AtState.None;
    this.prototype.escaping = false;
  
    this.prototype.currentSelector = '';

    this.prototype.currentRule = null;
    this.prototype.parentRule = null;
  
    this.prototype.currentProp = '';
    this.prototype.currentValue = '';
  
    this.prototype.currentAtName = '';
    this.prototype.currentAtCond = '';
  }

  rules = [];

  constructor(bailing = true) {
    if (bailing) {
      const _parse = this.parse.bind(this);
      this.parse = (...args) => {
        try {
          return _parse(...args);
        } catch (e) {
          console.warn('CSSParser bailed', e);
          return [];
        }
      };
    }
  }

  parse(input) {
    const checkToken = (a, b) => !this.escaping && this.stringState === StringState.None && a === b;

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

    input = input.replace(/\/\*[\w\W]*?\*\//g, '');

    for (let i = 0; i < input.length; i++) {
      const peek = () => input[i + 1];

      const c = input[i];
      if (c == '\\') {
        this.escaping = true;
        continue;
      }

      // console.log(`${c} | state: ${this.mainState}`);

      const finishRule = () => {
        this.currentRule.addProperty(this.currentProp, this.currentValue);

        this.currentProp = '';
        this.currentValue = '';
        this.currentSelector = '';
      };

      switch (this.atState) {
        case AtState.Name: {
          // begin nested cond `(...)`
          if (checkToken(c, '(')) {
            this.currentAtCond = '(';

            this.atState = AtState.Cond;
            continue;
          }

          // begin regular cond `['"]...['"]` or ` ...`
          if (checkToken(c, '"') || checkToken(c, '\'') || isspace(c)) {
            this.atState = AtState.Cond;
            continue;
          }

          this.currentAtName += c;
          continue;
        }

        case AtState.Cond: {
          if (checkToken(c, '{')) {
            this.currentAtCond = this.currentAtCond.trim();

            // if we began and ended with (), slice them off
            if (this.currentAtCond.startsWith('(') && this.currentAtCond.endsWith(')')) {
              this.currentAtCond = this.currentAtCond.slice(1, -1).trim();
            }

            this.parentRule = new CSSNestedAtRule(this.currentAtName, this.currentAtCond);
            this.rules.push(this.parentRule);

            this.atState = AtState.None;
            this.mainState = MainState.None;
            continue;
          }

          // todo: also check for EOF?
          if (checkToken(c, ';')) {
            this.currentRule = new CSSRegularAtRule(this.currentAtName, this.currentAtCond);
            this.rules.push(this.currentRule);

            this.atState = AtState.None;
            this.mainState = MainState.None;
            continue;
          }

          this.currentAtCond += c;
          continue;
        }
      }

      switch (this.mainState) {
        case MainState.Property: {
          if (checkToken(c, ':')) {
            this.mainState = MainState.Value;
            continue;
          }

          if (checkToken(c, '}')) {
            finishRule();

            this.mainState = MainState.None;
            continue;
          }

          this.currentProp += c;

          this.escaping = false;
          continue;
        }

        case MainState.Value: {
          if (checkToken(c, ';') || checkToken(c, '}')) {
            finishRule();

            this.mainState = c === ';' ? MainState.Property : MainState.None;
            continue;
          }

          this.currentValue += c;

          this.escaping = false;
          continue;
        }

        case MainState.None: {
          // selector or at rule
          if (checkToken(c, '@')) {
            this.currentAtName = '';
            this.currentAtCond = '';

            this.atState = AtState.Name;
            continue;
          }

          if (checkToken(c, '{') && this.currentSelector.trim()) {
            this.currentRule = new CSSRule(this.currentSelector);
            (this.parentRule ? this.parentRule.rules : this.rules).push(this.currentRule);

            this.mainState = MainState.Property;
            continue;
          }

          if (checkToken(c, '}')) { // closing at rule (or rogue) }
            if (this.parentRule) this.parentRule = null;

            continue;
          }

          this.currentSelector += c;

          this.escaping = false;
          continue;
        }
      }
    }

    return this.rules;
  }
}