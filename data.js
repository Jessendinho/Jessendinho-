/* ---------- Data layer: demo data by default, live football-data.org when a key is saved ---------- */
const COMPS = [
  { id: 2021, code: 'PL', name: 'Premier League', area: 'England' },
  { id: 2014, code: 'PD', name: 'La Liga', area: 'Spain' },
  { id: 2002, code: 'BL1', name: 'Bundesliga', area: 'Germany' },
  { id: 2019, code: 'SA', name: 'Serie A', area: 'Italy' },
  { id: 2015, code: 'FL1', name: 'Ligue 1', area: 'France' },
  { id: 2001, code: 'CL', name: 'Champions League', area: 'Europe' },
];
const API = 'https://api.football-data.org/v4';
const getKey = () => { try { return localStorage.getItem('gl_key') || ''; } catch { return ''; } };
const setKey = (k) => { try { k ? localStorage.setItem('gl_key', k) : localStorage.removeItem('gl_key'); } catch {} };
const isDemo = () => !getKey();

const memo = new Map();
async function live(path, ttl) {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.t < ttl) return hit.d;
  let res;
  try { res = await fetch(API + path, { headers: { 'X-Auth-Token': getKey() } }); }
  catch { throw new Error('Could not reach football-data.org (network or browser CORS block).'); }
  if (!res.ok) {
    if (hit) return hit.d;
    throw new Error(res.status === 403 ? 'This competition is not included in the free plan.' :
      res.status === 429 ? 'Rate limit hit (10 requests/minute on the free plan). Wait a minute.' :
      res.status === 400 || res.status === 401 ? 'The API key was rejected. Check it in Settings.' : 'API error ' + res.status);
  }
  const d = await res.json();
  memo.set(path, { t: Date.now(), d });
  return d;
}
const normMatch = (m) => ({
  id: m.id, utcDate: m.utcDate, status: m.status, minute: m.minute ?? null,
  competition: { code: m.competition.code, name: m.competition.name, area: m.area?.name || m.competition.area?.name || '' },
  homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName || m.homeTeam.name, crest: m.homeTeam.crest },
  awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName || m.awayTeam.name, crest: m.awayTeam.crest },
  score: { fullTime: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null } },
});

/* ---- public API used by the pages ---- */
const Data = {
  async matches(date) {
    if (isDemo()) return demoMatches(date);
    const next = new Date(new Date(date + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
    return (await live(`/matches?dateFrom=${date}&dateTo=${next}`, 30000)).matches.map(normMatch);
  },
  async standings(code) {
    if (isDemo()) return demoStandings(code);
    const d = await live(`/competitions/${code}/standings`, 300000);
    const t = d.standings.find((s) => s.type === 'TOTAL') || d.standings[0];
    return (t?.table || []).map((r) => ({ ...r, team: { id: r.team.id, name: r.team.shortName || r.team.name, crest: r.team.crest } }));
  },
  async match(id) {
    if (isDemo()) { const m = demoMatch(id); if (!m) throw new Error('Match not found'); return m; }
    const g = await live(`/matches/${id}`, 20000);
    const side = (t) => (t === g.homeTeam.id ? 'home' : 'away');
    const lu = (t) => ({ formation: t.formation || null, starting: (t.lineup || []).map((p) => ({ name: p.name, number: p.shirtNumber })) });
    return { ...normMatch(g),
      events: [...(g.goals || []).map((x) => ({ minute: x.minute, type: 'GOAL', team: side(x.team?.id), player: x.scorer?.name || '' })),
        ...(g.bookings || []).map((x) => ({ minute: x.minute, type: x.card === 'RED' ? 'RED' : 'YELLOW', team: side(x.team?.id), player: x.player?.name || '' }))].sort((a, b) => a.minute - b.minute),
      lineups: { home: lu(g.homeTeam), away: lu(g.awayTeam) }, stats: null };
  },
};

/* ---- shared helpers ---- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LIVE = ['IN_PLAY', 'PAUSED', 'LIVE'];
function timeLabel(m) {
  if (m.status === 'FINISHED') return { t: 'FT', live: false };
  if (m.status === 'PAUSED') return { t: 'HT', live: true };
  if (LIVE.includes(m.status)) return { t: m.minute ? `${m.minute}'` : 'LIVE', live: true };
  if (m.status === 'POSTPONED') return { t: 'PPD', live: false };
  return { t: new Date(m.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), live: false };
}
const loadJ = (k, d) => { try { return JSON.parse(localStorage.getItem('gl_' + k)) ?? d; } catch { return d; } };
const saveJ = (k, v) => { try { localStorage.setItem('gl_' + k, JSON.stringify(v)); } catch {} };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* Settings dialog (API key) */
function initSettings() {
  const modal = $('#settings'); if (!modal) return;
  const refresh = () => { const b = $('#demoBanner'); if (b) b.hidden = !isDemo(); };
  $('#settingsBtn').onclick = () => { $('#keyInput').value = getKey(); modal.hidden = false; };
  $('#cancelKey').onclick = () => (modal.hidden = true);
  $('#saveKey').onclick = () => { setKey($('#keyInput').value.trim()); modal.hidden = true; location.reload(); };
  refresh();
}
