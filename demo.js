/* Demo data generator (used when no API key is saved) */
const TEAMS = {
  PL: ['Arsenal','Chelsea','Liverpool','Man City','Man United','Tottenham','Newcastle','Aston Villa'],
  PD: ['Real Madrid','Barcelona','Atletico','Sevilla','Valencia','Villarreal','Betis','Girona'],
  BL1: ['Bayern','Dortmund','Leverkusen','Leipzig','Frankfurt','Stuttgart','Freiburg','Wolfsburg'],
  SA: ['Inter','Milan','Juventus','Napoli','Roma','Lazio','Atalanta','Fiorentina'],
  FL1: ['PSG','Marseille','Monaco','Lyon','Lille','Nice','Lens','Rennes'],
  CL: ['Arsenal','Real Madrid','Bayern','Inter','PSG','Barcelona','Liverpool','Dortmund'],
};
const tIds = {}; let nextT = 100;
const tid = (n) => (tIds[n] ??= nextT++);
const crest = (n) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='19' fill='hsl(${(tid(n) * 47) % 360},55%,45%)'/><text x='20' y='26' font-size='18' font-family='Arial' font-weight='700' text-anchor='middle' fill='white'>${n[0]}</text></svg>`);
const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const dayNum = (d) => Math.floor(new Date(d + 'T00:00:00Z').getTime() / 86400000);

function demoMatches(date) {
  const rnd = seeded(dayNum(date)); const now = Date.now(); const out = []; let id = dayNum(date) * 100;
  COMPS.forEach((c) => {
    if (rnd() < 0.25) return;
    const pool = TEAMS[c.code].slice(); const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const h = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const hour = 12 + Math.floor(rnd() * 9), min = rnd() < 0.5 ? '00' : '30';
      const ko = new Date(`${date}T${String(hour).padStart(2, '0')}:${min}:00Z`);
      const el = (now - ko.getTime()) / 60000;
      let status = 'TIMED', hs = null, as = null, minute = null;
      if (el > 115) status = 'FINISHED'; else if (el >= 0) status = el > 45 && el < 60 ? 'PAUSED' : 'IN_PLAY';
      if (status !== 'TIMED') {
        const r2 = seeded(id + 7); hs = 0; as = 0;
        const goals = Math.floor((Math.min(el, 90) / 90) * (1 + r2() * 4));
        for (let g = 0; g < goals; g++) (r2() < 0.52 ? hs++ : as++);
        minute = Math.min(90, Math.floor(el > 60 ? el - 15 : el));
      }
      out.push({ id: id++, utcDate: ko.toISOString(), status, minute: status === 'IN_PLAY' ? minute : null,
        competition: { code: c.code, name: c.name, area: c.area },
        homeTeam: { id: tid(h), name: h, crest: crest(h) }, awayTeam: { id: tid(a), name: a, crest: crest(a) },
        score: { fullTime: { home: hs, away: as } } });
    }
  });
  return out.sort((x, y) => x.utcDate.localeCompare(y.utcDate));
}
function demoStandings(code) {
  const rnd = seeded(code.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const rows = (TEAMS[code] || []).map((name) => {
    const won = Math.floor(rnd() * 7), draw = Math.floor(rnd() * (8 - won)), lost = 8 - won - draw;
    const gf = won * 2 + draw + Math.floor(rnd() * 4), ga = lost * 2 + draw + Math.floor(rnd() * 3);
    return { team: { id: tid(name), name, crest: crest(name) }, playedGames: 8, won, draw, lost, goalsFor: gf, goalsAgainst: ga, goalDifference: gf - ga, points: won * 3 + draw };
  }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
  rows.forEach((r, i) => (r.position = i + 1)); return rows;
}
function demoMatch(id) {
  const date = new Date(Math.floor(id / 100) * 86400000).toISOString().slice(0, 10);
  const m = demoMatches(date).find((x) => x.id === id); if (!m) return null;
  const r = seeded(id), P = ['Silva','Martinez','Kane','Rodri','Haaland','Salah','Vinicius','Osimhen','Lewandowski','Mbappe'];
  const pick = () => P[Math.floor(r() * P.length)], h = m.score.fullTime.home || 0, a = m.score.fullTime.away || 0, events = [];
  for (let i = 0; i < h; i++) events.push({ minute: 5 + Math.floor(r() * 85), type: 'GOAL', team: 'home', player: pick() });
  for (let i = 0; i < a; i++) events.push({ minute: 5 + Math.floor(r() * 85), type: 'GOAL', team: 'away', player: pick() });
  if (m.status !== 'TIMED') events.push({ minute: 20 + Math.floor(r() * 60), type: 'YELLOW', team: r() < .5 ? 'home' : 'away', player: pick() });
  events.sort((x, y) => x.minute - y.minute);
  const sh = (s) => Math.max(1, Math.round(s * 4 + r() * 6));
  return { ...m, events, lineups: null, stats: m.status === 'TIMED' ? null : { possession: [50 + Math.round((r() - .5) * 30)], shots: [sh(h), sh(a)], corners: [Math.floor(r() * 9), Math.floor(r() * 9)], fouls: [5 + Math.floor(r() * 10), 5 + Math.floor(r() * 10)] } };
}
