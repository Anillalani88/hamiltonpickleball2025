'use client'
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db, auth, isEditor } from '../firebase'
import {
  subscribeBracket,
  setSeedsFromStandings,
  saveKOScore,
  clearKOMatch,
  clearSeeds,          // <-- NEW
  KOKey
} from '../lib/bracket'

// Build standings (same composite/tiebreak as your site)
function buildStandings(teams: any[], matches: any[]) {
  const map = new Map<string, any>()
  teams.forEach(t => map.set(t.id, { id: t.id, name: t.name, code: t.code, pf: 0, pa: 0, wins: 0, losses: 0 }))
  matches.filter(m => m.status === 'final').forEach(m => {
    const a = map.get(m.team1Id); const b = map.get(m.team2Id)
    if (!a || !b) return
    a.pf += m.score1 ?? 0; a.pa += m.score2 ?? 0
    b.pf += m.score2 ?? 0; b.pa += m.score1 ?? 0
    if ((m.score1 ?? 0) > (m.score2 ?? 0)) { a.wins++; b.losses++; }
    else if ((m.score2 ?? 0) > (m.score1 ?? 0)) { b.wins++; a.losses++; }
  })
  return [...map.values()].map(r => ({
    ...r,
    diff: r.pf - r.pa,
    winPct: (r.wins + r.losses) ? r.wins / (r.wins + r.losses) : 0,
    composite: r.wins * 100000 + ((r.pf - r.pa) + 1000) * 100 + r.pf
  })).sort((x, y) => y.composite - x.composite)
}

