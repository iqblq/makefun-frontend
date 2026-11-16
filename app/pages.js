// The four pages. Each one fetches what it needs (through the cached API
// layer), then replaces only #view's contents, so moving between pages never
// reloads the shell, the stylesheet or the scripts.

import { listCompetitions, getCompetition, getLeaderboard, getProfile } from './api.js';
import { esc, usd, whole, timeLeft, dateShort, pctMicro, bytes } from './format.js';
import { bountyCard, statBox, rewardsTable, statusChip, feeChip } from './components.js';

const boardState = { query: '', status: 'open', sort: 'pot', shown: 24 };
let boardCache = null;

export function setBoardQuery(q) {
  boardState.query = q;
  boardState.shown = 24;
}

function filteredBoard(items) {
  const q = boardState.query.trim().toLowerCase();
  let list = items.slice();
  if (boardState.status !== 'all') {
    list = list.filter((b) => b.status === boardState.status);
  }
  if (q) {
    list = list.filter((b) =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.slug || '').toLowerCase().includes(q) ||
      (b.category || '').toLowerCase().includes(q));
  }
  const pot = (b) => Number(b.potUsd ?? b.rewardAmount ?? 0);
  const due = (b) => new Date(b.deadline || 0).getTime();
  if (boardState.sort === 'pot') list.sort((a, b) => pot(b) - pot(a));
  else if (boardState.sort === 'deadline') list.sort((a, b) => due(a) - due(b));
  else if (boardState.sort === 'entries') list.sort((a, b) => (b.submissionCount || 0) - (a.submissionCount || 0));
  else if (boardState.sort === 'newest') list.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  return list;
}

function boardHTML(items) {
  const list = filteredBoard(items);
  const shown = list.slice(0, boardState.shown);
  const cards = shown.map(bountyCard).join('');
  const more = list.length > boardState.shown
    ? '<div class="center"><button class="btn" id="more">Show more (' + whole(list.length - boardState.shown) + ' left)</button></div>'
    : '';
  return '<h1>Live bounties</h1>' +
    '<p class="muted">Every bounty on make.fun, with its live pot, entry fee, time left and entries. ' +
    'Click a card for its page, rewards and leaderboard.</p>' +
    '<div class="toolbar">' +
    '<select id="f-status" aria-label="Status filter">' +
    '<option value="open"' + (boardState.status === 'open' ? ' selected' : '') + '>Open only</option>' +
    '<option value="all"' + (boardState.status === 'all' ? ' selected' : '') + '>All bounties</option>' +
    '<option value="resolved"' + (boardState.status === 'resolved' ? ' selected' : '') + '>Resolved</option>' +
    '</select>' +
    '<select id="f-sort" aria-label="Sort order">' +
    '<option value="pot"' + (boardState.sort === 'pot' ? ' selected' : '') + '>Biggest pot</option>' +
    '<option value="deadline"' + (boardState.sort === 'deadline' ? ' selected' : '') + '>Closing soonest</option>' +
    '<option value="entries"' + (boardState.sort === 'entries' ? ' selected' : '') + '>Most entries</option>' +
    '<option value="newest"' + (boardState.sort === 'newest' ? ' selected' : '') + '>Newest</option>' +
    '</select>' +
    '<span class="count">' + whole(list.length) + ' bounties · showing ' + whole(shown.length) + '</span>' +
    '</div>' +
    '<div class="grid">' + (cards || '<p class="muted">Nothing matches that search.</p>') + '</div>' + more;
}

export async function boardPage(view) {
  if (!boardCache) {
    const data = await listCompetitions(100);
    boardCache = data.items || [];
  }
  const draw = () => {
    view.innerHTML = boardHTML(boardCache);
    const status = view.querySelector('#f-status');
    const sort = view.querySelector('#f-sort');
    if (status) status.addEventListener('change', () => { boardState.status = status.value; boardState.shown = 24; draw(); });
    if (sort) sort.addEventListener('change', () => { boardState.sort = sort.value; boardState.shown = 24; draw(); });
    const more = view.querySelector('#more');
    if (more) more.addEventListener('click', () => { boardState.shown += 24; draw(); });
  };
  draw();
}

export async function bountyPage(view, slug) {
  const b = await getCompetition(slug);
  const pot = b.potUsd ?? b.rewardAmount;
  const subs = Array.isArray(b.submissions) ? b.submissions : [];
  const newest = subs.slice(0, 20);
  const subRows = newest.map((s) => '<tr><td><a href="#/u/' + esc(s.hunter) + '">' + esc(s.hunter) + '</a></td>' +
    '<td>' + esc(s.title || '—') + '</td><td>' + esc(s.status || '—') + '</td>' +
    '<td class="num">' + whole(s.score) + '</td></tr>').join('');
  const criteria = b.resolution && Array.isArray(b.resolution.criteria)
    ? '<ul>' + b.resolution.criteria.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '';
  view.innerHTML =
    '<p class="small"><a href="#/">← Board</a> · <a href="#/bounty/' + esc(b.slug) + '/leaderboard">Leaderboard →</a></p>' +
    '<h1>' + esc(b.title) + '</h1>' +
    '<div class="chips">' + statusChip(b.status) + feeChip(b.entryFeeUsd) +
    '<span class="chip">' + esc(b.category || 'Code') + '</span>' +
    '<span class="chip">' + esc(b.harnessKind || '') + '</span></div>' +
    '<p class="muted">' + esc(b.summary || '') + '</p>' +
    '<div class="statrow">' +
    statBox('Live pot', usd(pot), 'base ' + usd(b.rewardAmount)) +
    statBox('Entry fee', Number(b.entryFeeUsd) > 0 ? usd(b.entryFeeUsd) : 'Free', whole(b.entryFeePayers || 0) + ' paid') +
    statBox('Time left', b.deadline ? timeLeft(b.deadline) : '—', b.deadline ? dateShort(b.deadline) : '') +
    statBox('Entries', whole(b.submissionCount), 'sponsor ' + esc(b.sponsor && b.sponsor.name ? b.sponsor.name : '—')) +
    '</div>' +
    '<h2>Rewards</h2>' + rewardsTable(b.rewardsNow) +
    '<h2>About this bounty</h2><div class="desc">' + esc(b.description || '') + '</div>' +
    (criteria ? '<h2>How it is judged</h2>' + criteria : '') +
    '<h2>Latest entries (' + whole(subs.length) + ')</h2>' +
    (subRows
      ? '<table><thead><tr><th>Hunter</th><th>Entry</th><th>Status</th><th class="num">Score</th></tr></thead><tbody>' + subRows + '</tbody></table>'
      : '<p class="muted">No entries yet.</p>');
}

