export default ({ url }) => {
  const error = atob(url.split('?')[1]);

  let title = 'Fatal error';
  if (error.includes('HTMLParser')) title = 'HTML parser error';
  if (error.includes('CSSParser')) title = 'CSS parser error';
  if (error.includes('Render')) title = 'Render error';
  if (error.includes('Layout')) title = 'Layout error';

  return `<title>&lt;shadow&gt; error</title>
<body>
<h1>${title}</h1>

<pre>${error}</pre>

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