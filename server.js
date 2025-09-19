// Create this as server.js in your project root
const http = require('http');
const { spawn } = require('child_process');

console.log('Starting health check server...');

// Create a simple HTTP server that responds immediately
const server = http.createServer((req, res) => {
  // Health check endpoint - always return 200
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

// Start server on PORT (Scalingo will set this to 5000)
const port = process.env.PORT || 5000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Health server listening on port ${port}`);
  
  // Now start n8n in the background
  const n8nProcess = spawn('npx', ['n8n', 'start'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      N8N_PORT: '3000', // n8n runs on different port
      N8N_HOST: '127.0.0.1' // Only accessible internally
    }
  });

  n8nProcess.on('error', (err) => {
    console.error('Failed to start n8n:', err);
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});