import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createAssignmentWithStation,
  listActiveStylists,
  listDutyChecklists,
  pinLogin,
  todayISODate,
} from './lib/api'
import type { SessionUser, StaffMember } from './lib/api'
import { StylistToday } from './StylistToday'
import './App.css'

const SESSION_KEY = 'rlh-session'

type RoutePath = '/login' | '/manager' | '/stylist'

function loadSession(): SessionUser | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

function saveSession(session: SessionUser | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function App() {
  const currentPath = window.location.pathname
  const normalizedPath = currentPath === '/' ? '/login' : currentPath
  if (currentPath === '/') {
    window.history.replaceState({}, '', normalizedPath)
  }

  const [path, setPath] = useState<RoutePath>((normalizedPath as RoutePath) || '/login')
  const [session, setSession] = useState<SessionUser | null>(() => loadSession())

  const navigate = useCallback((nextPath: RoutePath, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', nextPath)
    } else {
      window.history.pushState({}, '', nextPath)
    }
    setPath(nextPath)
  }, [])

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname as RoutePath)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const logout = () => {
    saveSession(null)
    setSession(null)
    navigate('/login')
  }

  if (path === '/manager') {
    if (!session || (session.role !== 'manager' && session.role !== 'admin')) {
      return <Unauthorized onBack={() => navigate('/login', true)} />
    }

    return <ManagerPage session={session} onLogout={logout} />
  }

  if (path === '/stylist') {
    if (!session || !['stylist', 'manager', 'admin'].includes(session.role)) {
      return <Unauthorized onBack={() => navigate('/login', true)} />
    }

    return <StylistPage session={session} onLogout={logout} />
  }

  return (
    <LoginPage
      onLogin={(nextSession) => {
        saveSession(nextSession)
        setSession(nextSession)
        navigate(nextSession.role === 'stylist' ? '/stylist' : '/manager')
      }}
      activeSession={session}
      onGoToSession={() => navigate(session?.role === 'stylist' ? '/stylist' : '/manager')}
    />
  )
}

function Unauthorized({ onBack }: { onBack: () => void }) {
  return (
    <main className="container">
      <section className="card">
        <h1>Access denied</h1>
        <p>You do not have access to this page. Please log in with the correct role.</p>
        <button onClick={onBack}>Back to login</button>
      </section>
    </main>
  )
}

function LoginPage({
  onLogin,
  activeSession,
  onGoToSession,
}: {
  onLogin: (session: SessionUser) => void
  activeSession: SessionUser | null
  onGoToSession: () => void
}) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    listActiveStylists()
      .then((result) => {
        setStaff(result)
        if (result[0]) {
          setSelectedName(result[0].full_name)
        }
      })
      .catch((error: Error) => setMessage(error.message || 'Failed to load active staff'))
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      const user = await pinLogin(selectedName, pin)
      if (!user) {
        setMessage('Invalid name + PIN combination')
        return
      }

      onLogin(user)
    } catch (error) {
      setMessage((error as Error).message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="container">
      <section className="card">
        <h1>RLH Cleaning + SOC</h1>
        <p className="muted">Sign in with your name and 4-digit PIN.</p>
        {activeSession && (
          <button className="ghost" onClick={onGoToSession} type="button">
            Continue as {activeSession.full_name}
          </button>
        )}
        <form className="stack" onSubmit={submit}>
          <label>
            Staff name
            <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)} required>
              {staff.map((member) => (
                <option value={member.full_name} key={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            PIN
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              required
            />
          </label>

          <button disabled={isLoading}>{isLoading ? 'Signing in...' : 'Sign in'}</button>
        </form>

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  )
}

function ManagerPage({ session, onLogout }: { session: SessionUser; onLogout: () => void }) {
  const [stylists, setStylists] = useState<StaffMember[]>([])
  const [checklists, setChecklists] = useState<{ id: number; name: string }[]>([])
  const [selectedStylistId, setSelectedStylistId] = useState('')
  const [selectedChecklistId, setSelectedChecklistId] = useState('')
  const [date, setDate] = useState(todayISODate())
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    Promise.all([listActiveStylists(), listDutyChecklists()])
      .then(([staffMembers, dutyChecklists]) => {
        const available = staffMembers.filter((member) => member.role !== 'admin')
        setStylists(available)
        setChecklists(dutyChecklists)
        if (available[0]) {
          setSelectedStylistId(available[0].id)
        }
        if (dutyChecklists[0]) {
          setSelectedChecklistId(String(dutyChecklists[0].id))
        }
      })
      .catch((error: Error) => setStatus(error.message || 'Failed to load assignment data'))
  }, [])

  const selectedStylistName = useMemo(
    () => stylists.find((member) => member.id === selectedStylistId)?.full_name ?? 'stylist',
    [selectedStylistId, stylists],
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setStatus('')

    try {
      await createAssignmentWithStation({
        stylistId: selectedStylistId,
        date,
        dutyChecklistId: Number(selectedChecklistId),
        createdBy: session.id,
      })
      setStatus(`Assigned duty checklist (+station) to ${selectedStylistName} on ${date}.`)
    } catch (error) {
      setStatus((error as Error).message || 'Failed to assign duty checklist')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container">
      <section className="card wide">
        <header className="header">
          <div>
            <h1>Manager tools</h1>
            <p className="muted">Week basis: Sunday through Saturday.</p>
          </div>
          <button className="ghost" onClick={onLogout}>
            Log out
          </button>
        </header>

        <h2>Assign Duty</h2>
        <form className="stack" onSubmit={submit}>
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>

          <label>
            Stylist
            <select
              value={selectedStylistId}
              onChange={(e) => setSelectedStylistId(e.target.value)}
              required
            >
              {stylists.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} ({member.role})
                </option>
              ))}
            </select>
          </label>

          <label>
            Duty checklist
            <select
              value={selectedChecklistId}
              onChange={(e) => setSelectedChecklistId(e.target.value)}
              required
            >
              {checklists.map((checklist) => (
                <option key={checklist.id} value={checklist.id}>
                  {checklist.name}
                </option>
              ))}
            </select>
          </label>

          <button disabled={isSaving}>{isSaving ? 'Assigning...' : 'Assign duty checklist'}</button>
        </form>

        {status && <p className="message">{status}</p>}
      </section>
    </main>
  )
}

function StylistPage({ session, onLogout }: { session: SessionUser; onLogout: () => void }) {
  return (
    <main className="container">
      <section className="card">
        <header className="header">
          <h1>Stylist dashboard</h1>
          <button className="ghost" onClick={onLogout}>
            Log out
          </button>
        </header>
        <StylistToday stylistId={session.id} stylistName={session.full_name} />
      </section>
    </main>
  )
}

export default App
