(() => {
  const view = $('#view');
  const id = Number(new URLSearchParams(location.search).get('id'));
  const icon = { GOAL: '⚽', YELLOW: '🟨', RED: '🟥' };
  const bar = (label, a, b, pct) => {
    const total = pct ? 100 : (a + b) || 1;
    return `<div class="stat"><div class="lbl"><span>${a}${pct ? '%' : ''}</span><span>${label}</span><span>${b}${pct ? '%' : ''}</span></div><div class="bar"><i style="width:${(a / total) * 100}%"></i></div></div>`;
  };
  function draw(m) {
    const { t, live } = timeLabel(m);
    const hs = m.score.fullTime.home, as = m.score.fullTime.away, has = hs !== null && as !== null;
    document.title = `${m.homeTeam.name} v ${m.awayTeam.name} · GoalLine`;
    const ev = (m.events || []).map((e) => {
      const txt = `${icon[e.type] || ''} ${esc(e.player)}`;
      return `<div class="ev"><div class="h">${e.team === 'home' ? txt : ''}</div><div class="m">${e.minute}'</div><div>${e.team === 'away' ? txt : ''}</div></div>`;
    }).join('');
    let stats = '';
    if (m.stats) stats = `<div class="sec"><h4>Stats</h4>${bar('Possession', m.stats.possession[0], 100 - m.stats.possession[0], true)}${bar('Shots', ...m.stats.shots)}${bar('Corners', ...m.stats.corners)}${bar('Fouls', ...m.stats.fouls)}</div>`;
    let lu = '';
    const L = m.lineups;
    if (L && (L.home.starting.length || L.away.starting.length)) {
      const col = (x) => x.starting.map((p) => `<div><b>${esc(p.number ?? '')}</b>${esc(p.name)}</div>`).join('');
      lu = `<div class="sec"><h4>Lineups</h4><div class="lu"><section>${col(L.home)}</section><section>${col(L.away)}</section></div></div>`;
    }
    view.innerHTML = `<div class="mh">
      <div class="comp">${esc(m.competition.name)}</div>
      <div class="row">
        <div class="side"><img src="${esc(m.homeTeam.crest)}" alt="">${esc(m.homeTeam.name)}</div>
        <div class="big">${has ? `${hs} - ${as}` : esc(t)}</div>
        <div class="side"><img src="${esc(m.awayTeam.crest)}" alt="">${esc(m.awayTeam.name)}</div>
      </div>
      <div class="st ${live ? 'live' : ''}">${has ? esc(t) : new Date(m.utcDate).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</div>
    </div>
    ${ev ? `<div class="sec"><h4>Events</h4>${ev}</div>` : ''}${stats}${lu}
    ${!ev && !stats && !lu ? `<div class="empty">Match details will appear once the game starts.</div>` : ''}
    <div class="refresh">${m.status === 'FINISHED' ? 'Full time' : 'Updates automatically every 20 seconds'}</div>`;
  }
  let timer;
  async function load() {
    try {
      const m = await Data.match(id); draw(m);
      clearTimeout(timer); if (m.status !== 'FINISHED') timer = setTimeout(load, 20000);
    } catch (e) {
      view.innerHTML = `<div class="empty">Could not load this match.<br><small>${esc(e.message)}</small><br><br><a class="btn" href="index.html">Back to matches</a></div>`;
    }
  }
  initSettings();
  if (!id) view.innerHTML = `<div class="empty">No match selected.<br><br><a class="btn" href="index.html">Back to matches</a></div>`; else load();
})();
