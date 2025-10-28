'use client'
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'

export default function StandingsPage({ groupName }:{ groupName:'Group A'|'Group B' }){
  const [groupId, setGroupId] = useState<string>('')
  const [teams, setTeams] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])

  useEffect(()=>{
    const unsubG = onSnapshot(query(collection(db,'groups'), where('name','==',groupName)), snap=>{
      const g = snap.docs[0]
      if(g) setGroupId(g.id)
    })
    return unsubG
  },[groupName])

  useEffect(()=>{
    if(!groupId) return
    const ut = onSnapshot(query(collection(db,'teams'), where('groupId','==',groupId)),
      snap => setTeams(snap.docs.map(d=>({id:d.id, ...d.data()}))))
    const um = onSnapshot(query(collection(db,'matches'), where('groupId','==',groupId)),
      snap => setMatches(snap.docs.map(d=>({id:d.id, ...d.data()}))))
    return ()=>{ ut(); um(); }
  },[groupId])

  const rows = useMemo(()=>buildStandings(teams, matches), [teams, matches])

  return (
    <div className="card">
      <div style={{padding: '10px 10px 0 10px', color: '#6b7280', fontSize: 12}}>
        Tie‑break order: Wins → Point Diff → Points For. Composite shown on desktop.
      </div>

      <table>
        <thead>
          <tr className="bg-blue-900 text-white">
            <th>#</th>
            <th>Code</th>
            <th>Team</th>
            <th>W</th>
            <th>L</th>
            <th>PF</th>
            <th>PA</th>
            <th>Diff</th>
            <th>Win %</th>
            <th className="hide-md">Composite</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const rank = idx + 1
            const isTop2 = rank <= 2
            const seedBadge = isTop2 ? (
              <span className={`seed ${rank === 1 ? 'seed1' : 'seed2'}`}>
                {rank === 1 ? 'Seed 1' : 'Seed 2'}
              </span>
            ) : null

            return (
              <tr key={r.id} className={`odd:bg-slate-50 ${isTop2 ? 'win' : ''}`}>
                <td className="p-2 text-center">{rank}</td>
                <td className="p-2 text-center"><span className="badge">{r.code}</span></td>
                <td className="p-2">
                  {r.name} {seedBadge}
                </td>
                <td className="p-2 text-center">{r.wins}</td>
                <td className="p-2 text-center">{r.losses}</td>
                <td className="p-2 text-center">{r.pf}</td>
                <td className="p-2 text-center">{r.pa}</td>
                <td className="p-2 text-center">{r.diff}</td>
                <td className="p-2 text-center">{r.winPct.toFixed(2)}</td>
                <td className="p-2 text-center hide-md">{r.composite}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function buildStandings(teams:any[], matches:any[]){
  const map = new Map<string, any>()
  teams.forEach(t => map.set(t.id, { id:t.id, name:t.name, code:t.code, pf:0, pa:0, wins:0, losses:0 }))
  matches.filter(m=>m.status==='final').forEach(m => {
    const a = map.get(m.team1Id); const b = map.get(m.team2Id)
    if(!a || !b) return
    a.pf += m.score1 ?? 0; a.pa += m.score2 ?? 0
    b.pf += m.score2 ?? 0; b.pa += m.score1 ?? 0
    if((m.score1 ?? 0) > (m.score2 ?? 0)) { a.wins++; b.losses++; }
    else if((m.score2 ?? 0) > (m.score1 ?? 0)) { b.wins++; a.losses++; }
  })
  return [...map.values()].map(r=> ({
    ...r,
    diff: r.pf - r.pa,
    winPct: (r.wins + r.losses) ? r.wins / (r.wins + r.losses) : 0,
    composite: r.wins*100000 + ((r.pf - r.pa)+1000)*100 + r.pf
  })).sort((x,y)=> y.composite - x.composite)
}