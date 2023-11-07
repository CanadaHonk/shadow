export default ({ url }) => {
  const { error, url: erroringURL } = JSON.parse(atob(url.split('?')[1]));

  let title = '';
  if (error.includes('HTMLParser')) title = 'HTML parser error';
  if (error.includes('CSSParser')) title = 'CSS parser error';
  if (error.includes('Render')) title = 'Render error';
  if (error.includes('Layout')) title = 'Layout error';

  return `<title>Shadow error</title>
<meta name="color-scheme" content="dark light">
<body>
<h1>Page crashed</h1>
${title ? `<h2>${title}</h2>` : ''}

<pre>${error.replaceAll('\n', '<br>')}</pre>

<a target="_parent" href="https://github.com/CanadaHonk/shadow/issues/new?title=${encodeURIComponent(`Crash: ${erroringURL}`)}&body=${encodeURIComponent(error)}">Report on GitHub Issues</a>

<style>
body {
  font-family: monospace;
}

h1 {
  color: rgb(250, 40, 40);
}
</style>
</body>`;
};