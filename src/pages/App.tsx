import { PropsWithChildren, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { auth, isEditor } from '../firebase'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

export default function App({children}: PropsWithChildren){
  const [user, setUser] = useState<any>(null)
  const [editor, setEditor] = useState(false)
  const loc = useLocation()
  useEffect(()=>{
    return auth.onAuthStateChanged(async u=>{
      setUser(u)
      setEditor(await isEditor(u))
    })
  },[])
  return (
    <>
      <header>
        <img src="/logo.png" alt="logo" onError={(e:any)=>{e.currentTarget.style.display='none'}}/>
        <div>
          <h1>Hamilton 2025 — Mixed Doubles Pickleball</h1>
          <div className="sub">Start 6:00 PM · Courts 1–4 · One set to 11 points</div>
        </div>
        <div className="spacer"></div>
        {!user && <button className="btn" onClick={()=>signInWithPopup(auth, new GoogleAuthProvider())}>Sign in</button>}
        {user && <>
          <span className="badge">{editor? 'Editor' : 'Viewer'}</span>
          <button className="btn" onClick={()=>signOut(auth)}>Sign out</button>
        </>}
      </header>
      <nav>
        <NavLink to="/" className={({isActive})=>isActive?'active':''}>Group A — Schedule</NavLink>
        <NavLink to="/group-b" className={({isActive})=>isActive?'active':''}>Group B — Schedule</NavLink>
        <NavLink to="/standings-a" className={({isActive})=>isActive?'active':''}>Standings A</NavLink>
        <NavLink to="/standings-b" className={({isActive})=>isActive?'active':''}>Standings B</NavLink>
		<NavLink to="/knockout" className={({isActive})=>isActive?'active':''}>Knockout</NavLink>
        <NavLink to="/admin" className={({isActive})=>isActive?'active':''}>Admin</NavLink>
      </nav>
      <main>{children}</main>
    </>
  )
}
