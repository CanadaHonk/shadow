// import { createCanvas, Image } from 'canvas';
import gi from 'node-gtk';

const Gtk = gi.require('Gtk', '3.0');
const Gdk = gi.require('Gdk');
const Cairo = gi.require('cairo');
const Pango = gi.require('Pango');
const PangoCairo = gi.require('PangoCairo');

gi.startLoop();
Gtk.init();

const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
});

window.on('show', Gtk.main);
window.on('destroy', Gtk.mainQuit);
window.setResizable(true);
window.setDefaultSize(1280, 720);
// window.showAll();

const drawingArea = new Gtk.DrawingArea();

let ctx, layout;
/* const surface = new Cairo.ImageSurface(Cairo.Format.RGB24, 300, 300);
const ctx = new Cairo.Context(surface);
const layout = PangoCairo.createLayout(ctx); */

const vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });

// vbox.packStart(surface, true, true, 0);
vbox.packStart(drawingArea, true, true, 0);

// window.add(vbox);

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

globalThis.uaPath = join(__dirname, '..', 'engine', 'ua.css');

globalThis.node = true;

globalThis.innerWidth = 0;
globalThis.innerHeight = 0;

const namedColors = {
  "aliceblue": "#f0f8ff",
  "antiquewhite": "#faebd7",
  "aqua": "#00ffff",
  "aquamarine": "#7fffd4",
  "azure": "#f0ffff",
  "beige": "#f5f5dc",
  "bisque": "#ffe4c4",
  "black": "#000000",
  "blanchedalmond": "#ffebcd",
  "blue": "#0000ff",
  "blueviolet": "#8a2be2",
  "brown": "#a52a2a",
  "burlywood": "#deb887",
  "cadetblue": "#5f9ea0",
  "chartreuse": "#7fff00",
  "chocolate": "#d2691e",
  "coral": "#ff7f50",
  "cornflowerblue": "#6495ed",
  "cornsilk": "#fff8dc",
  "crimson": "#dc143c",
  "cyan": "#00ffff",
  "darkblue": "#00008b",
  "darkcyan": "#008b8b",
  "darkgoldenrod": "#b8860b",
  "darkgray": "#a9a9a9",
  "darkgreen": "#006400",
  "darkgrey": "#a9a9a9",
  "darkkhaki": "#bdb76b",
  "darkmagenta": "#8b008b",
  "darkolivegreen": "#556b2f",
  "darkorange": "#ff8c00",
  "darkorchid": "#9932cc",
  "darkred": "#8b0000",
  "darksalmon": "#e9967a",
  "darkseagreen": "#8fbc8f",
  "darkslateblue": "#483d8b",
  "darkslategray": "#2f4f4f",
  "darkslategrey": "#2f4f4f",
  "darkturquoise": "#00ced1",
  "darkviolet": "#9400d3",
  "deeppink": "#ff1493",
  "deepskyblue": "#00bfff",
  "dimgray": "#696969",
  "dimgrey": "#696969",
  "dodgerblue": "#1e90ff",
  "firebrick": "#b22222",
  "floralwhite": "#fffaf0",
  "forestgreen": "#228b22",
  "fuchsia": "#ff00ff",
  "gainsboro": "#dcdcdc",
  "ghostwhite": "#f8f8ff",
  "gold": "#ffd700",
  "goldenrod": "#daa520",
  "gray": "#808080",
  "green": "#008000",
  "greenyellow": "#adff2f",
  "grey": "#808080",
  "honeydew": "#f0fff0",
  "hotpink": "#ff69b4",
  "indianred": "#cd5c5c",
  "indigo": "#4b0082",
  "ivory": "#fffff0",
  "khaki": "#f0e68c",
  "lavender": "#e6e6fa",
  "lavenderblush": "#fff0f5",
  "lawngreen": "#7cfc00",
  "lemonchiffon": "#fffacd",
  "lightblue": "#add8e6",
  "lightcoral": "#f08080",
  "lightcyan": "#e0ffff",
  "lightgoldenrodyellow": "#fafad2",
  "lightgray": "#d3d3d3",
  "lightgreen": "#90ee90",
  "lightgrey": "#d3d3d3",
  "lightpink": "#ffb6c1",
  "lightsalmon": "#ffa07a",
  "lightseagreen": "#20b2aa",
  "lightskyblue": "#87cefa",
  "lightslategray": "#778899",
  "lightslategrey": "#778899",
  "lightsteelblue": "#b0c4de",
  "lightyellow": "#ffffe0",
  "lime": "#00ff00",
  "limegreen": "#32cd32",
  "linen": "#faf0e6",
  "magenta": "#ff00ff",
  "maroon": "#800000",
  "mediumaquamarine": "#66cdaa",
  "mediumblue": "#0000cd",
  "mediumorchid": "#ba55d3",
  "mediumpurple": "#9370db",
  "mediumseagreen": "#3cb371",
  "mediumslateblue": "#7b68ee",
  "mediumspringgreen": "#00fa9a",
  "mediumturquoise": "#48d1cc",
  "mediumvioletred": "#c71585",
  "midnightblue": "#191970",
  "mintcream": "#f5fffa",
  "mistyrose": "#ffe4e1",
  "moccasin": "#ffe4b5",
  "navajowhite": "#ffdead",
  "navy": "#000080",
  "oldlace": "#fdf5e6",
  "olive": "#808000",
  "olivedrab": "#6b8e23",
  "orange": "#ffa500",
  "orangered": "#ff4500",
  "orchid": "#da70d6",
  "palegoldenrod": "#eee8aa",
  "palegreen": "#98fb98",
  "paleturquoise": "#afeeee",
  "palevioletred": "#db7093",
  "papayawhip": "#ffefd5",
  "peachpuff": "#ffdab9",
  "peru": "#cd853f",
  "pink": "#ffc0cb",
  "plum": "#dda0dd",
  "powderblue": "#b0e0e6",
  "purple": "#800080",
  "rebeccapurple": "#663399",
  "red": "#ff0000",
  "rosybrown": "#bc8f8f",
  "royalblue": "#4169e1",
  "saddlebrown": "#8b4513",
  "salmon": "#fa8072",
  "sandybrown": "#f4a460",
  "seagreen": "#2e8b57",
  "seashell": "#fff5ee",
  "sienna": "#a0522d",
  "silver": "#c0c0c0",
  "skyblue": "#87ceeb",
  "slateblue": "#6a5acd",
  "slategray": "#708090",
  "slategrey": "#708090",
  "snow": "#fffafa",
  "springgreen": "#00ff7f",
  "steelblue": "#4682b4",
  "tan": "#d2b48c",
  "teal": "#008080",
  "thistle": "#d8bfd8",
  "tomato": "#ff6347",
  "turquoise": "#40e0d0",
  "violet": "#ee82ee",
  "wheat": "#f5deb3",
  "white": "#ffffff",
  "whitesmoke": "#f5f5f5",
  "yellow": "#ffff00",
  "yellowgreen": "#9acd32"
};

