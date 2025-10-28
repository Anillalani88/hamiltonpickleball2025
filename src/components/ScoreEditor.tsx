import { useState } from 'react'
import { updateScore, clearScore } from '../lib/firestore'

export default function ScoreEditor({ m, canEdit }:{ m:any, canEdit:boolean }) {
  const [s1, setS1] = useState<string>(m.score1 ?? '')
  const [s2, setS2] = useState<string>(m.score2 ?? '')
  const [busy, setBusy] = useState(false)

  if (!canEdit) return <span className="badge">View</span>

  const n1 = s1 === '' ? NaN : Number(s1)
  const n2 = s2 === '' ? NaN : Number(s2)

  // Allow only integers within a sensible range (0..21 here; adjust as needed)
  const valid = Number.isInteger(n1) && Number.isInteger(n2) && n1 >= 0 && n2 >= 0 && n1 <= 21 && n2 <= 21

  async function onSave() {
    try {
      if (!valid) return
      setBusy(true)
      await updateScore(m.id, n1, n2, m.team1Id, m.team2Id)
    } catch (err: any) {
      console.error('Save failed:', err)
      alert(`Save failed: ${err?.code || err?.message || err}`)
    } finally {
      setBusy(false)
    }
  }

  async function onClear() {
    try {
      setBusy(true)
      await clearScore(m.id)           // sets score1/2=null, winnerId=null, status='scheduled'
      setS1('')
      setS2('')
    } catch (err: any) {
      console.error('Clear failed:', err)
      alert(`Clear failed: ${err?.code || err?.message || err}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="toolbar">
      <input
        className="input"
        type="number"
        inputMode="numeric"
        min={0}
        max={21}
        value={s1}
        onChange={e => setS1(e.currentTarget.value)}
        placeholder="0"
      />
      <span>-</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        min={0}
        max={21}
        value={s2}
        onChange={e => setS2(e.currentTarget.value)}
        placeholder="0"
      />

      <button className="btn primary"
        disabled={!valid || busy}
        onClick={onSave}>
        {busy ? 'Saving…' : 'Save'}
      </button>

      <button className="btn"
        disabled={busy}
        onClick={onClear}>
        Clear
      </button>
    </div>
  )
}