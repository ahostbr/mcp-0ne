import { useEffect, useState } from 'react'
import { HeaderBar } from './components/HeaderBar'
import { BackendGrid } from './components/BackendGrid'
import { StatsPanel } from './components/StatsPanel'
import { AddBackendModal } from './components/AddBackendModal'
import { ImportMcpJsonModal } from './components/ImportMcpJsonModal'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ToastContainer } from './components/ToastContainer'
import { useBackendStore } from './stores/backend-store'

export default function App() {
  const { startPolling, stopPolling, removeBackend, theme } = useBackendStore()

  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [startPolling, stopPolling])

  return (
    <div className={`flex h-screen flex-col bg-background relative theme-${theme}`}>
      {/* Scanning line overlay */}
      <div className="scanning-line"></div>

      <HeaderBar onAdd={() => setShowAdd(true)} onImport={() => setShowImport(true)} />
      <StatsPanel />
      <BackendGrid onAdd={() => setShowAdd(true)} onRemove={(id) => setConfirmRemove(id)} />

      <AddBackendModal open={showAdd} onClose={() => setShowAdd(false)} />
      <ImportMcpJsonModal open={showImport} onClose={() => setShowImport(false)} />

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove Backend"
        message={`Are you sure you want to remove "${confirmRemove}"? This will disconnect and delete it.`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemove) removeBackend(confirmRemove)
          setConfirmRemove(null)
        }}
        onCancel={() => setConfirmRemove(null)}
      />

      <ToastContainer />
    </div>
  )
}