const fastConvert = _ => { // convert any input color into [ r, g, b, a? ]
  let color = _;
  if (namedColors[color]) color = namedColors[color];

  if (color.startsWith('rgb(')) return color.slice(4, -1).split(',').map(x => parseFloat(x) / 255).concat(1); // rgb(r, g, b)
  if (color.startsWith('rgba(')) return color.slice(5, -1).split(',').map(x => parseFloat(x) / 255); // rgba(r, g, b, a)

  if (color.startsWith('#')) { // #rrggbb / #rgb (-> #rrggbb)
    if (color.length === 4) color = '#' + color[1].repeat(2) + color[2].repeat(2) + color[3].repeat(3); // #012 -> #001122

    // convert hex value into int/decimal, then use bitwise for performance (way faster than string manipulation)
    const dec = parseInt(color.slice(1), 16);
    let r = (dec >> 16) & 0xff;
    let g = (dec >> 8) & 0xff;
    let b = (dec) & 0xff;

    return [ r / 255, g / 255, b / 255, 1 ];
  }
};

// window.setTitlebar(null);
// window.setDecorated(false);

const tabs = [];

const makeTab = url => {

};

// const notebook = new Gtk.Notebook();
// notebook.appendPage(vbox, Gtk.TextView.newWithBuffer(new Gtk.TextBuffer()));
// notebook.appendPage(vbox);
// notebook.setTabLabelText(vbox, 'hello');
// window.add(notebook);

