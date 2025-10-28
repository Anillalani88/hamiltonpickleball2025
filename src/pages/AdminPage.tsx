'use client'
import { useEffect, useMemo, useState } from 'react'
import { auth, isEditor, db } from '../firebase'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import ScoreEditor from '../components/ScoreEditor'

// Convert Firestore Timestamp | epoch-ms to JS Date (or null if absent)
function tsToDate(v: any): Date | null {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate()
  if (typeof v === 'number') return new Date(v)
  return null
}

export default function AdminPage(){
  const [ok, setOk] = useState(false)
  const [groupId, setGroupId] = useState<string>('')
  const [matches, setMatches] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [teams, setTeams]   = useState<any[]>([])  // ✅ add teams for name lookup

  // Who can edit?
  useEffect(()=>{
    const unsubAuth = auth.onAuthStateChanged(async u => setOk(await isEditor(u)))
    const ug = onSnapshot(collection(db,'groups'),
      snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return ()=>{ unsubAuth(); ug(); }
  },[])

  // Load teams for selected group (for name lookups)
  useEffect(()=>{
    if (!groupId) { setTeams([]); return }
    const qt = onSnapshot(
      query(collection(db,'teams'), where('groupId','==',groupId)),
      snap => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return ()=> qt()
  },[groupId])

  // Load matches, normalize timestamps
  useEffect(()=>{
    if(!groupId) { setMatches([]); return }
    const qm = onSnapshot(
      query(collection(db,'matches'), where('groupId','==',groupId), orderBy('slot','asc')),
      snap => {
        const rows = snap.docs.map(d => {
          const raw = { id: d.id, ...d.data() } as any
          return {
            ...raw,
            startTime: tsToDate(raw.startTime),
            endTime:   tsToDate(raw.endTime),
          }
        })
        setMatches(rows)
      }
    )
    return ()=> qm()
  },[groupId])

  const teamById = useMemo(() =>
    Object.fromEntries(teams.map(t => [t.id, t])),
    [teams]
  )

  if(!ok) return <p>You must be an Editor to access Admin.</p>

  return (
    <div>
      <div className="toolbar">
        <label>Group:</label>
        <select className="btn" value={groupId} onChange={e=>setGroupId(e.target.value)}>
          <option value="">Select…</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {groupId && (
        <div className="card" style={{marginTop:12}}>
          <table>
            <thead>
              <tr>
                <th>Slot</th>
                <th>Court</th>
                {/* Optional (uncomment if you want to see times in Admin too)
                <th>Start</th>
                <th>End</th>
                */}
                <th>Team 1</th>
                <th>Score</th>
                <th>Team 2</th>
                <th>Score</th>
                <th>Save</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => {
                const t1 = teamById[m.team1Id]
                const t2 = teamById[m.team2Id]
                return (
                  <tr key={m.id}>
                    <td>{m.slot}</td>
                    <td>{m.court}</td>
                    {/* Optional times (if you enabled the columns above)
                    <td>{m.startTime ? m.startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</td>
                    <td>{m.endTime   ? m.endTime.toLocaleTimeString([],   { hour: 'numeric', minute: '2-digit' }) : ''}</td>
                    */}
                    <td>{t1 ? `${t1.name} (${t1.code})` : (m.team1Name ?? m.team1Id)}</td>
                    <td>{m.score1 ?? ''}</td>
                    <td>{t2 ? `${t2.name} (${t2.code})` : (m.team2Name ?? m.team2Id)}</td>
                    <td>{m.score2 ?? ''}</td>
                    <td><ScoreEditor m={m} canEdit={ok} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}