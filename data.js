/* ---------- Data layer: now using YOUR worker (API-SPORTS) ---------- */
const COMPS = [
  { id: 39, code: 'PL', name: 'Premier League', area: 'England' },
  { id: 140, code: 'PD', name: 'La Liga', area: 'Spain' },
  { id: 78, code: 'BL1', name: 'Bundesliga', area: 'Germany' },
  { id: 135, code: 'SA', name: 'Serie A', area: 'Italy' },
  { id: 61, code: 'FL1', name: 'Ligue 1', area: 'France' },
  { id: 2, code: 'CL', name: 'Champions League', area: 'Europe' },
];

// YOUR WORKER - it already has your secret key!
const API = 'https://old-poetry-cb6d.jessegitonga04.workers.dev/v3';
const getKey = () => { try { return localStorage.getItem('gl_key') || ''; } catch { return ''; } };
const setKey = (k) => { try { k? localStorage.setItem('gl_key', k) : localStorage.removeItem('gl_key'); } catch {} };
const isDemo = () => false; // No more demo, we are LIVE now!

const memo = new Map();
async function live(path, ttl) {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.t < ttl) return hit.d;
  let res;
  try {
    res = await fetch(API + path, {
      headers: { 'x-apisports-key': getKey() || 'env-token' }
    });
  }
  catch { throw new Error('Could not reach your worker. Check internet.'); }
  if (!res.ok) {
    if (hit) return hit.d;
    throw new Error(res.status === 429? 'Rate limit hit. Wait 1 minute.' : 'API error ' + res.status);
  }
  const d = await res.json();
  memo.set(path, { t: Date.now(), d });
  return d;
}

// Convert API-SPORTS format to your app's format
const normMatch = (m) => ({
  id: m.fixture.id,
  utcDate: m.fixture.date,
  status: m.fixture.status.short === 'FT'? 'FINISHED' :
          ['1H','2H','HT','ET','P'].includes(m.fixture.status.short)? 'IN_PLAY' : 'TIMED',
  minute: m.fixture.status.elapsed?? null,
  competition: { code: COMPS.find(c=>c.id===m.league.id)?.code || 'PL', name: m.league.name, area: m.league.country },
  homeTeam: { id: m.teams.home.id, name: m.teams.home.name, crest: m.teams.home.logo },
  awayTeam: { id: m.teams.away.id, name: m.teams.away.name, crest: m.teams.away.logo },
  score: { fullTime: { home: m.goals.home, away: m.goals.away } },
});

/* ---- public API used by the pages ---- */
const Data = {
  async matches(date) {
    const d = await live(`/fixtures?date=${date}`, 30000);
    return (d.response || []).map(normMatch);
  },
  async standings(code) {
    const comp = COMPS.find(c=>c.code===code) || COMPS[0];
    const season = new Date().getFullYear();
    const d = await live(`/standings?league=${comp.id}&season=${season}`, 300000);
    const table = d.response?.[0]?.league?.standings?.[0] || [];
    return table.map((r) => ({
      position: r.rank, points: r.points, playedGames: r.all.played,
      team: { id: r.team.id, name: r.team.name, crest: r.team.logo },
      won: r.all.win, draw: r.all.draw, lost: r.all.lose, goalDifference: r.goalsDiff
    }));
  },
  async match(id) {
    const d = await live(`/fixtures?id=${id}`, 20000);
    const g = d.response?.[0];
    if (!g) throw new Error('Match not found');
    return {
     ...normMatch(g),
      events: (g.events || []).map(ev => ({
        minute: ev.time.elapsed, type: ev.type === 'Goal'? 'GOAL' : ev.detail.includes('Red')? 'RED' : 'YELLOW',
        team: ev.team.id === g.teams.home.id? 'home' : 'away', player: ev.player.name
      })),
      lineups: {
        home: { formation: g.lineups?.[0]?.formation || null, starting: (g.lineups?.[0]?.startXI || []).map(p=>({name:p.player.name, number:p.player.number})) },
        away: { formation: g.lineups?.[1]?.formation || null, starting: (g.lineups?.[1]?.startXI || []).map(p=>({name:p.player.name, number:p.player.number})) }
      },
      stats: null
    };
  },
};

/* ---- shared helpers ---- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LIVE = ['IN_PLAY', 'PAUSED', 'LIVE'];
function timeLabel(m) {
  if (m.status === 'FINISHED') return { t: 'FT', live: false };
  if (m.status === 'PAUSED') return { t: 'HT', live: true };
  if (LIVE.includes(m.status)) return { t: m.minute? `${m.minute}'` : 'LIVE', live: true };
  if (m.status === 'POSTPONED') return { t: 'PPD', live: false };
  return { t: new Date(m.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), live: false };
}
const loadJ = (k, d) => { try { return JSON.parse(localStorage.getItem('gl_' + k))?? d; } catch { return d; } };
const saveJ = (k, v) => { try { localStorage.setItem('gl_' + k, JSON.stringify(v)); } catch {} };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function initSettings() {
  const modal = $('#settings'); if (!modal) return;
  const refresh = () => { const b = $('#demoBanner'); if (b) { b.textContent = "LIVE via your worker - GoalLine is online!"; b.hidden = false; } };
  $('#settingsBtn').onclick = () => { $('#keyInput').value = getKey(); modal.hidden = false; };
  $('#cancelKey').onclick = () => (modal.hidden = true);
  $('#saveKey').onclick = () => { setKey($('#keyInput').value.trim()); modal.hidden = true; location.reload(); };
  refresh();
          }
