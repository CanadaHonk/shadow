const days = new Date(new Date() - new Date('2023-10-23')).getDate();
const weeks = Math.floor(days / 7);

const demos = [
  [ 'https://serenityos.org', 'basic - looks good' ],
  [ 'https://serenityos.org/happy/1st/', 'a lot of text and images - looks good' ],
  [ 'https://serenityos.org/happy/2nd/', 'advanced-er CSS, plus JS - looks good' ],
  // [ 'https://info.cern.ch/hypertext/WWW/TheProject.html', 'basically spot on' ],
  // [ 'https://www.stroustrup.com', 'usable?' ],
  // [ 'https://cs.sjoy.lol', 'usable?' ],
  [ 'https://example.com', 'almost perfect' ],
  [ 'https://mozilla.github.io/krakenbenchmark.mozilla.org/', 'older JS benchmark' ],
  [ 'http://proofcafe.org/jsx-bench/js/sunspider.html', 'older older JS benchmark' ],
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
  '(partial) navigation via real browser history api',
  'css color-scheme',
  '<iframe> (partial)',
  'css margin: auto'
];

export default () => `<title>Shadow</title>
<meta name="color-scheme" content="dark light">
<body>
<h1>welcome to Shadow <small>v${version}</small></h1>
<p>Shadow is a ${weeks} week old novel browser engine made (almost) entirely in JS from scratch,<br>only using the parent browser for networking (<code>fetch</code>) and the rendering backend (<code>&lt;canvas&gt;</code>)</p>
<p>here's a twist: <u>you're using it right now</u>!</p>
<p>here are some debug keybinds for you:</p>
<ul>
<li><b>Z</b>: toggle inspect mode (hover over stuff)</li>
<li><b>V</b>: prompt to load url</li>
<li><b>R</b>: reload the current page</li>
<li><b>H</b>: go back to welcome page (here)</li>
<li><b>P</b>: open current page in real browser</li>
<li><b>X</b>: switch preferred color scheme (light/dark)</li>
<li><b>C</b>: dump parsed html</li>
<li><b>J</b>: cycle JS engine (host -> none -> SpiderMonkey -> Kiesel) (reloads the page)</li>
</ul>

<div>this page loaded in: <span id="loadtime"></span></div>

<h2>demo sites</h2>
<ul>${demos.map(x => `<li><a href="${x[0]}">${x[0]}</a> (${x[1]})</li>`).join('\n')}</ul>

<h2>known issues</h2>
<ul>
<li>basically every site doesn't work ;)
<li>no text highlighting yet
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
<li><a href="engine/ua.css">UA stylesheet</a></li>
<li><a href="https://github.com/CanadaHonk/shadow" target="_parent">source code</a></li>
</ul>

<h2>components of Shadow</h2>
<img width=800 src="https://mermaid.ink/svg/pako:eNpVkT1vhDAMhv8KygxVaTuB1Kljp96axSLukQtJUByK0N399zogFJAyOI_f1x_yXXReoWjENcDYF98_rXRF0YH7A6peqs_eU0zEYZx9MNpdj5R6UH6uGEQ7jBAIwwlnV8LKW2YdUVZmH2c4vzbfBYwGWPwUszn_t4hRQKcwbOX2-KQ8wG2vBGcgmzahUXPSemdwOXKjkXDIjR9-jJV2j9vqvlEed42TTbp1Lu3MJS4DFq9lXdb83gqKwRtsAqr2LKnfy_pjT_MFllaUwvI8oBXf5J7UUsQeLUrRcKggGCmke7IOpugvi-tEE8OEpZhGBRG_NHAhK5pfGAif_zYlpas" alt="Component flowchart">

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
<script>
document.querySelector('#loadtime').innerHTML = performance.now().toFixed(0) + 'ms';
</script>
</body>`;