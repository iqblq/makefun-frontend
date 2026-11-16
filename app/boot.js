// Entry module: reads the hash, picks a page, and swaps it into #view.
// The shell (header, search box, footer) is never rebuilt. While a page is
// loading or rendering, window.__shotReady stays false; the screenshot
// script waits for it to turn true before it shoots.
//
// The pages module loads lazily, on the first route, so the first load is
// only this file plus the stylesheet: the pages, the API layer and the
// formatters arrive after, and the dossier counts them as loaded later.

import { apiStats } from './api.js';

let pagesPromise = null;
function loadPages() {
  if (!pagesPromise) pagesPromise = import('./pages.js');
  return pagesPromise;
}

const view = document.getElementById('view');
const net = document.getElementById('net');
const footStats = document.getElementById('foot-stats');
const search = document.getElementById('q');

function showStats() {
  const s = apiStats();
  net.textContent = s.requests + ' req · ' + s.cacheHits + ' cached';
  footStats.textContent = s.requests + ' API requests this visit, ' + s.cacheHits + ' served from cache.';
}

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'board' };
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
    return { page: 'leaderboard', slug: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === 'bounty' && parts[1]) {
    return { page: 'bounty', slug: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === 'u' && parts[1]) {
    return { page: 'profile', handle: decodeURIComponent(parts[1]) };
  }
  return { page: 'board' };
}

const titles = {
  board: 'make.fun board',
  bounty: (slug) => 'Bounty: ' + slug + ' · make.fun board',
  leaderboard: (slug) => 'Leaderboard: ' + slug + ' · make.fun board',
  profile: (handle) => '@' + handle + ' · make.fun board',
};

async function route() {
  const r = parseHash();
  document.title = r.page === 'bounty' ? titles.bounty(r.slug)
    : r.page === 'leaderboard' ? titles.leaderboard(r.slug)
    : r.page === 'profile' ? titles.profile(r.handle)
    : titles.board;
  window.__shotReady = false;
  view.innerHTML = '<p class="loading">Loading live data from make.fun…</p>';
  try {
    const pages = await loadPages();
    if (r.page === 'bounty') await pages.bountyPage(view, r.slug);
    else if (r.page === 'leaderboard') await pages.leaderboardPage(view, r.slug);
    else if (r.page === 'profile') await pages.profilePage(view, r.handle);
    else await pages.boardPage(view);
  } catch (err) {
    view.innerHTML = '<div class="error"><b>Could not load this page.</b><br>' +
      'make.fun\'s API did not answer. ' +
      (err && err.message ? err.message : '') +
      ' <a href="#/">Back to the board</a>.</div>';
  }
  showStats();
  window.__shotReady = true;
  window.scrollTo(0, 0);
}

let searchTimer = null;
search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const pages = await loadPages();
    pages.setBoardQuery(search.value);
    if (parseHash().page !== 'board') {
      location.hash = '#/';
    } else {
      route();
    }
  }, 200);
});

window.addEventListener('hashchange', route);
route();
