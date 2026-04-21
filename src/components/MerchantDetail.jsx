import React, { useEffect, useMemo, useState } from 'react'
import { addMerchantNote, completeMerchantStep, getMerchantNotes, getMerchantSteps, getNextStep } from '../api'

const fallbackSteps = [
  { stepId: 1, name: 'Business Info', status: 'COMPLETED' },
  { stepId: 2, name: 'Payment Setup', status: 'COMPLETED' },
  { stepId: 3, name: 'First Transaction', status: 'PENDING' },
]

const stepNames = {
  1: 'Business Info',
  2: 'Payment Setup',
  3: 'First Transaction',
  4: 'Staff Setup',
}

function Icon({ path, className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

function formatDate(value) {
  if (!value) return 'May 20, 2024'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusClass(status) {
  if (status === 'ACTIVATED') return 'bg-emerald-100 text-emerald-700'
  if (status === 'STUCK') return 'bg-rose-100 text-rose-700'
  return 'bg-amber-100 text-amber-700'
}

function normalizeSteps(payload) {
  if (!Array.isArray(payload) || payload.length === 0) return fallbackSteps
  return payload.map((step) => ({
    ...step,
    name: step.name || step.stepName || stepNames[step.stepId] || `Step ${step.stepId || ''}`.trim(),
  }))
}

function normalizeNotes(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (payload && typeof payload === 'object') return [payload]
  return []
}

function formatNoteTime(value) {
  if (!value) return 'Unknown time'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function MerchantDetail({ merchant, onMerchantUpdated }) {
  const [steps, setSteps] = useState([])
  const [nextStepFromApi, setNextStepFromApi] = useState(null)
  const [notes, setNotes] = useState([])
  const [tab, setTab] = useState('Overview')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState('CONTACTED')

  useEffect(() => {
    if (!merchant?.id) return

    let active = true

    Promise.allSettled([getMerchantSteps(merchant.id), getNextStep(merchant.id), getMerchantNotes(merchant.id)]).then((results) => {
      if (!active) return

      const [stepsResult, nextStepResult, notesResult] = results

      if (stepsResult.status === 'fulfilled') {
        setSteps(normalizeSteps(stepsResult.value))
      } else {
        setSteps(fallbackSteps)
      }

      if (nextStepResult.status === 'fulfilled') {
        setNextStepFromApi(nextStepResult.value || null)
      } else {
        setNextStepFromApi(null)
      }

      if (notesResult.status === 'fulfilled') {
        setNotes(normalizeNotes(notesResult.value))
      } else {
        setNotes([])
      }
    })

    return () => {
      active = false
    }
  }, [merchant?.id])

  const timeline = steps.length > 0 ? steps : fallbackSteps

  const { completed, total, nextStep, percent } = useMemo(() => {
    const completedSteps = timeline.filter((step) => step.status === 'COMPLETED').length
    const totalSteps = Math.max(timeline.length, 1)
    const nextFromTimeline = timeline.find((step) => step.status !== 'COMPLETED')
    const resolvedNextStep = nextStepFromApi || nextFromTimeline || null

    return {
      completed: completedSteps,
      total: totalSteps,
      nextStep: resolvedNextStep,
      percent: Math.round((completedSteps / totalSteps) * 100),
    }
  }, [timeline, nextStepFromApi])

  const refreshDetail = async () => {
    if (!merchant?.id) return

    const [stepsPayload, nextPayload, notesPayload] = await Promise.all([
      getMerchantSteps(merchant.id).catch(() => fallbackSteps),
      getNextStep(merchant.id).catch(() => null),
      getMerchantNotes(merchant.id).catch(() => []),
    ])

    setSteps(normalizeSteps(stepsPayload))
    setNextStepFromApi(nextPayload || null)
    setNotes(normalizeNotes(notesPayload))
  }

  const handleCompleteNextStep = async () => {
    if (!merchant?.id || !nextStep) return

    const stepId =
      (typeof nextStep === 'object' && nextStep ? nextStep.stepId ?? nextStep.id : null) ??
      timeline.find((step) => step.status !== 'COMPLETED')?.stepId
    if (!stepId) return

    try {
      setActionMessage('')
      setActionError('')
      setIsCompleting(true)
      await completeMerchantStep(merchant.id, stepId)
      await refreshDetail()
      if (onMerchantUpdated) {
        await onMerchantUpdated()
      }
      setActionMessage('Step marked as complete.')
    } catch {
      setActionError('Could not complete step. Please try again.')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleAddNote = async (event) => {
    event.preventDefault()
    if (!merchant?.id || !noteText.trim()) return

    try {
      setActionMessage('')
      setActionError('')
      setIsSavingNote(true)
      await addMerchantNote(merchant.id, {
        note: noteText.trim(),
        type: noteType.trim() || 'CONTACTED',
      })
      setNoteText('')
      const notesPayload = await getMerchantNotes(merchant.id)
      setNotes(normalizeNotes(notesPayload))
      setActionMessage('Note added successfully.')
    } catch {
      setActionError('Could not add note. Please try again.')
    } finally {
      setIsSavingNote(false)
    }
  }

  if (!merchant) {
    return (
      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-medium text-slate-500 shadow-sm">
          Select a merchant to view details.
        </div>
      </aside>
    )
  }

  const showOverview = tab === 'Overview'
  const showSteps = tab === 'Steps'
  const showActivity = tab === 'Activity'
  const showNotes = tab === 'Notes'

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">{merchant.name || 'Unnamed merchant'}</h3>
            <span
              className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusClass(
                merchant.status,
              )}`}
            >
              {(merchant.status || 'IN_PROGRESS').replaceAll('_', ' ')}
            </span>
          </div>
          <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <Icon path="M6 6l12 12M18 6 6 18" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex border-b border-slate-200 px-4">
          {['Overview', 'Steps', 'Activity', 'Notes'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`border-b-2 px-2 py-3 text-sm font-semibold transition-colors ${
                tab === item ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {actionError && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 shadow-sm">
          {actionError}
        </section>
      )}

      {actionMessage && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 shadow-sm">
          {actionMessage}
        </section>
      )}

      {(showOverview || showSteps) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-2xl font-extrabold tracking-tight text-slate-900">Progress</h4>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">
            {completed} / {total}{' '}
            <span className="text-base font-semibold text-slate-500">Steps Completed</span>
          </p>
          <div className="mt-3 h-2.5 rounded-full bg-slate-200">
            <div className="h-2.5 rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-right text-3xl font-extrabold text-emerald-600">{percent}%</p>
        </section>
      )}

      {(showOverview || showSteps) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-2xl font-extrabold tracking-tight text-slate-900">Next Step</h4>
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-50 p-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <Icon path="m9 12 2 2 4-4M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">
                {(typeof nextStep === 'string' ? nextStep : nextStep?.name) || 'All steps complete'}
              </p>
              <p className="text-sm text-slate-500">Complete this step to advance activation progress.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleCompleteNextStep()}
            disabled={!nextStep || isCompleting}
            className="mt-4 h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCompleting ? 'Completing...' : 'Mark as Complete'}
          </button>
        </section>
      )}

      {showOverview && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-2xl font-extrabold tracking-tight text-slate-900">Onboarding Steps</h4>
          <div className="mt-4 space-y-3">
            {timeline.map((step, index) => {
              const completedStep = step.status === 'COMPLETED'
              const pendingStep = !completedStep && index === completed
              return (
                <div key={step.stepId || step.name} className="flex gap-3">
                  <div className="relative mt-1 flex w-7 justify-center">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full border-2 ${
                        completedStep
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : pendingStep
                            ? 'border-amber-500 bg-white text-amber-500'
                            : 'border-slate-300 bg-white text-slate-300'
                      }`}
                    >
                      {completedStep ? <Icon path="m7 12 3 3 7-7" className="h-3.5 w-3.5" /> : ''}
                    </span>
                    {index < timeline.length - 1 && <span className="absolute top-8 h-8 w-px bg-slate-200" />}
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800">{step.name}</p>
                    <p className="text-sm text-slate-500">{completedStep ? 'Completed' : 'Pending'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {(showOverview || showActivity) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-2xl font-extrabold tracking-tight text-slate-900">Merchant Details</h4>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="font-semibold text-slate-500">Merchant ID</dt>
              <dd className="font-bold text-slate-800">{merchant.id || '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="font-semibold text-slate-500">Joined On</dt>
              <dd className="font-bold text-slate-800">{formatDate(merchant.createdAt || merchant.joinedOn)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="font-semibold text-slate-500">Last Updated</dt>
              <dd className="font-bold text-slate-800">{formatDate(merchant.updatedAt || merchant.lastUpdatedAt || merchant.lastUpdated)}</dd>
            </div>
          </dl>
        </section>
      )}

      {(showOverview || showNotes) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-2xl font-extrabold tracking-tight text-slate-900">Notes</h4>
          <form onSubmit={handleAddNote} className="mt-4 space-y-3">
            <input
              value={noteType}
              onChange={(event) => setNoteType(event.target.value)}
              placeholder="Type (e.g. CONTACTED)"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
            />
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Add intervention note..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={isSavingNote || !noteText.trim()}
              className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingNote ? 'Saving...' : 'Add Note'}
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {notes.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
            {notes.map((note, index) => (
              <article key={note.id || `${note.type || 'NOTE'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{note.type || 'NOTE'}</span>
                  <span className="text-xs font-medium text-slate-500">{formatNoteTime(note.createdAt || note.timestamp)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{note.note || note.message || '-'}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
