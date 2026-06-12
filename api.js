const http = require('http');
const https = require('https');
const url = require('url');

// Hugo's API-Sports key (direct api-sports.io key, NOT a RapidAPI key)
const API_KEY = 'dd34dfd25dc34b06a0e6b3b6ca39a9cd';

// CORRECT host + header for a direct API-Sports account:
//   host:   v3.football.api-sports.io
//   header: x-apisports-key: <KEY>
const API_HOST = 'v3.football.api-sports.io';

// World Cup in API-Sports: league id 1, season 2026
const WORLDCUP_LEAGUE = 1;
const WORLDCUP_SEASON = 2026;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Helper: call API-Sports and return parsed JSON
function callApiSports(apiPath, callback) {
  const options = {
    hostname: API_HOST,
    port: 443,
    path: apiPath,
    method: 'GET',
    headers: {
      'x-apisports-key': API_KEY,
      'Accept': 'application/json'
    }
  };

  https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => { data += chunk; });
    apiRes.on('end', () => {
      try {
        callback(null, JSON.parse(data));
      } catch (e) {
        callback(new Error('Invalid JSON from API'), null);
      }
    });
  }).on('error', (error) => {
    callback(error, null);
  }).end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // Health check - uses API-Sports /status (returns account info if key is valid)
  if (pathname === '/api/check' || pathname === '/health') {
    callApiSports('/status', (err, json) => {
      if (err) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ status: 'offline', error: err.message }));
        return;
      }
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({
        status: 'online',
        account: json.response || null,
        errors: json.errors || null,
        timestamp: new Date().toISOString()
      }));
    });
    return;
  }

  // Fetch World Cup fixtures (all matches with scores/status)
  if (pathname === '/api/fixtures') {
    const apiPath = `/fixtures?league=${WORLDCUP_LEAGUE}&season=${WORLDCUP_SEASON}`;
    callApiSports(apiPath, (err, json) => {
      if (err) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ status: 'error', error: err.message, matches: [] }));
        return;
      }

      const matches = (json.response || []).map(item => ({
        fixtureId: item.fixture.id,
        date: item.fixture.date,
        status: item.fixture.status.short,
        home: item.teams.home.name,
        away: item.teams.away.name,
        homeGoals: item.goals.home,
        awayGoals: item.goals.away
      }));

      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({
        status: 'ok',
        count: matches.length,
        errors: json.errors || null,
        matches: matches,
        timestamp: new Date().toISOString()
      }));
    });
    return;
  }

  // Generic passthrough for any other API-Sports endpoint
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.replace('/api', '') + (parsedUrl.search || '');
    callApiSports(apiPath, (err, json) => {
      if (err) {
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify(json));
    });
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`World Cup 2026 API proxy running on port ${PORT}`);
});

module.exports = server;
