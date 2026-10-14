(() => {
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let all = [], ready = false;

  const recent = () => loadJ('recent', []);
  const addRecent = (t) => { t = t.trim(); if (t.length > 1) saveJ('recent', [t, ...recent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6)); };
  const mark = (text, words) => {
    let o = esc(text);
    words.forEach((w) => { if (w) o = o.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return o;
  };
  const dayLabel = (iso) => {
    const d = new Date(iso), t = new Date();
    const diff = Math.round((new Date(isoLocal(d)) - new Date(isoLocal(t))) / 86400000);
    return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
  };

  async function loadAll() {
    // One API call covers 10 days (3 days back, 6 ahead). Cached for 5 minutes to protect the rate limit.
    const key = 'gl_searchcache_' + (isDemo() ? 'demo' : 'live') + '_' + isoLocal(new Date());
    try { const c = JSON.parse(sessionStorage.getItem(key)); if (c && Date.now() - c.t < 300000) return c.d; } catch {}
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
    let list;
    if (isDemo()) { list = []; for (let i = -3; i <= 6; i++) list.push(...(await Data.matches(day(i)))); }
    else {
      let res;
      try { res = await fetch(`${API}/matches?dateFrom=${day(-3)}&dateTo=${day(7)}`, { headers: { 'X-Auth-Token': getKey() } }); }
      catch { throw new Error('Could not reach football-data.org (network or browser CORS block).'); }
      if (!res.ok) throw new Error(res.status === 429 ? 'Rate limit hit (10 requests/minute). Wait a minute.' : res.status === 400 || res.status === 403 ? 'The API key was rejected or the date range is not allowed on your plan.' : 'API error ' + res.status);
      list = (await res.json()).matches.map(normMatch);
    }
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: list })); } catch {}
    return list;
  }

  function row(m, words) {
    const { t, live } = timeLabel(m);
    const hs = m.score.fullTime.home, as = m.score.fullTime.away, has = hs !== null && as !== null;
    return `<a class="match ns" href="watch.html?id=${m.id}">
      <div class="time ${live ? 'live' : ''}">${esc(t)}</div>
      <div class="teams">
        <div class="t"><img class="crest" src="${esc(m.homeTeam.crest)}" alt=""><span>${mark(m.homeTeam.name, words)}</span></div>
        <div class="t"><img class="crest" src="${esc(m.awayTeam.crest)}" alt=""><span>${mark(m.awayTeam.name, words)}</span></div>
      </div>
      <div class="score ${live ? 'live' : ''}">${has ? `<div>${hs}</div><div>${as}</div>` : ''}</div>
    </a>`;
  }

  function render() {
    const raw = $('#q').value.trim(), words = norm(raw).split(/\s+/).filter(Boolean);
    $('#clear').style.display = raw ? 'block' : 'none';
    const rec = recent();
    $('#recent').innerHTML = !raw && rec.length ? `<div class="h4">Recent <button id="clearRecent">Clear</button></div><div class="pad">${rec.map((t) => `<button class="chip" data-term="${esc(t)}">🕘 ${esc(t)}</button>`).join('')}</div>` : '';
    if (!ready) return;

    if (!words.length) {
      // nothing typed: suggest leagues and teams, show live games first
      const teams = new Map(); all.forEach((m) => { teams.set(m.homeTeam.id, m.homeTeam.name); teams.set(m.awayTeam.id, m.awayTeam.name); });
      const comps = [...new Set(all.map((m) => m.competition.name))];
      $('#hint').textContent = 'Try a team or league';
      $('#teams').innerHTML = [...comps.slice(0, 6), ...[...teams.values()].slice(0, 10)].map((n) => `<button class="chip" data-term="${esc(n)}">${esc(n)}</button>`).join('');
      const liveNow = all.filter((m) => LIVE.includes(m.status));
      $('#results').innerHTML = liveNow.length ? `<div class="h4">Live now</div><section class="group">${liveNow.map((m) => row(m, [])).join('')}</section>` : '';
      return;
    }

    const hit = all.filter((m) => {
      const hay = norm([m.homeTeam.name, m.awayTeam.name, m.competition.name, m.competition.area].join(' '));
      return words.every((w) => hay.includes(w));
    }).sort((a, b) => a.utcDate.localeCompare(b.utcDate));

    // team suggestions
    const tm = new Map(); all.forEach((m) => [m.homeTeam, m.awayTeam].forEach((t) => { if (words.every((w) => norm(t.name).includes(w))) tm.set(t.id, t.name); }));
    $('#teams').innerHTML = [...tm.values()].slice(0, 6).map((n) => `<button class="chip" data-term="${esc(n)}">⚽ ${esc(n)}</button>`).join('');
    $('#hint').textContent = `${hit.length} match${hit.length === 1 ? '' : 'es'} found for “${raw}” (last 3 days to next 6 days)`;

    if (!hit.length) { $('#results').innerHTML = `<div class="empty">No matches found.<br>Try a team name like “Arsenal” or a league like “Premier League”.</div>`; return; }
    const groups = new Map();
    hit.forEach((m) => { const k = dayLabel(m.utcDate); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
    $('#results').innerHTML = [...groups].map(([k, l]) => `<div class="h4">${esc(k)}</div><section class="group">${l.map((m) => row(m, words)).join('')}</section>`).join('');
    try { history.replaceState(null, '', '?q=' + encodeURIComponent(raw)); } catch {}
  }

  $('#q').addEventListener('input', render);
  $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { addRecent(e.target.value); e.target.blur(); } });
  $('#clear').onclick = () => { $('#q').value = ''; try { history.replaceState(null, '', location.pathname); } catch {} $('#q').focus(); render(); };
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-term]'); if (c && c.tagName === 'BUTTON') { $('#q').value = c.dataset.term; addRecent(c.dataset.term); return render(); }
    if (e.target.id === 'clearRecent') { saveJ('recent', []); return render(); }
    if (e.target.closest('a.match')) addRecent($('#q').value);
  });

  initSettings();
  $('#q').value = new URLSearchParams(location.search).get('q') || '';
  $('#hint').textContent = 'Loading matches…';
  loadAll().then((l) => { all = l; ready = true; render(); })
    .catch((e) => { $('#hint').innerHTML = ''; $('#results').innerHTML = `<div class="empty">Could not load matches.<br><small>${esc(e.message)}</small></div>`; });
})();
