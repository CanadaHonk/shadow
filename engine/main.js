import { Page } from './network.js';
import { HTMLParser } from './htmlparser.js';
import { constructLayout } from './layout.js';
import { Renderer } from './renderer.js';


let renderer;
const load = async (url, baseUrl = null) => {
  if (!renderer) renderer = new Renderer();
  console.log(url);

  const page = new Page(url);
  if (baseUrl) page.baseURL = baseUrl;

  let html = await (await page.fetch(url)).text();

  console.log(html);

  const parser = new HTMLParser();
  const doc = parser.parse(html).process();
  window._doc = doc;

  console.log(doc);

  doc.page = page;

  const layout = constructLayout(doc, renderer);

  console.log(layout);

  renderer.layout = layout;
};

window.load = load;

const demos = [
  [ 'https://serenityos.org', '8/10' ],
  [ 'https://info.cern.ch/hypertext/WWW/TheProject.html', '9/10' ]
];

const supported = [
  'html parsing (partial)',
  'css parsing (partial)',
  'basic inline and block model',
  'renderer',
  'user agent stylesheet',
  '<style>',
  'self closing html',
  '<font> (partial)',
  'light/dark color schemes',
  'links',
  'link hints (bottom left text)',
  'font-size, font-family, font-style',
  'color',
  'background-color',
  'css light-dark() function',
  'css selectors (partial: tag, id, class)',
  '<img> (partial)',
  'really basic scrolling',
  'cursor',
  'margin collapsing',
];

const version = `2023.10.24`;
const days = new Date(new Date() - new Date('2023-10-23')).getDate();

const shadow = `<i><b>&lt;shadow&gt;</b></i>`;
load('data:text/html;base64,' + btoa(
`<body>
<h1>welcome to ${shadow} <small>v${version}</small></h1>
<p><i><b>&lt;shadow&gt;</b></i> is a ${days} day old novel web engine made entirely in JS from scratch, only using the parent browser for networking (<code>fetch</code>) and the rendering backend (<code>&lt;canvas&gt;</code>)</p>
<p>here's a twist: <u>you're using it right now</u>! you can use the fps counter in the top right as an indicator. expect nothing to work :)</p>
<p>here are some debug keybinds for you:</p>
<ul>
<li><b>z</b>: hold for inspect mode (hover over stuff)</li>
<li><b>x</b>: switch color scheme (light/dark)</li>
<li><b>c</b>: dump parsed html</li>
<li><b>v</b>: prompt to load url</li>
</ul>
<h2>demo sites</h2>
<ul>${demos.map(x => `<li><a href="${x[0]}">${x[0]}</a> (${x[1]} score)</li>`).join('\n')}</ul>

<h2>known issues</h2>
<ul>
<li>basically every modern site doesn't work ;)
<li>performance is bad. this is because ${shadow} currently does ~0 optimizations.<br> <b>we recompute the entire layout every frame</b>, no (in)validation. it can be much better later :)</li>
<li>no text wrapping yet (!)
</ul>

<h2>implemented</h2>
<ul>${supported.map(x => `<li>${x.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</li>`).join('\n')}</ul>

<h2>bonus</h2>
<ul>
<li>tip: refresh (ctrl+r) to reset the engine</li>
<li>tip: ctrl+click a link to open in new tab (actual browser)</li>
<li><a href="engine/ua.css" target="_parent">UA stylesheet</a> (external)</li>
<li><a href="https://github.com/CanadaHonk/shadow" target="_parent">source code</a> (external)</li>
</ul>

<style>
body {
  font-family: sans-serif;
}

small {
  font-size: medium;
  margin-top: 16px;
  margin-left: 6px;
}

li {
  margin-bottom: 2px;
}

h2 {
  margin-top: 1.5em;
}
</style>
</body>`), new URL('/', location.href));

// load('https://serenityos.org');
// load('https://info.cern.ch/hypertext/WWW/TheProject.html');
// load('https://whatwg.org');

// load('http://localhost:1337/test.html');

// tie it all together!