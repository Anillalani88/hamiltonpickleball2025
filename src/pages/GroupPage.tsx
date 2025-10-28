'use client'
import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore'
import { db, auth, isEditor } from '../firebase'
import ScoreEditor from '../components/ScoreEditor'

// Convert Firestore Timestamp | epoch-ms -> Date
function tsToDate(v: any): Date | null {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate() // Firestore Timestamp
  if (typeof v === 'number') return new Date(v)         // epoch ms
  return null
}

// Keep "AM/PM" glued to the number by replacing the first space with a non‑breaking space
function fmtTime(d: Date | null) {
  if (!d) return ''
  return d
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .replace(' ', '\u00A0') // '6:00 PM' -> '6:00 PM'
}

export default function GroupPage({ groupName }:{ groupName:'Group A'|'Group B' }){
  const [groupId, setGroupId] = useState<string>('')
  const [teams, setTeams] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [canEdit, setCanEdit] = useState(false)

  useEffect(()=>{
    const unsubAuth = auth.onAuthStateChanged(async u=>setCanEdit(await isEditor(u)))
    return unsubAuth
  },[])

  useEffect(()=>{
    // Load group id by name
    const qg = query(collection(db,'groups'), where('name','==',groupName))
    const unsubG = onSnapshot(qg, snap=>{
      const g = snap.docs[0]
      if(g){ setGroupId(g.id) }
    })
    return unsubG
  },[groupName])

  useEffect(()=>{
    if(!groupId) return
    const qt = query(collection(db,'teams'), where('groupId','==',groupId))
    // You can keep the dual orderBy now that the composite index exists
    const qm = query(
      collection(db,'matches'),
      where('groupId','==',groupId),
      orderBy('slot','asc'),
      orderBy('court','asc')
    )

    const ut = onSnapshot(qt, snap=> setTeams(snap.docs.map(d=>({id:d.id, ...d.data()}))))

    // Normalize startTime/endTime to real Date objects here
    const um = onSnapshot(qm, snap => {
      const rows = snap.docs.map(d => {
        const raw = { id: d.id, ...d.data() } as any
        return {
          ...raw,
          startTime: tsToDate(raw.startTime),
          endTime:   tsToDate(raw.endTime),
        }
      })
      setMatches(rows)
    })

    return ()=>{ ut(); um(); }
  },[groupId])

  const teamById = useMemo(()=>Object.fromEntries(teams.map(t=>[t.id,t])), [teams])

  return (
    <div className="card">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Slot</th><th>Start</th><th>End</th><th>Court</th>
            <th>Team 1</th><th>Score</th><th>Team 2</th><th>Score</th><th>Winner</th><th>Edit</th>
          </tr>
        </thead>
        <tbody>
          {matches.map(m=>{
            const t1 = teamById[m.team1Id]; const t2 = teamById[m.team2Id]
            const win1 = m.winnerId && m.winnerId === m.team1Id
            const win2 = m.winnerId && m.winnerId === m.team2Id
            return (
              <tr key={m.id}>
                <td>{m.slot}</td>

                {/* Render Date directly (we already converted it) with no‑wrap formatting */}
                <td className="nowrap">{fmtTime(m.startTime)}</td>
                <td className="nowrap">{fmtTime(m.endTime)}</td>

                <td className={courtClass(m.court)}>{m.court}</td>
                <td className={win1? 'win':''}>{t1? `${t1.name} (${t1.code})`: ''}</td>
                <td>{m.score1 ?? ''}</td>
                <td className={win2? 'win':''}>{t2? `${t2.name} (${t2.code})`: ''}</td>
                <td>{m.score2 ?? ''}</td>
                <td className={(win1||win2)? 'win':''}>{win1? t1?.name : win2? t2?.name : ''}</td>
                <td><ScoreEditor m={m} canEdit={canEdit} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function courtClass(c?:string){
  if(!c) return ''
  if(c.includes('1')) return 'court-1'
  if(c.includes('2')) return 'court-2'
  if(c.includes('3')) return 'court-3'
  if(c.includes('4')) return 'court-4'
  return ''
}