window.setTitle('shadow');

window.add(vbox);

const cursors = {};
const getCursor = x => {
  if (cursors[x]) return cursors[x];
  return cursors[x] = Gdk.Cursor.newFromName(window.getDisplay(), x);
};

let c;
globalThis.window = globalThis;
globalThis.document = {
  createElement: tagName => {
    if (tagName === 'canvas') {
      let lastCursor = 'default';
      return new (class Canvas {
        style = {
          set cursor(x) {
            if (x === 'auto') x = 'default';
            if (lastCursor === x) return;
            lastCursor = x;
            console.log(x, getCursor(x));
            window.getWindow().setCursor(getCursor(x));
          }
        };
        constructor() {

        }

        getContext() {
          let fillR, fillG, fillB, fillA, _path, baseline = 'top', fontDesc = Pango.fontDescriptionFromString('sans');
          fontDesc.setAbsoluteSize(10 * Pango.SCALE);

          const savePath = () => {
            _path = ctx.copyPathFlat();
            ctx.newPath();
          };

          const restorePath = () => {
            ctx.newPath();
            ctx.appendPath(_path);
            // Cairo.destroyPath(_path);
          };

          return c = {
            clearRect: (x, y, width, height) => {
              savePath();
              ctx.rectangle(x, y, width, height);
              ctx.setSourceRgba(0, 0, 0, 0);
              // ctx.setOperator(Cairo.Operator.CLEAR);
              ctx.fill();
              restorePath();
            },

            set fillStyle(x) {
              // console.log('fillStyle', x);
              0, [fillR, fillG, fillB, fillA] = fastConvert(x);
            },

            set textBaseline(x) {
              baseline = x;
            },

            set font(x) {
              // console.log('font', x);
              let [ style, weight, size, ...family ] = x.split(' ');
              weight = parseFloat(weight) || (weight === 'bold' ? 700 : 400);
              size = parseFloat(size.slice(0, -2));
              family = family.join(' ');
              if (family === 'sans-serif') family = 'sans';

              // console.log(x, { style, weight, size, family });

              // const desc = Pango.fontDescriptionFromString(family);

              // todo: style
              fontDesc.setWeight(weight);
              fontDesc.setFamily(family);
              fontDesc.setAbsoluteSize(size * Pango.SCALE);

              layout.setFontDescription(fontDesc);

              // ctx.selectFontFace(family, Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
              // ctx.setFontSize(parseFloat(size.slice(0, -2)));
            },

            rect: (x, y, width, height) => {
              ctx.rectangle(x, y, width, height);
            },

            fill: () => {
              ctx.setSourceRgba(fillR, fillG, fillB, fillA);
              ctx.fill();
            },

            fillRect: (x, y, width, height) => {
              // console.log('fillRect', [ fillR, fillG, fillB, fillA ], x, y, width, height);
              savePath();
              c.rect(x, y, width, height);
              c.fill();
              restorePath();
            },

            measureText: str => {
              layout.setText(str, -1);
              PangoCairo.updateLayout(ctx, layout);

              let [ inkRect, logicalRect ] = layout.getExtents();

              /* console.log(str, {
                width: logicalRect.width * (1 / Pango.SCALE),
                height: logicalRect.height * (1 / Pango.SCALE)
              }); */

              // console.log('a', Pango.SCALE);
              return {
                width: logicalRect.width * (1 / Pango.SCALE),
                height: inkRect.height * (1 / Pango.SCALE)
              };
            },

            fillText: (str, x, y) => {
              if (typeof str !== 'string') str = str.toString();
              // console.log('fillText', [ fillR, fillG, fillB, fillA ], str, x, y);
              layout.setText(str, -1);
              PangoCairo.updateLayout(ctx, layout);

              let realY = y;

              let [ inkRect, logicalRect ] = layout.getExtents();

              const ascent = (1 / Pango.SCALE) * layout.getBaseline();
              const descent = ((1 / Pango.SCALE) * logicalRect.height) - ascent;

              if (baseline === 'bottom') realY -= ascent + descent;

              savePath();

              ctx.setSourceRgba(fillR, fillG, fillB, fillA);
              ctx.moveTo(x, realY);

              PangoCairo.layoutPath(ctx, layout);

              ctx.fill();

              // ctx.showText(str);
              restorePath();
            },

            setTransform: (m11, m12, m21, m22, m41, m42) => {

            },

            translate: (x, y) => {

            },

            scale: (x, y) => {
              // stub
            }
          };
        }
      })();
    }
  },

  body: {
    appendChild: () => {},
    style: {}
  }
};

