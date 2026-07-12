const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || process.env.API_PORT || 3000);
const host = '0.0.0.0';
const distDir = path.resolve(__dirname, '../../dist/apps/web/browser');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendFile(filePath, response) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(response);
}

function resolveFile(requestPath) {
  const normalizedPath = decodeURIComponent(requestPath.split('?')[0]);
  const safePath =
    normalizedPath === '/'
      ? 'index.html'
      : normalizedPath.replace(/^\/+/, '');
  const requestedFile = path.resolve(distDir, safePath);

  if (!requestedFile.startsWith(distDir)) {
    return null;
  }

  if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
    return requestedFile;
  }

  return path.resolve(distDir, 'index.html');
}

const server = http.createServer((request, response) => {
  const filePath = resolveFile(request.url || '/');

  if (!filePath || !fs.existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  sendFile(filePath, response);
});

server.listen(port, host, () => {
  console.log(`Web listening on http://${host}:${port}`);
});