export async function leaderboardPage(view, slug) {
  const lb = await getLeaderboard(slug);
  const entries = Array.isArray(lb.entries) ? lb.entries : [];
  const comp = lb.competition || {};
  const phase = lb.phase || {};
  const rows = entries.slice(0, 50).map((e) => {
    const v = e.values || {};
    const cls = e.rank === 1 ? ' class="rank1"' : e.rank === 2 ? ' class="rank2"' : e.rank === 3 ? ' class="rank3"' : '';
    return '<tr><td' + cls + '>' + whole(e.rank) + '</td>' +
      '<td><a href="#/u/' + esc(e.handle) + '">' + esc(e.handle) + '</a></td>' +
      '<td>' + esc(e.title || '—') + '</td>' +
      '<td class="num">' + pctMicro(v.judge) + '</td>' +
      '<td class="num">' + pctMicro(v.judge_low) + ' – ' + pctMicro(v.judge_high) + '</td>' +
      '<td class="num">' + (v.valid === 1 ? '✓' : '✗') + '</td>' +
      '<td class="num">' + bytes(v.bytes) + '</td></tr>';
  }).join('');
  view.innerHTML =
    '<p class="small"><a href="#/">← Board</a> · <a href="#/bounty/' + esc(slug) + '">Bounty page →</a></p>' +
    '<h1>Leaderboard: ' + esc(comp.title || slug) + '</h1>' +
    '<p class="muted">Phase: ' + esc(phase.title || phase.key || '—') +
    (phase.ends_at ? ' · ends ' + dateShort(phase.ends_at) : '') +
    ' · ' + whole(entries.length) + ' ranked entries · win rate is the judge\'s, with its 90% interval.</p>' +
    (rows
      ? '<table><thead><tr><th>Rank</th><th>Hunter</th><th>Entry</th><th class="num">Win rate</th><th class="num">Interval</th><th class="num">Valid</th><th class="num">Size</th></tr></thead><tbody>' + rows + '</tbody></table>'
      : '<p class="muted">No ranked entries yet.</p>');
}

export async function profilePage(view, handle) {
  const p = await getProfile(handle);
  const rec = p.record || {};
  const sols = Array.isArray(p.solutions) ? p.solutions : [];
  const avatar = p.avatar && p.avatar.url ? p.avatar.url : p.image;
  const avatarImg = avatar
    ? '<img class="avatar big" crossorigin="anonymous" src="https://make.fun' + esc(avatar) + '" alt="">'
    : '';
  const solRows = sols.map((s) => {
    const c = s.competition || {};
    const score = s.score && s.score.display ? s.score.display : '—';
    return '<tr><td><a href="#/bounty/' + esc(c.slug) + '">' + esc(c.title || c.slug || '—') + '</a></td>' +
      '<td>' + esc(s.title || '—') + '</td>' +
      '<td class="num">' + (s.placement ? whole(s.placement) : '—') + '</td>' +
      '<td class="num">' + (s.prize_usd ? usd(s.prize_usd) : '—') + '</td>' +
      '<td class="num">' + esc(score) + '</td>' +
      '<td>' + dateShort(s.entered_at) + '</td></tr>';
  }).join('');
  view.innerHTML =
    '<div class="profile-head">' + avatarImg +
    '<div><h1>' + esc(p.display_name || p.handle) + '</h1>' +
    '<p class="muted">@' + esc(p.handle) +
    (p.github_login ? ' · <a href="https://github.com/' + esc(p.github_login) + '">GitHub</a>' : '') +
    (p.joined_at ? ' · joined ' + dateShort(p.joined_at) : '') + '</p>' +
    (p.bio ? '<p>' + esc(p.bio) + '</p>' : '') + '</div></div>' +
    '<div class="statrow">' +
    statBox('Entered', whole(rec.competitions_entered), 'bounties') +
    statBox('Placed', whole(rec.competitions_placed), 'top 20 finishes') +
    statBox('Won', whole(rec.competitions_won), 'first places') +
    statBox('Best place', rec.best_placement ? '#' + whole(rec.best_placement) : '—', 'ever') +
    statBox('Prize money', usd(rec.prize_usd), 'won so far') +
    '</div>' +
    '<h2>Entries (' + whole(sols.length) + ')</h2>' +
    (solRows
      ? '<table><thead><tr><th>Bounty</th><th>Entry</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Score</th><th>Entered</th></tr></thead><tbody>' + solRows + '</tbody></table>'
      : '<p class="muted">No entries yet.</p>');
}