// globalThis.requestAnimationFrame = f => setImmediate(f);
globalThis.requestAnimationFrame = () => {};

globalThis.matchMedia = query => {
  switch (query) {
    case '(prefers-color-scheme: dark)':
      // todo

    default:
      return false;
  }
};

globalThis.location = {
  search: '',
  href: 'https://shadow.goose.icu'
};

globalThis.history = {
  replaceState: (state, _, url) => {},
  pushState: (state, _, url) => {},
};

// stub fake dom elements
globalThis.title_setter = {
  set innerHTML(v) {},
  set textContent(v) {}
};

globalThis.favicon_setter = {
  set href(v) {}
};

globalThis.devicePixelRatio = 1;

// stub image stuff
globalThis.Image = class Image {
  style = {};
};

await import('../engine/main.js');

let oldWidth, oldHeight;
drawingArea.on('draw', _ => {
  const width = drawingArea.getAllocatedWidth();
  const height = drawingArea.getAllocatedHeight();

  ctx = _;
  layout = PangoCairo.createLayout(_);

  c.fillStyle = globalThis._renderer.layout.colorAbs('Canvas');
  c.fillRect(0, 0, width, height);

  globalThis.innerWidth = width;
  globalThis.innerHeight = height;

  if (width !== oldWidth || height !== oldHeight) {
    globalThis.onresize();

    oldWidth = width;
    oldHeight = height;
  }

  globalThis._renderer.update();

  drawingArea.queueDraw();

  return true;
});

drawingArea.setCanFocus(true);
drawingArea.setSensitive(true);
drawingArea.addEvents(Gdk.EventMask.ALL_EVENTS_MASK);

drawingArea.on('motion-notify-event', e => {
  globalThis.document.onmousemove({
    clientX: e.x,
    clientY: e.y,
    preventDefault: () => {}
  });

  return false;
});

drawingArea.on('button-press-event', e => {
  globalThis.document.onmousedown({
    clientX: e.x,
    clientY: e.y,
    preventDefault: () => {}
  });

  return false;
});

drawingArea.on('button-release-event', e => {
  globalThis.document.onmouseup({
    clientX: e.x,
    clientY: e.y,
    preventDefault: () => {}
  });

  return false;
});

drawingArea.on('key-press-event', e => {
  globalThis.document.onkeydown({
    key: Gdk.keyvalName(e.keyval),
    preventDefault: () => {}
  });

  return false;
});

drawingArea.on('key-release-event', e => {
  globalThis.document.onkeyup({
    key: Gdk.keyvalName(e.keyval),
    preventDefault: () => {}
  });

  return false;
});

setTimeout(() => window.showAll(), 1000);