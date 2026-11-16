// Talks to make.fun's public API only, with GET. No sign-in, nothing written.
// One in-memory cache entry per URL, revalidated with the API's ETags: the
// API binds an ETag to the minute, so a revalidation inside the same minute
// answers 304 and costs no fresh body. A stale entry (older than a minute)
// is refetched. The board list call already returns full bounty objects
// (pot, fee, deadline, entries), so the board costs exactly one request.

export const API = 'https://make.fun/api';

const cache = new Map();
const TTL_MS = 60_000;

let requests = 0;
let cacheHits = 0;

export function apiStats() {
  return { requests, cacheHits };
}

async function getJSON(path) {
  const url = API + path;
  const now = Date.now();
  const held = cache.get(url);
  if (held && now - held.at < TTL_MS) {
    cacheHits += 1;
    return held.body;
  }
  requests += 1;
  const headers = { accept: 'application/json' };
  if (held && held.etag) headers['if-none-match'] = held.etag;
  const res = await fetch(url, { headers });
  if (res.status === 304 && held) {
    cacheHits += 1;
    held.at = now;
    return held.body;
  }
  if (!res.ok) {
    const err = new Error('make.fun answered ' + res.status + ' for ' + path);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  cache.set(url, { body, etag: res.headers.get('etag'), at: now });
  return body;
}

export function listCompetitions(limit = 100) {
  return getJSON('/competitions?limit=' + limit);
}

export function getCompetition(slug) {
  return getJSON('/competitions/' + encodeURIComponent(slug));
}

export function getLeaderboard(slug) {
  return getJSON('/competitions/' + encodeURIComponent(slug) + '/leaderboard');
}

export function getProfile(handle) {
  return getJSON('/profiles/' + encodeURIComponent(handle));
}
