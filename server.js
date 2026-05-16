// Custom server that keeps the app alive
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.argv.includes('--dev');
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Increase timeout for large uploads
  server.timeout = 60000;
  server.headersTimeout = 65000;
  server.requestTimeout = 60000;

  server.listen(port, () => {
    console.log(`> Wedding Album ready on http://localhost:${port}`);
  });

  // Keep process alive
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
  });
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
  });
});
