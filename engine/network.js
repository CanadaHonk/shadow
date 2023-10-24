export class Page {
  constructor(url) {
    this.url = url;
    this.baseURL = url;
  }

  resolve(input) {
    return new URL(input, this.baseURL);
  }

  async fetch(input = '', corsProxy = !input.startsWith('http:') && !input.startsWith('data:')) {
    let url = this.resolve(input);
    return await fetch((corsProxy ? 'https://goose-cors.goosemod.workers.dev/?' : '') + url);
  }
}