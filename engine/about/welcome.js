const days = new Date(new Date() - new Date('2023-10-23')).getDate();

const demos = [
  [ 'https://serenityos.org', 'looks pretty good' ],
  [ 'https://info.cern.ch/hypertext/WWW/TheProject.html', 'basically spot on' ],
  [ 'https://www.stroustrup.com', 'usable?' ],
  [ 'https://cs.sjoy.lol', 'usable?' ],
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
  'basic scrolling (no scrollbar, just via scroll wheel)',
  'cursor',
  'margin collapsing',
  'copying page title and favicon to real browser tab',
  '(partial) navigation via real browser history api'
];

export default () => `<title>Shadow</title>
<body>
<h1>welcome to Shadow <small>v${version}</small></h1>
<p>Shadow is a ${days} day old novel web engine made (almost) entirely in JS from scratch, only using the parent browser for networking (<code>fetch</code>) and the rendering backend (<code>&lt;canvas&gt;</code>)</p>
<p>here's a twist: <u>you're using it right now</u>! you can use the fps counter in the top right as an indicator. also, expect nothing to work :)</p>
<p>here are some debug keybinds for you:</p>
<ul>
<li><b>Z</b>: hold for inspect mode (hover over stuff)</li>
<li><b>V</b>: prompt to load url</li>
<li><b>R</b>: reload the current page</li>
<li><b>H</b>: go back to welcome page (here)</li>
<li><b>X</b>: switch color scheme (light/dark)</li>
<li><b>C</b>: dump parsed html</li>
<li><b>J</b>: cycle JS engine (host -> none -> SpiderMonkey -> Kiesel) (reloads the page)</li>
</ul>
<h2>demo sites</h2>
<ul>${demos.map(x => `<li><a href="${x[0]}">${x[0]}</a> (${x[1]})</li>`).join('\n')}</ul>

<h2>known issues</h2>
<ul>
<li>basically every site doesn't work ;)
<li>no text wrapping yet (!)
<li>no text highlighting yet
<li>html parser is not happy
</ul>

<h2>javascript <span class="new">new!</span></h2>
<p>Shadow has some experimental javascript support, with a very limited DOM api (<code>document</code>, <code>window</code>, etc).</p>
<p>bonus: <b>you can choose which JS engine to use!</b> (press J to cycle between)</p>

<ul>
<li>host (your browser's) - default</li>
<li>none (no JS)</li>
<li><a href="https://spidermonkey.dev" target="_parent">SpiderMonkey</a> (Firefox's JS engine, Wasm)</li>
<li><a href="https://kiesel.dev" target="_parent">Kiesel</a> (a WIP engine from scratch in Zig, Wasm)</li>
</ul>

<button onclick="let el = document.querySelector('#counter'); el.textContent = parseInt(el.textContent) + 1">click me!</button>&nbsp;<span id="counter">0</span><noscript dynamic=true>(you have JS disabled, press J)</noscript>

<h2>bonus</h2>
<ul>
<li>tip: use browser controls (icons or alt+arrow key) to navigate forward/backward in history</li>
<li>tip: ctrl+click a link to open in new tab (actual browser)</li>
<li><a href="engine/ua.css" target="_parent">UA stylesheet</a></li>
<li><a href="https://github.com/CanadaHonk/shadow" target="_parent">source code</a></li>
</ul>

<h2>implemented</h2>
<ul>${supported.map(x => `<li>${x.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</li>`).join('\n')}</ul>

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

.new {
  color: red;
  font-size: 0.8em;
}

noscript {
  margin-left: 20px;
  color: gray;
  font-size: 0.8em;
}
</style>
</body>`;