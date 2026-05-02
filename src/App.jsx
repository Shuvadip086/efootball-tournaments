import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CreateTournamentPage from './pages/CreateTournamentPage'
import ManageTournamentPage from './pages/ManageTournamentPage'
import PublicTournamentPage from './pages/PublicTournamentPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/t/:slug" element={<PublicTournamentPage />} />
        <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
        <Route path="/tournament/create" element={<AuthGuard><CreateTournamentPage /></AuthGuard>} />
        <Route path="/tournament/manage/:id" element={<AuthGuard><ManageTournamentPage /></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
