import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Convert Firestore Timestamp | epoch-ms number to JS Date.
 * Returns null if value isn't present.
 */
function tsToDate(v: any): Date | null {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate()       // Firestore Timestamp
  if (typeof v === 'number') return new Date(v)               // epoch ms (if ever used)
  return null
}

/**
 * Subscribe to matches for a group, normalizing startTime/endTime to Date.
 * Keeps your server-side ordering by slot + court (requires composite index).
 */
export function subscribeMatches(groupId: string, cb: (rows: any[]) => void) {
  const q = query(
    collection(db, 'matches'),
    where('groupId', '==', groupId),
    orderBy('slot', 'asc'),
    orderBy('court', 'asc')
    // If you want to avoid indexes entirely, comment the two orderBy() lines and do client-side sort.
    // If you want only one index, keep orderBy('slot') and remove orderBy('court').
  )

  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => {
      const raw = { id: d.id, ...d.data() } as any
      return {
        ...raw,
        startTime: tsToDate(raw.startTime),
        endTime:   tsToDate(raw.endTime),
      }
    })

    // Optional: if you removed orderBy() above, you can sort here:
    // rows.sort((a,b) => (Number(a.slot||0) - Number(b.slot||0)) ||
    //                    String(a.court||'').localeCompare(String(b.court||'')))

    cb(rows)
  })
}

export async function updateScore(matchId: string, s1: number, s2: number, team1Id: string, team2Id: string) {
  const winnerId = s1 > s2 ? team1Id : s2 > s1 ? team2Id : null
  await updateDoc(doc(db, 'matches', matchId), {
    score1: s1,
    score2: s2,
    winnerId,
    status: 'final',
    updatedAt: Date.now()
  })
}

export async function getTeams(groupId: string) {
  const snap = await getDocs(query(collection(db, 'teams'), where('groupId', '==', groupId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function clearScore(matchId: string){
  await updateDoc(doc(db, 'matches', matchId), {
    score1: null,
    score2: null,
    winnerId: null,
    status: 'scheduled',
    updatedAt: Date.now()
  })
}