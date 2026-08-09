import storage from 'store'
import { ACCESS_TOKEN } from '@/store/mutation-types'

function tokenValue () {
  const stored = storage.get(ACCESS_TOKEN)
  if (typeof stored === 'string') return stored
  return stored && (stored.token || stored.value) ? (stored.token || stored.value) : ''
}

function terminal (status) {
  return ['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(String(status || '').toUpperCase())
}

export async function watchResearchTask (taskId, onUpdate, timeout = 3600000) {
  const deadline = Date.now() + timeout
  let latest = null
  while (Date.now() < deadline) {
    const controller = new AbortController()
    const remaining = Math.max(1000, deadline - Date.now())
    const timer = setTimeout(() => controller.abort(), Math.min(65000, remaining))
    try {
      const response = await fetch(`/api/v2/tasks/${encodeURIComponent(taskId)}/events`, {
        headers: { Authorization: `Bearer ${tokenValue()}`, Accept: 'text/event-stream' },
        credentials: 'same-origin',
        signal: controller.signal
      })
      if (!response.ok || !response.body) throw new Error(`Task stream HTTP ${response.status}`)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (Date.now() < deadline) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''
        for (const frame of frames) {
          const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
          if (!data) continue
          const payload = JSON.parse(data)
          if (frame.includes('event: error')) throw new Error(payload.message || 'Task stream failed')
          latest = payload
          if (onUpdate) onUpdate(payload)
          if (terminal(payload.status)) return payload
        }
      }
    } finally {
      clearTimeout(timer)
    }
    if (latest && terminal(latest.status)) return latest
  }
  throw new Error('Task stream timed out')
}

export { terminal as isTerminalResearchTask }
