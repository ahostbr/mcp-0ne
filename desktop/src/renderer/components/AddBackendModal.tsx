import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { useBackendStore } from '@/stores/backend-store'
import type { BackendType } from '@/types/backend'

interface AddBackendModalProps {
  open: boolean
  onClose: () => void
}

export function AddBackendModal({ open, onClose }: AddBackendModalProps) {
  const addBackend = useBackendStore((s) => s.addBackend)

  const [id, setId] = useState('')
  const [type, setType] = useState<BackendType>('http')
  const [prefix, setPrefix] = useState('')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(true)

  // HTTP fields
  const [url, setUrl] = useState('')
  const [healthUrl, setHealthUrl] = useState('')

  // Stdio fields
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [env, setEnv] = useState('')

  // Shared
  const [timeout, setTimeout_] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset all fields when modal opens
  useEffect(() => {
    if (open) reset()
  }, [open])

  const reset = () => {
    setId('')
    setType('http')
    setPrefix('')
    setDescription('')
    setEnabled(true)
    setUrl('')
    setHealthUrl('')
    setCommand('')
    setArgs('')
    setEnv('')
    setTimeout_('')
    setSubmitting(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !prefix.trim()) return

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        type,
        prefix: prefix.trim(),
        description: description.trim() || undefined,
        enabled,
        timeout: timeout ? Number(timeout) : undefined
      }

      if (type === 'http') {
        payload.url = url.trim()
        payload.health_url = healthUrl.trim() || undefined
      } else {
        payload.command = command.trim()
        payload.args = args.trim() ? args.split(/\s+/) : undefined
        if (env.trim()) {
          const envObj: Record<string, string> = {}
          for (const line of env.split('\n')) {
            const eq = line.indexOf('=')
            if (eq > 0) envObj[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
          }
          payload.env = envObj
        }
      }

      await addBackend(id.trim(), payload as never)
      reset()
      onClose()
    } catch {
      // Toast handled by store
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">Add Backend</h2>
          <button className="text-muted-foreground hover:text-foreground cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="ID" id="id" value={id} onChange={(e) => setId(e.target.value)} placeholder="my-backend" required />
            <Select
              label="Type"
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as BackendType)}
              options={[
                { value: 'http', label: 'HTTP' },
                { value: 'stdio', label: 'Stdio' }
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Prefix" id="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="mytools" required />
            <Input label="Timeout (s)" id="timeout" type="number" value={timeout} onChange={(e) => setTimeout_(e.target.value)} placeholder="30" />
          </div>

          <Input label="Description" id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />

          {/* Type-specific fields */}
          {type === 'http' ? (
            <>
              <Input label="URL" id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3000/mcp" required />
              <Input label="Health URL (optional)" id="health_url" value={healthUrl} onChange={(e) => setHealthUrl(e.target.value)} placeholder="http://localhost:3000/health" />
            </>
          ) : (
            <>
              <Input label="Command" id="command" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx -y @my/mcp-server" required />
              <Input label="Args (space separated)" id="args" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="--port 3000" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="env" className="text-xs text-muted-foreground">Environment (KEY=VALUE per line)</label>
                <textarea
                  id="env"
                  className="h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  value={env}
                  onChange={(e) => setEnv(e.target.value)}
                  placeholder={"API_KEY=abc123\nDEBUG=true"}
                />
              </div>
            </>
          )}

          {/* Enabled checkbox */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Connect immediately
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Backend'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
