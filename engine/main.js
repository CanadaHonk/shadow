import { Page } from './network.js';
import { HTMLParser } from './htmlparser.js';
import { constructLayout } from './layout.js';
import { Renderer } from './renderer.js';
import * as JS from './js/index.js';
import * as AboutPages from './about/index.js';

window._js = JS;

window.version = `2023.10.27`;

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

let renderer, initialLoad = true;
const _load = async (url, baseUrl = null, push = true) => {
  if (!renderer) renderer = new Renderer();

  console.log(url);

  let realURL = url;
  if (url.startsWith('about:')) {
    const page = url.slice('about:'.length).split('?')[0];
    const html = AboutPages[page] ? AboutPages[page]({ url }) : `<span>about: page not found</span>`;
    realURL = 'data:text/html;base64,' + btoa(html);
  }

  if (realURL.startsWith('data:')) baseUrl = new URL('/', location.href);

  history[push && !initialLoad ? 'pushState' : 'replaceState']({ url, baseUrl: baseUrl?.toString?.() }, '', '?' + (baseUrl ? '' : url));

  const page = new Page(realURL);
  if (baseUrl) page.baseURL = baseUrl;

  let html = await (await page.fetch(realURL)).text();

  console.log(html);

  const parser = new HTMLParser();
  const doc = parser.parse(html).process();
  window._doc = doc;

  console.log(doc);

  doc.page = page;

  const layout = constructLayout(doc, renderer);
  console.log(layout);

  const title = layout.querySelector('title');

  if (title) {
    title_setter.innerHTML = (title.content || title.children[0]?.content).trim();
  } else {
    title_setter.textContent = realURL.replace('https://', '');
  }

  favicon_setter.href = page.resolve('/favicon.ico');

  initialLoad = false;
  renderer.layout = layout;
};

const load = (...args) => _load(...args).catch(e => error(e));
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