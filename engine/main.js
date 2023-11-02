import { Page } from './network.js';
import { HTMLParser } from './htmlparser.js';
import { LayoutNode, constructLayout } from './layout.js';
import { Renderer } from './renderer.js';
import * as JS from './js/index.js';
import * as AboutPages from './about/index.js';

window._js = JS;

if (window.crossOriginIsolated === false) {
  console.log('not cross-origin isolated, registering service worker');
  const worker = await navigator.serviceWorker.register('sw.js');
  if (worker.active.state === 'activated') location.reload();
}

window.version = `2023.11.01`;

const welcome = () => load('about:welcome');
window.welcome = welcome;

const error = e => console.error(e) || load(`about:error?${btoa(e.stack ?? e)}`);
window.error = error;

window.onpopstate = ({ state }) => {
  const url = state?.url ?? location.search.slice(1);
  const baseUrl = state?.baseUrl ? new URL(state.baseUrl) : null;

  if (url) load(url, baseUrl, false);
    else welcome();
};

window.reload = () => load(...lastLoad);

let renderer, initialLoad = true, lastLoad;
const _load = async (url, baseUrl = null, push = true) => {
  if (!renderer) renderer = new Renderer();

  // wipe current page
  _js.stopAll();

  /* const mock = new LayoutNode({}, renderer);
  mock.document = { cssRules: [] };
  mock.root = mock;

  renderer.layout = mock; */

  console.log(url);

  let realURL = url;
  if (url.startsWith('about:')) {
    const page = url.slice('about:'.length).split('?')[0];
    const html = AboutPages[page] ? AboutPages[page]({ url }) : `<span>about: page not found</span>`;
    realURL = 'data:text/html,' + encodeURIComponent(html);
    push = false;
  }

  if (realURL.startsWith('data:')) baseUrl = new URL('/', location.href);

  window._location = { url, realURL, baseUrl };

  history[push && !initialLoad ? 'pushState' : 'replaceState']({ url, baseUrl: baseUrl?.toString?.() }, '', '?' + (baseUrl ? '' : url));

  const page = new Page(realURL);
  if (baseUrl) page.baseURL = baseUrl;

  const res = await page.fetch(realURL);

  let html;
  switch (res.headers.get('Content-Type').split(';')[0]) {
    case 'text/javascript':
    case 'text/css':
      html = `<meta name="color-scheme" content="dark light"><body><pre>${await res.text()}</pre></body>`;
      break;

    default:
      html = await res.text();
      break;
  }

  console.log(html);

  const parser = new HTMLParser();
  const doc = parser.parse(html);
  window._doc = doc;

  console.log(doc);

  doc.page = page;

  const layout = await constructLayout(doc, renderer);
  console.log(layout);

  const title = layout.querySelector('title');

  if (title) {
    title_setter.innerHTML = (title.content || title.children[0]?.content).trim();
  } else {
    title_setter.textContent = realURL.replace('https://', '');
  }

  favicon_setter.href = page.resolve('/favicon.ico');

  initialLoad = false;
};

const load = (...args) => {
  lastLoad = args;
  return _load(...args).catch(e => error(e));
};
window.load = load;

const omniload = query => {
  let url;
  try {
    url = new URL(query);
  } catch {
    try {
      url = new URL('https://' + query);
    } catch (e) {
      return error(e);
    }
  }
  return load(url.toString())
}
window.omniload = omniload;

if (location.search) load(decodeURIComponent(location.search.slice(1)));
  else welcome();

// load('https://serenityos.org');
// load('https://info.cern.ch/hypertext/WWW/TheProject.html');
// load('https://whatwg.org');

// load('http://localhost:1337/test.html');

// tie it all together!