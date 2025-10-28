import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import App from './pages/App'
import GroupPage from './pages/GroupPage'
import StandingsPage from './pages/StandingsPage'
import KnockoutPage from './pages/KnockoutPage'
import AdminPage from './pages/AdminPage'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App>
        <Routes>
          <Route path="/" element={<GroupPage groupName="Group A" />} />
          <Route path="/group-b" element={<GroupPage groupName="Group B" />} />
          <Route path="/standings-a" element={<StandingsPage groupName="Group A" />} />
          <Route path="/standings-b" element={<StandingsPage groupName="Group B" />} />
		  <Route path="/knockout" element={<KnockoutPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </App>
    </BrowserRouter>
  </React.StrictMode>
)
