const http = require('http');
const https = require('https');
const url = require('url');

// Hugo's API Key (secure on server)
const API_KEY = 'dd34dfd25dc34b06a0e6b3b6ca39a9cd';
const API_HOST = 'api-football-v1.p.rapidapi.com';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Create server
const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // Logging
  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // Health check endpoint
  if (pathname === '/health') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // API proxy endpoint
  if (pathname === '/api/check') {
    // Check if API is working
    const options = {
      hostname: API_HOST,
      port: 443,
      path: '/v3/leagues?id=1',
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
        'User-Agent': 'WorldCup2026App'
      }
    };

    https.request(options, (apiRes) => {
      let data = '';

      apiRes.on('data', (chunk) => {
        data += chunk;
      });

      apiRes.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.writeHead(200, corsHeaders);
          res.end(JSON.stringify({ 
            status: 'online', 
            api_response: jsonData,
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          res.writeHead(200, corsHeaders);
          res.end(JSON.stringify({ 
            status: 'online',
            message: 'API is responding',
            timestamp: new Date().toISOString()
          }));
        }
      });
    }).on('error', (error) => {
      console.error('API Error:', error.message);
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ 
        status: 'offline',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    });

    return;
  }

  // Generic proxy for any API endpoint
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.replace('/api', '');
    
    const options = {
      hostname: API_HOST,
      port: 443,
      path: `/v3${apiPath}${Object.keys(query).length > 0 ? '?' + Object.keys(query).map(k => `${k}=${query[k]}`).join('&') : ''}`,
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
        'User-Agent': 'WorldCup2026App'
      }
    };

    console.log(`Proxying to: ${options.path}`);

    https.request(options, (apiRes) => {
      let data = '';

      apiRes.on('data', (chunk) => {
        data += chunk;
      });

      apiRes.on('end', () => {
        res.writeHead(200, corsHeaders);
        res.end(data);
      });
    }).on('error', (error) => {
      console.error('Proxy Error:', error.message);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ 
        error: 'Proxy error',
        message: error.message 
      }));
    });

    return;
  }

  // 404
  res.writeHead(404, corsHeaders);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 World Cup 2026 API Proxy running on port ${PORT}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
});