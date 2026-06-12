const https = require('https');
const url = require('url');

const API_KEY = '4c34fc6ca90b3bdd81d843f465bd6492';

// Two possible providers - we test both to find which one the key belongs to
const PROVIDERS = {
  apisports: {
    host: 'v3.football.api-sports.io',
    header: 'x-apisports-key'
  },
  rapidapi: {
    host: 'api-football-v1.p.rapidapi.com',
    header: 'x-rapidapi-key',
    extraHeader: { 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
  }
};

const WORLDCUP_LEAGUE = 1;
const WORLDCUP_SEASON = 2026;

function call(provider, apiPath, callback) {
  const p = PROVIDERS[provider];
  const headers = { 'Accept': 'application/json' };
  headers[p.header] = API_KEY;
  if (p.extraHeader) Object.assign(headers, p.extraHeader);

  // RapidAPI prefixes paths with /v3
  const fullPath = (provider === 'rapidapi' ? '/v3' : '') + apiPath;

  const options = { hostname: p.host, port: 443, path: fullPath, method: 'GET', headers };

  https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => { data += chunk; });
    apiRes.on('end', () => {
      try { callback(null, JSON.parse(data)); }
      catch (e) { callback(new Error('Invalid JSON'), null); }
    });
  }).on('error', (error) => { callback(error, null); }).end();
}

function hasError(json) {
  if (!json) return true;
  if (Array.isArray(json.errors)) return json.errors.length > 0;
  if (json.errors && typeof json.errors === 'object') return Object.keys(json.errors).length > 0;
  return false;
}

// Detect which provider the key works with, then run the callback with that provider
function detectProvider(callback) {
  call('apisports', '/status', (err, json) => {
    if (!err && !hasError(json) && json.response) {
      callback('apisports');
    } else {
      call('rapidapi', '/status', (err2, json2) => {
        if (!err2 && !hasError(json2) && json2.response) {
          callback('rapidapi');
        } else {
          callback(null);
        }
      });
    }
  });
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Diagnostic: tells you which provider your key belongs to
  if (pathname === '/api/check' || pathname === '/health' || pathname === '/') {
    call('apisports', '/status', (e1, j1) => {
      const apisportsOk = !e1 && !hasError(j1) && !!(j1 && j1.response);
      call('rapidapi', '/status', (e2, j2) => {
        const rapidapiOk = !e2 && !hasError(j2) && !!(j2 && j2.response);
        let working = apisportsOk ? 'apisports' : (rapidapiOk ? 'rapidapi' : 'none');
        res.statusCode = 200;
        res.end(JSON.stringify({
          working_provider: working,
          apisports_ok: apisportsOk,
          rapidapi_ok: rapidapiOk,
          apisports_response: apisportsOk ? j1.response : (j1 ? j1.errors : null),
          rapidapi_response: rapidapiOk ? j2.response : (j2 ? j2.errors : null),
          timestamp: new Date().toISOString()
        }));
      });
    });
    return;
  }

  // Fixtures - auto-detects the right provider first
  if (pathname === '/api/fixtures') {
    detectProvider((provider) => {
      if (!provider) {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'error', error: 'No working provider for this key', matches: [] }));
        return;
      }
      const apiPath = `/fixtures?league=${WORLDCUP_LEAGUE}&season=${WORLDCUP_SEASON}`;
      call(provider, apiPath, (err, json) => {
        if (err) {
          res.statusCode = 200;
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
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'ok',
          provider: provider,
          count: matches.length,
          errors: json.errors || null,
          matches: matches,
          timestamp: new Date().toISOString()
        }));
      });
    });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
};
