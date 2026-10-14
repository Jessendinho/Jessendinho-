(() => {
  const view = $('#view');
  const state = { tab: 'matches', date: isoLocal(new Date()), table: 'PL', favs: loadJ('favs', {}), alerts: loadJ('alerts', false), last: {} };

  function matchRow(m) {
    const { t, live } = timeLabel(m);
    const hs = m.score.fullTime.home, as = m.score.fullTime.away, has = hs !== null && as !== null;
    const fav = state.favs[m.homeTeam.id] || state.favs[m.awayTeam.id];
    return `<a class="match" href="watch.html?id=${m.id}">
      <div class="time ${live ? 'live' : ''}">${esc(t)}</div>
      <div class="teams">
        <div class="t"><img class="crest" src="${esc(m.homeTeam.crest)}" alt=""><span>${esc(m.homeTeam.name)}</span></div>
        <div class="t"><img class="crest" src="${esc(m.awayTeam.crest)}" alt=""><span>${esc(m.awayTeam.name)}</span></div>
      </div>
      <div class="score ${live ? 'live' : ''}">${has ? `<div>${hs}</div><div>${as}</div>` : ''}</div>
      <button class="star ${fav ? 'on' : ''}" data-home="${m.homeTeam.id}" data-away="${m.awayTeam.id}" data-hn="${esc(m.homeTeam.name)}" data-an="${esc(m.awayTeam.name)}" aria-label="Favorite">${fav ? '★' : '☆'}</button>
    </a>`;
  }
  function list(matches) {
    if (!matches.length) return `<div class="empty">No matches for this day.</div>`;
    const g = new Map();
    matches.forEach((m) => { const k = m.competition.code || m.competition.name; if (!g.has(k)) g.set(k, { c: m.competition, l: [] }); g.get(k).l.push(m); });
    return [...g.values()].map((x) => `<section class="group"><h3>${esc(x.c.area)} · <em>${esc(x.c.name)}</em></h3>${x.l.map(matchRow).join('')}</section>`).join('');
  }
  function dateStrip() {
    let h = '';
    for (let i = -3; i <= 3; i++) {
      const d = new Date(); d.setDate(d.getDate() + i); const iso = isoLocal(d);
      h += `<button class="date ${iso === state.date ? 'active' : ''}" data-date="${iso}"><small>${i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })}</small><b>${d.getDate()}</b></button>`;
    }
    return `<div class="dates">${h}</div>`;
  }
  const fail = (e) => `<div class="empty">Could not load data.<br><small>${esc(e.message)}</small></div>`;
  const centerDate = () => view.querySelector('.dates .active')?.scrollIntoView({ inline: 'center', block: 'nearest' });

  async function renderMatches() {
    view.innerHTML = dateStrip() + `<div class="empty">Loading…</div>`; centerDate();
    try { view.innerHTML = dateStrip() + list(await Data.matches(state.date)); centerDate(); }
    catch (e) { view.innerHTML = dateStrip() + fail(e); centerDate(); }
  }
  async function renderTables() {
    const chips = COMPS.map((c) => `<button class="chip ${c.code === state.table ? 'active' : ''}" data-code="${c.code}">${esc(c.name)}</button>`).join('');
    view.innerHTML = `<div class="chips">${chips}</div><div class="empty">Loading…</div>`;
    try {
      const t = await Data.standings(state.table);
      const rows = t.map((r) => `<tr class="${r.position <= 4 ? 'top4' : ''}"><td class="pos">${r.position}</td>
        <td class="team"><img class="crest" src="${esc(r.team.crest)}" alt=""><span>${esc(r.team.name)}</span></td>
        <td>${r.playedGames}</td><td>${r.won}</td><td>${r.draw}</td><td>${r.lost}</td><td>${r.goalDifference > 0 ? '+' : ''}${r.goalDifference}</td><td class="pts">${r.points}</td></tr>`).join('');
      view.innerHTML = `<div class="chips">${chips}</div><table class="tbl"><thead><tr><th></th><th style="text-align:left">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>`;
    } catch (e) { view.innerHTML = `<div class="chips">${chips}</div>${fail(e)}`; }
  }
  async function renderFavs() {
    const ids = Object.keys(state.favs);
    if (!ids.length) { view.innerHTML = `<div class="empty">Tap ☆ next to a match to follow its teams.<br>You'll see their games here and get goal alerts.</div>`; return; }
    view.innerHTML = dateStrip() + `<div class="empty">Loading…</div>`; centerDate();
    try {
      const mine = (await Data.matches(state.date)).filter((m) => state.favs[m.homeTeam.id] || state.favs[m.awayTeam.id]);
      const chips = ids.map((id) => `<button class="chip" data-unfollow="${id}">★ ${esc(state.favs[id])}</button>`).join('');
      view.innerHTML = `<div class="chips">${chips}</div>` + dateStrip() + (mine.length ? list(mine) : `<div class="empty">None of your teams play on this day.</div>`); centerDate();
    } catch (e) { view.innerHTML = fail(e); }
  }
  const render = () => (state.tab === 'matches' ? renderMatches() : state.tab === 'tables' ? renderTables() : renderFavs());

  /* goal alerts */
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 5000); }
  function notify(msg) { toast(msg); if ('Notification' in window && Notification.permission === 'granted') new Notification('GoalLine', { body: msg }); }
  async function pollGoals() {
    if (!state.alerts || !Object.keys(state.favs).length) return;
    try {
      for (const m of await Data.matches(isoLocal(new Date()))) {
        if (!(state.favs[m.homeTeam.id] || state.favs[m.awayTeam.id])) continue;
        const h = m.score.fullTime.home, a = m.score.fullTime.away; if (h === null || a === null) continue;
        const now = `${h}-${a}`, prev = state.last[m.id];
        if (prev && prev !== now) notify(`GOAL! ${m.homeTeam.name} ${h} - ${a} ${m.awayTeam.name}`);
        state.last[m.id] = now;
      }
    } catch {}
  }
  const bell = () => $('#notifBtn').classList.toggle('on', state.alerts);
  $('#notifBtn').onclick = async () => {
    if (!state.alerts) { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); state.alerts = true; toast('Goal alerts on for your favorite teams'); pollGoals(); }
    else { state.alerts = false; toast('Goal alerts off'); }
    saveJ('alerts', state.alerts); bell();
  };

  document.addEventListener('click', (e) => {
    const star = e.target.closest('.star');
    if (star) {
      e.preventDefault(); e.stopPropagation();
      const pairs = [[star.dataset.home, star.dataset.hn], [star.dataset.away, star.dataset.an]];
      const following = pairs.some(([id]) => state.favs[id]);
      pairs.forEach(([id, n]) => (following ? delete state.favs[id] : (state.favs[id] = n)));
      saveJ('favs', state.favs); return render();
    }
    const tab = e.target.closest('.tabs button');
    if (tab) { state.tab = tab.dataset.tab; document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === tab)); return render(); }
    const d = e.target.closest('[data-date]'); if (d) { state.date = d.dataset.date; return render(); }
    const c = e.target.closest('[data-code]'); if (c) { state.table = c.dataset.code; return renderTables(); }
    const u = e.target.closest('[data-unfollow]'); if (u) { delete state.favs[u.dataset.unfollow]; saveJ('favs', state.favs); return renderFavs(); }
  });

  setInterval(() => { pollGoals(); if (!document.hidden && state.tab !== 'tables' && $('#settings').hidden) render(); }, 30000);
  initSettings(); bell(); render(); pollGoals();
})();
