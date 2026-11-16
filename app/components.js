// Shared pieces the pages assemble: a bounty card, a status chip, a stat
// box and the rewards table. Every value that came from the API is escaped
// here, so the pages never inject raw text.

import { esc, usd, usdShort, whole, timeLeft, dateShort } from './format.js';

export function statusChip(status) {
  if (status === 'open') return '<span class="chip open">open</span>';
  if (status === 'resolved') return '<span class="chip closed">resolved</span>';
  return '<span class="chip">' + esc(status || '—') + '</span>';
}

export function feeChip(feeUsd) {
  const fee = Number(feeUsd);
  if (!Number.isFinite(fee) || fee <= 0) return '<span class="chip">free entry</span>';
  return '<span class="chip fee">fee ' + usd(fee) + '</span>';
}

export function bountyCard(b) {
  const pot = b.potUsd ?? b.rewardAmount;
  const left = b.deadline ? timeLeft(b.deadline) : '—';
  const when = b.deadline ? dateShort(b.deadline) : '—';
  return '<article class="card">' +
    '<h3><a href="#/bounty/' + esc(b.slug) + '">' + esc(b.title) + '</a></h3>' +
    '<div class="chips">' + statusChip(b.status) + feeChip(b.entryFeeUsd) +
    '<span class="chip">' + esc(b.category || 'Code') + '</span></div>' +
    '<div class="pot">' + usdShort(pot) + ' <small>live pot</small></div>' +
    '<div class="stats">' +
    '<span><b>' + esc(left) + '</b> · ' + esc(when) + '</span>' +
    '<span><b>' + whole(b.submissionCount) + '</b> entries</span>' +
    '<span>by ' + esc(b.sponsor && b.sponsor.name ? b.sponsor.name : '—') + '</span>' +
    '</div></article>';
}

export function statBox(label, value, sub) {
  return '<div class="statbox"><div class="label">' + esc(label) + '</div>' +
    '<div class="value">' + esc(value) + '</div>' +
    (sub ? '<div class="small muted">' + esc(sub) + '</div>' : '') + '</div>';
}

export function rewardsTable(rewardsNow) {
  if (!Array.isArray(rewardsNow) || rewardsNow.length === 0) {
    return '<p class="muted">No rewards table published for this bounty yet.</p>';
  }
  const rows = rewardsNow.map((r) => {
    const place = Number(r.place);
    const cls = place === 1 ? ' class="rank1"' : place === 2 ? ' class="rank2"' : place === 3 ? ' class="rank3"' : '';
    return '<tr><td' + cls + '>' + (place === 1 ? '🥇 ' : place === 2 ? '🥈 ' : place === 3 ? '🥉 ' : '') + whole(place) + '</td>' +
      '<td class="num">' + usd(r.baseUsd) + '</td>' +
      '<td class="num">' + usd(r.feeShareUsd) + '</td>' +
      '<td class="num"><b>' + usd(r.amountUsd) + '</b></td></tr>';
  }).join('');
  return '<table><thead><tr><th>Place</th><th class="num">Base</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';
}
