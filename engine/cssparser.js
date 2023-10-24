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
};

class CSSRule {
  selectors = [];
  properties = {};

  parseSelectors(input) {
    input = input.trim();
    const out = [];

    for (let x of input.split(',')) {
      x = x.trim();

      let type = SelectorType.Tag;
      let text = '';

      const sels = [];
      for (let i = 0; i < x.length; i++) {
        const c = x[i];

        if (c === '#' || c === '.' || i === x.length - 1) {
          if (i === x.length - 1) text += c;

          if (text) sels.push({ type, text });

          if (c === '#') type = SelectorType.Id;
          if (c === '.') type = SelectorType.Class;

          continue;
        }

        text += c;
      }

      out.push(sels);
    }

    return out;
  }

  constructor(selectors) {
    this.selectorText = selectors.trim();
    this.selectors = this.parseSelectors(selectors);
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

  constructor() {}

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

    const isspace = c => c === ' ';

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