export default function KnockoutPage() {
  const [ok, setOk] = useState(false)

  // Teams/matches by group
  const [teamsA, setTeamsA] = useState<any[]>([])
  const [teamsB, setTeamsB] = useState<any[]>([])
  const [matchesA, setMatchesA] = useState<any[]>([])
  const [matchesB, setMatchesB] = useState<any[]>([])
  const [bracket, setBracket] = useState<any | null>(null)

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async u => setOk(await isEditor(u)))

    // Group A subscriptions
    const unsubGA = onSnapshot(query(collection(db, 'groups'), where('name', '==', 'Group A')), s => {
      const g = s.docs[0]; if (!g) return
      const gid = g.id
      onSnapshot(query(collection(db, 'teams'), where('groupId', '==', gid)),
        snap => setTeamsA(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      onSnapshot(query(collection(db, 'matches'), where('groupId', '==', gid)),
        snap => setMatchesA(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    })

    // Group B subscriptions
    const unsubGB = onSnapshot(query(collection(db, 'groups'), where('name', '==', 'Group B')), s => {
      const g = s.docs[0]; if (!g) return
      const gid = g.id
      onSnapshot(query(collection(db, 'teams'), where('groupId', '==', gid)),
        snap => setTeamsB(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      onSnapshot(query(collection(db, 'matches'), where('groupId', '==', gid)),
        snap => setMatchesB(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    })

    const unsubBracket = subscribeBracket(setBracket)
    return () => { unsubAuth(); unsubGA(); unsubGB(); unsubBracket(); }
  }, [])

  // Live standings
  const rowsA = useMemo(() => buildStandings(teamsA, matchesA), [teamsA, matchesA])
  const rowsB = useMemo(() => buildStandings(teamsB, matchesB), [teamsB, matchesB])

  // Results present? (at least one 'final' match in each group)
  const hasResultsA = useMemo(() => matchesA.some(m => m.status === 'final'), [matchesA])
  const hasResultsB = useMemo(() => matchesB.some(m => m.status === 'final'), [matchesB])
  const allowSeeds = hasResultsA && hasResultsB

  // “Live” seeds from standings (only if both groups have results)
  const liveSeeds = useMemo(() => ({
    a1: allowSeeds ? rowsA[0]?.id ?? null : null,
    a2: allowSeeds ? rowsA[1]?.id ?? null : null,
    b1: allowSeeds ? rowsB[0]?.id ?? null : null,
    b2: allowSeeds ? rowsB[1]?.id ?? null : null,
  }), [allowSeeds, rowsA, rowsB])

  const teamById = useMemo(() => {
    const all = [...teamsA, ...teamsB]
    return Object.fromEntries(all.map(t => [t.id, t]))
  }, [teamsA, teamsB])

  function nameOf(id?: string) {
    const t = id ? teamById[id] : null
    return t ? `${t.name} (${t.code})` : ''
  }

  // ---------- Match row (Best-of-3) ----------
  function MatchRow({ keyName, m, disabled = false }: { keyName: KOKey, m: any, disabled?: boolean }) {
    const [busy, setBusy] = useState(false)

    // Local inputs to allow Save once for all three games
    const [g1t1, setG1t1] = useState<string>(m?.g1?.t1 ?? '')
    const [g1t2, setG1t2] = useState<string>(m?.g1?.t2 ?? '')
    const [g2t1, setG2t1] = useState<string>(m?.g2?.t1 ?? '')
    const [g2t2, setG2t2] = useState<string>(m?.g2?.t2 ?? '')
    const [g3t1, setG3t1] = useState<string>(m?.g3?.t1 ?? '')
    const [g3t2, setG3t2] = useState<string>(m?.g3?.t2 ?? '')

    // Refresh inputs if someone else updates the doc
    useEffect(() => {
      setG1t1(m?.g1?.t1 ?? ''); setG1t2(m?.g1?.t2 ?? '')
      setG2t1(m?.g2?.t1 ?? ''); setG2t2(m?.g2?.t2 ?? '')
      setG3t1(m?.g3?.t1 ?? ''); setG3t2(m?.g3?.t2 ?? '')
    }, [m?.g1?.t1, m?.g1?.t2, m?.g2?.t1, m?.g2?.t2, m?.g3?.t1, m?.g3?.t2])

    const t1 = nameOf(m?.team1Id)
    const t2 = nameOf(m?.team2Id)
    const gw1 = m?.gamesWonT1 ?? 0, gw2 = m?.gamesWonT2 ?? 0
    const win = nameOf(m?.winnerId)

    // Local wins from current inputs (so G3 unlocks without saving)
    const toN = (v: string) => (v === '' ? null : Number(v))
    const localWins = () => {
      let a = 0, b = 0
      const g1n1 = toN(g1t1), g1n2 = toN(g1t2)
      const g2n1 = toN(g2t1), g2n2 = toN(g2t2)
      if (g1n1 != null && g1n2 != null) { if (g1n1 > g1n2) a++; else if (g1n2 > g1n1) b++; }
      if (g2n1 != null && g2n2 != null) { if (g2n1 > g2n2) a++; else if (g2n2 > g2n1) b++; }
      return { a, b }
    }
    const lw = localWins()

    // Lock G3 unless G1/G2 are present and split 1–1
    const g1Set = g1t1 !== '' && g1t2 !== ''
    const g2Set = g2t1 !== '' && g2t2 !== ''
    const g3Locked = !(g1Set && g2Set && lw.a === 1 && lw.b === 1)

    const parse = (v: string) => (v === '' ? null : Number(v))

    async function onSaveAll() {
      try {
        setBusy(true)
        await saveKOScore(keyName, 1, parse(g1t1), parse(g1t2))
        await saveKOScore(keyName, 2, parse(g2t1), parse(g2t2))
        await saveKOScore(keyName, 3, parse(g3t1), parse(g3t2))
      } catch (e: any) {
        console.error('KO save failed', e)
        alert(`Save failed: ${e?.code || e?.message || e}`)
      } finally { setBusy(false) }
    }

    async function onClearMatch() {
      try {
        setBusy(true)
        await clearKOMatch(keyName)
        setG1t1(''); setG1t2(''); setG2t1(''); setG2t2(''); setG3t1(''); setG3t2('')
      } catch (e: any) {
        console.error('KO clear failed', e)
        alert(`Clear failed: ${e?.code || e?.message || e}`)
      } finally { setBusy(false) }
    }

    return (
      <>
        <tr>
          <td className="p-2">{keyName.toUpperCase()}</td>
          <td className="p-2">{t1}</td>
          <td className="p-2">{t2}</td>

          {/* G1 */}
          <td><input className="input" type="number" inputMode="numeric" min={0} max={21}
            value={g1t1} onChange={e => setG1t1(e.currentTarget.value)} disabled={disabled} /></td>
          <td>-</td>
          <td><input className="input" type="number" inputMode="numeric" min={0} max={21}
            value={g1t2} onChange={e => setG1t2(e.currentTarget.value)} disabled={disabled} /></td>

          {/* G2 */}
          <td><input className="input" type="number" inputMode="numeric" min={0} max={21}
            value={g2t1} onChange={e => setG2t1(e.currentTarget.value)} disabled={disabled} /></td>
          <td>-</td>
          <td><input className="input" type="number" inputMode="numeric" min={0} max={21}
            value={g2t2} onChange={e => setG2t2(e.currentTarget.value)} disabled={disabled} /></td>

          {/* G3 */}
          <td><input className="input" type="number" inputMode="numeric" min={0} max={21}
            value={g3t1} onChange={e => setG3t1(e.currentTarget.value)} disabled={disabled || g3Locked} /></td>
          <td>-</td>
          <td><input className="input" type="number" inputMode="numeric" min={0} max={21}
            value={g3t2} onChange={e => setG3t2(e.currentTarget.value)} disabled={disabled || g3Locked} /></td>

          <td className="p-2">{gw1}–{gw2}</td>
          <td className="p-2 win">{win}</td>
        </tr>

        {/* Actions row under the match */}
        {ok && (
          <tr className="no-print">
            <td colSpan={14} style={{ padding: '8px 12px', textAlign: 'right' }}>
              <button className="btn" onClick={onClearMatch} disabled={busy || disabled}>Clear Match</button>
              <button className="btn primary" onClick={onSaveAll} disabled={busy || disabled} style={{ marginLeft: 8 }}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </td>
          </tr>
        )}
      </>
    )
  }

  // ----- Build view models for KO rows -----
  const sf1 = bracket?.sf1 || {}
  const sf2 = bracket?.sf2 || {}
  const fin = bracket?.final || {}

  // SF teams (hide if there are no results in groups)
  const sf1Team1Id = allowSeeds ? (sf1?.team1Id ?? liveSeeds.a1) : null
  const sf1Team2Id = allowSeeds ? (sf1?.team2Id ?? liveSeeds.b2) : null
  const sf2Team1Id = allowSeeds ? (sf2?.team1Id ?? liveSeeds.b1) : null
  const sf2Team2Id = allowSeeds ? (sf2?.team2Id ?? liveSeeds.a2) : null

  const sf1ForView = { ...sf1, team1Id: sf1Team1Id, team2Id: sf1Team2Id }
  const sf2ForView = { ...sf2, team1Id: sf2Team1Id, team2Id: sf2Team2Id }

  const sf1Disabled = !(sf1Team1Id && sf1Team2Id)
  const sf2Disabled = !(sf2Team1Id && sf2Team2Id)

  // Final teams come from SF winners only
  const finalTeam1Id = (sf1ForView?.winnerId && allowSeeds) ? sf1ForView.winnerId : null
  const finalTeam2Id = (sf2ForView?.winnerId && allowSeeds) ? sf2ForView.winnerId : null
  const finForView = { ...fin, team1Id: finalTeam1Id, team2Id: finalTeam2Id }
  const finalDisabled = !(finalTeam1Id && finalTeam2Id)

  // Detect if there’s anything to clear (to disable Clear Seeds)
  const hasAnySeeds = Boolean(
    bracket?.sf1?.team1Id || bracket?.sf1?.team2Id ||
    bracket?.sf2?.team1Id || bracket?.sf2?.team2Id ||
    bracket?.final?.team1Id || bracket?.final?.team2Id ||
    bracket?.championId
  )

  const champ = nameOf(bracket?.championId)

  return (
    <div className="card" style={{ paddingBottom: 8 }}>
      <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, color: '#1F4E78' }}>Knockout — Best‑of‑3</h3>
        <div className="spacer" />
        {ok && (
          <>
            <button
              className="btn primary no-print"
              disabled={!allowSeeds || !liveSeeds.a1 || !liveSeeds.a2 || !liveSeeds.b1 || !liveSeeds.b2}
              onClick={() => {
                if (liveSeeds.a1 && liveSeeds.a2 && liveSeeds.b1 && liveSeeds.b2) {
                  setSeedsFromStandings({ a1: liveSeeds.a1, a2: liveSeeds.a2, b1: liveSeeds.b1, b2: liveSeeds.b2 })
                } else {
                  alert('Standings not ready yet (need final results in both groups).')
                }
              }}
            >
              Set Seeds from Standings
            </button>

            <button
              className="btn no-print"
              disabled={!hasAnySeeds}
              onClick={async () => {
                if (!hasAnySeeds) return
                const go = confirm('Clear semifinal seeds, final teams/scores, and champion?')
                if (!go) return
                try { await clearSeeds() }
                catch (e: any) { console.error(e); alert(`Failed to clear seeds: ${e?.code || e?.message || e}`) }
              }}
              style={{ marginLeft: 8 }}
            >
              Clear Seeds
            </button>
          </>
        )}
      </div>

      <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#6b7280' }}>
        Seeds: A1 vs B2 • B1 vs A2. Enter G1/G2/G3; Save to apply. G3 unlocks when G1/G2 are split 1–1.
      </div>

      {/* Seed preview */}
      <div style={{ padding: '0 12px 12px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div><strong>A1:</strong> {allowSeeds ? nameOf(liveSeeds.a1 || sf1?.team1Id) : ''}</div>
        <div><strong>A2:</strong> {allowSeeds ? nameOf(liveSeeds.a2 || sf2?.team2Id) : ''}</div>
        <div><strong>B1:</strong> {allowSeeds ? nameOf(liveSeeds.b1 || sf2?.team1Id) : ''}</div>
        <div><strong>B2:</strong> {allowSeeds ? nameOf(liveSeeds.b2 || sf1?.team2Id) : ''}</div>
      </div>

      <table>
        <thead>
          <tr className="bg-blue-900 text-white">
            <th>Stage</th><th>Team 1</th><th>Team 2</th>
            <th colSpan={3}>G1</th><th colSpan={3}>G2</th><th colSpan={3}>G3</th>
            <th>Games</th><th>Winner</th>
          </tr>
        </thead>
        <tbody>
          <MatchRow keyName="sf1" m={sf1ForView} disabled={sf1Disabled} />
          <MatchRow keyName="sf2" m={sf2ForView} disabled={sf2Disabled} />
          <MatchRow keyName="final" m={finForView} disabled={finalDisabled} />

          {/* CENTERED CHAMPION */}
          <tr>
            <td colSpan={14} className="champ-cell">
              <div className="champ-wrap">
                <span className="champ-label">Champion</span>
                <span className="champ-name">{champ || '—'}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
