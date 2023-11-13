import { Page } from './network.js';
import { HTMLParser } from './htmlparser.js';
import { constructLayout } from './layout.js';
import { Renderer } from './renderer.js';
import * as JS from './js/index.js';
import * as AboutPages from './about/index.js';

// we do not use any of these in main world yet so do not import
// import './polys.js';


window._js = JS;

if (window.crossOriginIsolated === false) {
  console.log('not cross-origin isolated, registering service worker');
  const worker = await navigator.serviceWorker.register('sw.js');
  // if (worker.active.state === 'activated') location.reload();
}

window.version = `2023.11.07`;

const welcome = () => load('about:welcome');
window.welcome = welcome;

const error = e => console.error(e) || load(`about:error?${btoa(JSON.stringify({ error: e.stack ?? e, url: window._location.url }))}`);
// const error = e => { throw e; };
window.error = error;

window.onpopstate = ({ state }) => {
  const url = state?.url ?? location.search.slice(1);
  const baseUrl = state?.baseUrl ? new URL(state.baseUrl) : null;

  if (url) load(url, baseUrl, false);
    else welcome();
};

window.reload = () => load(lastLoad[0], lastLoad[1], false);

window.profile = {};
window.profileSubsteps = {};
window.profileStart = () => {
  const start = performance.now();
  profile = { start };
  profileSubsteps = {};

  profile.last = start;
};

window.profileStep = name => {
  const now = performance.now();
  const time = now - profile.last;

  profile.last = now;
  profile[name] = time;
  if (profile.lastSub) {
    for (const x in profileSubsteps) {
      profile['  ' + x] = profileSubsteps[x];
    }

    profileSubsteps = {};
    delete profile.lastSub;
  }
};

window.profileSubstep = name => {
  const now = performance.now();
  const time = now - (profile.lastSub ?? profile.last);

  profile.lastSub = now;
  profileSubsteps[name] = time;
};

window.profileStop = () => {
  const start = profile.start;
  profile.total = performance.now() - start;

  delete profile.last;
  delete profile.lastSub;
  // delete profile.start;
};

let renderer, initialLoad = true, lastLoad;
const _load = async (url, baseUrl = null, push = true) => {
  profileStart();

  if (!renderer) renderer = new Renderer();
  profileStep('setup renderer');

  // wipe current page
  _js.stopAll();
  profileStep('stop js');

  /* const mock = new LayoutNode({}, renderer);
  mock.document = { cssRules: [] };
  mock.root = mock;

  renderer.layout = mock; */

  let realURL = url, html;
  if (url.startsWith('about:')) {
    const page = url.slice('about:'.length).split('?')[0];
    html = AboutPages[page] ? AboutPages[page]({ url }) : `<span>about: page not found</span>`;
    realURL = 'data:text/html,' + encodeURIComponent(html);
    push = false;
  }

  if (realURL.startsWith('data:')) baseUrl = new URL('/', location.href);

  profileStep('url handling');

  window._location = { url, realURL, baseUrl };

  history[push && !initialLoad ? 'pushState' : 'replaceState']({ url, baseUrl: baseUrl?.toString?.() }, '', '?' + (baseUrl ? '' : url));
  profileStep('history api');

  window.beganLoad = Date.now();

  const page = new Page(realURL);
  if (baseUrl) page.baseURL = baseUrl;
  profileStep('new page');

  if (!html) {
    const res = await page.fetch(realURL);
    profileStep('fetch');

    switch (res.headers.get('Content-Type').split(';')[0]) {
      case 'text/javascript':
      case 'text/css':
        html = `<meta name="color-scheme" content="dark light"><body><pre>${await res.text()}</pre></body>`;
        break;

      default:
        html = await res.text();
        break;
    }
  }

  profileStep('get html');

  // console.log(html);

  const parser = new HTMLParser();
  const doc = parser.parse(html);
  window._doc = doc;
  profileStep('parse html');

  // console.log(doc);

  doc.page = page;

  const layout = await constructLayout(doc, renderer);
  // console.log(layout);

  const title = layout.querySelector('title');

  if (title) {
    title_setter.innerHTML = (title.content || title.children[0]?.content).trim();
  } else {
    title_setter.textContent = realURL.replace('https://', '');
  }

  favicon_setter.href = page.resolve('/favicon.ico');

  profileStep('use metadata');

  initialLoad = false;

  profileStop();
};

const load = (...args) => {
  lastLoad = args;
  return _load(...args).catch(e => error(e));
};
window.load = load;

const omniload = query => {
  if (query === null) return;
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