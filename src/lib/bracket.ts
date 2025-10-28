import { db } from '../firebase'
import { doc, onSnapshot, getDoc, setDoc, updateDoc } from 'firebase/firestore'

export type KOKey = 'sf1' | 'sf2' | 'final'
export type KOGame = 1 | 2 | 3

export function subscribeBracket(cb: (data:any|null)=>void) {
  const ref = doc(db, 'bracket', 'main')
  return onSnapshot(ref, snap => cb(snap.exists() ? snap.data() : null))
}

// Seeds structure example:
// { sf1: { team1Id: 'groupA_A1', team2Id: 'groupB_B2' }, sf2: { team1Id: 'groupB_B1', team2Id: 'groupA_A2' } }
export async function setSeedsFromStandings({ a1, a2, b1, b2 }:{
  a1: string; a2: string; b1: string; b2: string;
}) {
  const ref = doc(db, 'bracket', 'main')
  await setDoc(ref, {
    // Semifinal seeds (reset scores & winner)
    sf1: { team1Id: a1, team2Id: b2, gamesWonT1: 0, gamesWonT2: 0, winnerId: null },
    sf2: { team1Id: b1, team2Id: a2, gamesWonT1: 0, gamesWonT2: 0, winnerId: null },

    // Final is cleared; will populate once SF winners exist
    final: { team1Id: null, team2Id: null, gamesWonT1: 0, gamesWonT2: 0, winnerId: null },

    // Champion cleared
    championId: null,
  }, { merge: true })
}

// Save one game's score, recompute games-won and winner; propagate to Final/Champion if complete.
export async function saveKOScore(matchKey: KOKey, game: KOGame, t1: number|null, t2: number|null) {
  const ref = doc(db, 'bracket', 'main')
  const snap = await getDoc(ref)
  const cur: any = snap.exists() ? snap.data() : {}

  // Ensure structure
  cur[matchKey] = cur[matchKey] || {}
  cur[matchKey].g1 = cur[matchKey].g1 || {}
  cur[matchKey].g2 = cur[matchKey].g2 || {}
  cur[matchKey].g3 = cur[matchKey].g3 || {}

  // write this game's scores
  const gk = `g${game}`
  cur[matchKey][gk] = { t1: t1 ?? null, t2: t2 ?? null }

  // compute games won
  const wins = { t1: 0, t2: 0 }
  ;(['g1','g2','g3'] as const).forEach(k => {
    const g = cur[matchKey][k]
    if (!g) return
    if (typeof g.t1 === 'number' && typeof g.t2 === 'number') {
      if (g.t1 > g.t2) wins.t1++
      else if (g.t2 > g.t1) wins.t2++
    }
  })
  cur[matchKey].gamesWonT1 = wins.t1
  cur[matchKey].gamesWonT2 = wins.t2

  // winner
  const t1Id = cur[matchKey].team1Id
  const t2Id = cur[matchKey].team2Id
  cur[matchKey].winnerId = (wins.t1 > wins.t2) ? t1Id : (wins.t2 > wins.t1) ? t2Id : null

  // propagate finalists/champion
  cur.final = cur.final || {}
  if (matchKey === 'sf1' && cur[matchKey].winnerId) {
    cur.final.team1Id = cur[matchKey].winnerId
    // clear final scores if teams changed
    if (cur.final._prevT1 !== cur.final.team1Id) {
      delete cur.final.g1; delete cur.final.g2; delete cur.final.g3
      cur.final.gamesWonT1 = 0; cur.final.gamesWonT2 = 0; cur.final.winnerId = null
      cur.final._prevT1 = cur.final.team1Id
    }
  }
  if (matchKey === 'sf2' && cur[matchKey].winnerId) {
    cur.final.team2Id = cur[matchKey].winnerId
    if (cur.final._prevT2 !== cur.final.team2Id) {
      delete cur.final.g1; delete cur.final.g2; delete cur.final.g3
      cur.final.gamesWonT1 = 0; cur.final.gamesWonT2 = 0; cur.final.winnerId = null
      cur.final._prevT2 = cur.final.team2Id
    }
  }

  // if final has both teams, recompute final winner if scores present
  if (matchKey === 'final' || (cur.final.team1Id && cur.final.team2Id)) {
    const fwins = { t1: 0, t2: 0 }
    ;(['g1','g2','g3'] as const).forEach(k => {
      const g = cur.final?.[k]
      if (g && typeof g.t1 === 'number' && typeof g.t2 === 'number') {
        if (g.t1 > g.t2) fwins.t1++
        else if (g.t2 > g.t1) fwins.t2++
      }
    })
    cur.final.gamesWonT1 = fwins.t1
    cur.final.gamesWonT2 = fwins.t2
    cur.final.winnerId = (fwins.t1 > fwins.t2) ? cur.final.team1Id : (fwins.t2 > fwins.t1) ? cur.final.team2Id : null
    cur.championId = cur.final.winnerId || null
  }

  // persist minimal update (merge)
  await updateDoc(ref, cur)
}

export async function clearKOMatch(matchKey: KOKey) {
  const ref = doc(db, 'bracket', 'main')
  const snap = await getDoc(ref)
  const cur: any = snap.exists() ? snap.data() : {}

  cur[matchKey] = {
    team1Id: cur[matchKey]?.team1Id ?? null,
    team2Id: cur[matchKey]?.team2Id ?? null,
    gamesWonT1: 0,
    gamesWonT2: 0,
    winnerId: null
  }
  delete cur[matchKey].g1
  delete cur[matchKey].g2
  delete cur[matchKey].g3

  if (matchKey === 'final') cur.championId = null

  await updateDoc(ref, cur)
}

export async function clearSeeds() {
  const ref = doc(db, 'bracket', 'main')
  await setDoc(ref, {
    sf1: { team1Id: null, team2Id: null, gamesWonT1: 0, gamesWonT2: 0, winnerId: null },
    sf2: { team1Id: null, team2Id: null, gamesWonT1: 0, gamesWonT2: 0, winnerId: null },
    final: { team1Id: null, team2Id: null, gamesWonT1: 0, gamesWonT2: 0, winnerId: null },
    championId: null
  }, { merge: true })
}
``