const MainState = {
  None: 0,
  Property: 1,
  Value: 2,
  AtRule: 3
};

const StringState = {
  None: 0,
  Single: 1,
  Double: 2
};

export const SelectorType = {
  Tag: 0,
  Id: 1,
  Class: 2,
  Universal: 3,
};

export const CombinatorType = {
  Descendant: 0,
  Child: 1,
};

const isspace = c => c === ' ';

export class CSSRule {
  selectors = [];
  properties = {};

  static parseSelector(input) {
    input = input.trim();
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

        // if (x.includes'#a > div') console.log({c, text, conds, cType, sType});

        if (isCombinator(c) && text && (c !== ' ' || (!isCombinator(x[i + 1]) && !isspace(x[i + 1])))) {
          pushCond();

          sels.push({ type: cType, conds });
          conds = [];

          if (c === ' ') cType = CombinatorType.Descendant;
          if (c === '>') cType = CombinatorType.Child;

          continue;
        }

        if (['#', '.', '*'].includes(c) || i === x.length - 1) {
          if (i === x.length - 1) text += c;

          if (c === '*') sType = SelectorType.Universal;
          pushCond();

          if (c === '#') sType = SelectorType.Id;
          if (c === '.') sType = SelectorType.Class;

          continue;
        }

        if (!isspace(c)) text += c;
      }

      if (conds.length > 0) sels.push({ type: cType, conds });

      const TS = combs => combs.reduce((acc, x) => acc + `${x.type === 0 ? ' ' : ' > '}${x.conds[0]?.type === 0 ? '' : '#'}${x.conds[0]?.text}`, '').trim();
      if (x.includes('*')) console.log(x, '|', sels, TS(sels));

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

export class CSSParser {
  mainState = MainState.None;
  stringState = StringState.None;
  escaping = false;

  currentSelector = '';

  rules = [];
  currentRule = null;

  currentProp = '';
  currentValue = '';

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

      switch (this.mainState) {
        case MainState.Property: {
          if (checkToken(c, ':')) {
            this.mainState = MainState.Value;

            this.escaping = false;
            continue;
          }

          if (checkToken(c, '}')) {
            finishRule();

            this.mainState = MainState.None;

            this.escaping = false;
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

            this.escaping = false;
            continue;
          }

          this.currentValue += c;

          this.escaping = false;
          continue;
        }

        case MainState.None: {
          // selector or at rule
          if (checkToken(c, '@')) {
            // if (this.currentSelector.length !== 0) throw new Error('unexpected symbol @');

            // this.mainState = MainState.AtRule;

            throw new Error('@rules are unsupported!');
          }

          if (checkToken(c, '{')) {
            this.mainState = MainState.Property;

            this.currentRule = new CSSRule(this.currentSelector);
            this.rules.push(this.currentRule);

            this.escaping = false;
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