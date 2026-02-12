import { useEffect, useMemo, useState } from 'react'
import { getTodayTasksForStylist, setTaskCompletion } from './lib/api'
import type { StylistTask } from './lib/api'

export function StylistToday({
  stylistId,
  stylistName,
}: {
  stylistId: string
  stylistName?: string
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [assignmentId, setAssignmentId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<StylistTask[]>([])
  const [pendingIds, setPendingIds] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setMessage('')
      try {
        const result = await getTodayTasksForStylist({ stylist_id: stylistId })
        if (cancelled) return
        setAssignmentId(result.assignment_id)
        setTasks(result.tasks)
      } catch (error) {
        if (cancelled) return
        setMessage((error as Error).message || 'Failed to load your tasks')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [stylistId])

  const grouped = useMemo(() => {
    const byChecklist: Record<string, Record<string, StylistTask[]>> = {}
    for (const task of tasks) {
      if (!byChecklist[task.checklist_name]) {
        byChecklist[task.checklist_name] = {}
      }
      if (!byChecklist[task.checklist_name][task.section]) {
        byChecklist[task.checklist_name][task.section] = []
      }
      byChecklist[task.checklist_name][task.section].push(task)
    }
    return byChecklist
  }, [tasks])

  const toggleTask = async (completionId: number, completed: boolean) => {
    const priorTasks = tasks
    const nextCompletedAt = completed ? new Date().toISOString() : null

    setMessage('')
    setPendingIds((prev) => ({ ...prev, [completionId]: true }))
    setTasks((prev) =>
      prev.map((task) =>
        task.completion_id === completionId ? { ...task, completed_at: nextCompletedAt } : task,
      ),
    )

    try {
      await setTaskCompletion({ completion_id: completionId, completed })
    } catch (error) {
      setTasks(priorTasks)
      setMessage((error as Error).message || 'Failed to save task status')
    } finally {
      setPendingIds((prev) => {
        const next = { ...prev }
        delete next[completionId]
        return next
      })
    }
  }

  if (isLoading) {
    return <p className="muted">Loading today&apos;s tasks...</p>
  }

  if (message && !assignmentId) {
    return <p className="message">{message}</p>
  }

  if (!assignmentId) {
    return <p>No assignment yet.</p>
  }

  if (tasks.length === 0) {
    return <p className="muted">No checklist tasks found for today.</p>
  }

  return (
    <div className="stack">
      <p className="muted">{stylistName ? `${stylistName},` : ''} tap each task when complete.</p>

      {Object.entries(grouped).map(([checklistName, sections]) => (
        <section key={checklistName} className="task-group">
          <h2>{checklistName}</h2>

          {Object.entries(sections).map(([sectionName, sectionTasks]) => (
            <div key={`${checklistName}-${sectionName}`} className="task-section">
              <h3>{sectionName}</h3>
              <div className="task-list">
                {sectionTasks.map((task) => {
                  const checked = Boolean(task.completed_at)
                  const pending = Boolean(pendingIds[task.completion_id])

                  return (
                    <label className={`task-row ${checked ? 'is-done' : ''}`} key={task.completion_id}>
                      <input
                        className="task-checkbox"
                        type="checkbox"
                        checked={checked}
                        disabled={pending}
                        onChange={(event) =>
                          toggleTask(task.completion_id, event.currentTarget.checked)
                        }
                      />
                      <span>{task.task_name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      ))}

      {message && <p className="message">{message}</p>}
    </div>
  )
}
