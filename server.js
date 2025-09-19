// Create this as server.js in your project root
const http = require('http');
const httpProxy = require('http-proxy-middleware');
const { spawn } = require('child_process');

console.log('Starting n8n proxy server...');

let n8nReady = false;
let n8nProcess;

// Start n8n process first
console.log('Starting n8n process...');
n8nProcess = spawn('npx', ['n8n', 'start'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    N8N_PORT: '3000',
    N8N_HOST: '127.0.0.1'
  }
});

// Monitor n8n output to know when it's ready
n8nProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('[n8n]', output);
  if (output.includes('Editor is now accessible') || output.includes('n8n ready')) {
    n8nReady = true;
    console.log('✅ n8n is ready!');
  }
});

n8nProcess.stderr.on('data', (data) => {
  console.error('[n8n error]', data.toString());
});

// Create proxy server
const server = http.createServer((req, res) => {
  if (!n8nReady) {
    // n8n not ready yet, return simple OK for health checks
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Starting...');
    return;
  }

  // Proxy to n8n
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Service temporarily unavailable');
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Start server on Scalingo's assigned port
const port = process.env.PORT || 5000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Proxy server listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  if (n8nProcess) {
    n8nProcess.kill('SIGTERM');
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

n8nProcess.on('exit', (code) => {
  console.log(`n8n process exited with code ${code}`);
  if (code !== 0) {
    process.exit(code);
  }
});