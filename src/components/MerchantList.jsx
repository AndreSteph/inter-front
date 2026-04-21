import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createMerchant, getMerchantSteps, getMerchants, getNextStep } from '../api'
import MerchantDetail from './MerchantDetail'

const PAGE_SIZE = 5
const FALLBACK_STEPS = ['Business Info', 'Payment Setup', 'First Transaction']
const FALLBACK_UPDATED = ['2h ago', '3d ago', '1h ago', '5h ago', '1d ago']

const statusStyles = {
  ACTIVATED: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  STUCK: 'bg-rose-100 text-rose-700',
  NOT_STARTED: 'bg-slate-200 text-slate-600',
}

const statusLabel = {
  ACTIVATED: 'Activated',
  IN_PROGRESS: 'In Progress',
  STUCK: 'Stuck',
  NOT_STARTED: 'Not Started',
}

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

function getStepStats(merchant, steps) {
  if (Array.isArray(steps) && steps.length > 0) {
    const total = steps.length
    const completed = steps.filter((item) => item.status === 'COMPLETED').length
    return {
      completed,
      total,
      percent: Math.round((completed / Math.max(total, 1)) * 100),
    }
  }

  const totalSteps = merchant.totalSteps ?? merchant.stepsTotal ?? 3
  const completedSteps =
    merchant.completedSteps ??
    merchant.stepsCompleted ??
    (merchant.status === 'ACTIVATED' ? totalSteps : merchant.status === 'IN_PROGRESS' ? 2 : merchant.status === 'STUCK' ? 1 : 0)

  const safeTotal = Math.max(totalSteps, 1)
  const safeCompleted = Math.max(0, Math.min(completedSteps, safeTotal))

  return {
    completed: safeCompleted,
    total: safeTotal,
    percent: Math.round((safeCompleted / safeTotal) * 100),
  }
}

function formatStatus(status) {
  return statusLabel[status] || status?.replaceAll('_', ' ') || 'Unknown'
}

function formatLastUpdated(value, index) {
  if (!value) {
    return FALLBACK_UPDATED[index % FALLBACK_UPDATED.length]
  }

  if (typeof value === 'string' && value.toLowerCase().includes('ago')) {
    return value
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value)
  }

  const now = Date.now()
  const hours = Math.max(1, Math.floor((now - parsed.getTime()) / (1000 * 60 * 60)))

  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function progressBarTone(status) {
  switch (status) {
    case 'ACTIVATED':
      return 'bg-emerald-500'
    case 'STUCK':
      return 'bg-rose-500'
    default:
      return 'bg-amber-500'
  }
}

export default function MerchantList() {
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalMerchants, setTotalMerchants] = useState(0)
  const [status, setStatus] = useState('')
  const [name, setName] = useState('')
  const [selectedMerchantId, setSelectedMerchantId] = useState(null)
  const [merchantMeta, setMerchantMeta] = useState({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = { page, size: PAGE_SIZE }
      if (status) params.status = status
      if (name.trim()) params.name = name.trim()

      const payload = await getMerchants(params)

      const list = Array.isArray(payload) ? payload : payload?.content || []
      const pages = Array.isArray(payload) ? 1 : Math.max(payload?.totalPages || 1, 1)
      const total = Array.isArray(payload) ? list.length : payload?.totalElements ?? list.length

      setMerchants(list)
      setTotalPages(pages)
      setTotalMerchants(total)
      setSelectedMerchantId((current) => (current && list.some((item) => item.id === current) ? current : list[0]?.id || null))
    } catch {
      setError('Could not load merchants. Check if your backend is running on port 8080.')
      setMerchants([])
      setTotalPages(1)
      setTotalMerchants(0)
      setSelectedMerchantId(null)
    } finally {
      setLoading(false)
    }
  }, [name, page, status])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchData])

  useEffect(() => {
    if (merchants.length === 0) return

    let active = true

    Promise.allSettled(
      merchants.map(async (merchant) => {
        const [stepsPayload, nextStepPayload] = await Promise.all([
          getMerchantSteps(merchant.id).catch(() => []),
          getNextStep(merchant.id).catch(() => null),
        ])

        const steps = Array.isArray(stepsPayload) ? stepsPayload : []
        const nextStepName =
          (typeof nextStepPayload === 'string' ? nextStepPayload : nextStepPayload?.name) ||
          stepNames[steps.find((step) => step.status !== 'COMPLETED')?.stepId] ||
          null

        return [merchant.id, { steps, nextStepName }]
      }),
    ).then((results) => {
      if (!active) return
      const nextMeta = {}
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [id, payload] = result.value
          nextMeta[id] = payload
        }
      })
      setMerchantMeta(nextMeta)
    })

    return () => {
      active = false
    }
  }, [merchants])

  const overview = useMemo(() => {
    const counts = merchants.reduce(
      (acc, merchant) => {
        const key = merchant.status || 'NOT_STARTED'
        if (acc[key] === undefined) acc[key] = 0
        acc[key] += 1
        return acc
      },
      { ACTIVATED: 0, IN_PROGRESS: 0, STUCK: 0, NOT_STARTED: 0 },
    )

    return [
      {
        label: 'Total Merchants',
        value: totalMerchants || merchants.length,
        color: 'bg-blue-500',
        icon: 'M3 10.5L12 3l9 7.5M5 9.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5',
      },
      {
        label: 'Activated',
        value: counts.ACTIVATED,
        color: 'bg-emerald-500',
        icon: 'm9 12 2 2 4-4M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z',
      },
      {
        label: 'In Progress',
        value: counts.IN_PROGRESS,
        color: 'bg-amber-500',
        icon: 'M12 7v5l3 3M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z',
      },
      {
        label: 'Stuck',
        value: counts.STUCK,
        color: 'bg-rose-500',
        icon: 'M12 9v4m0 4h.01M10.5 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.5 3.8a2 2 0 0 0-3 0Z',
      },
    ]
  }, [merchants, totalMerchants])

  const selectedMerchant = merchants.find((merchant) => merchant.id === selectedMerchantId) || merchants[0] || null

  const handleCreateMerchant = async () => {
    const merchantName = window.prompt('Enter merchant name')
    if (!merchantName || !merchantName.trim()) return

    try {
      await createMerchant(merchantName.trim())
      if (page === 0) {
        await fetchData()
      } else {
        setPage(0)
      }
    } catch {
      setError('Could not create merchant. Please try again.')
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overview.map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`grid h-14 w-14 place-items-center rounded-2xl text-white ${item.color}`}>
                  <Icon path={item.icon} className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-4xl font-extrabold leading-none text-slate-900">{item.value}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{item.label}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Merchants</h2>
            <button
              type="button"
              onClick={() => void handleCreateMerchant()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Icon path="M12 5v14M5 12h14" />
              Add Merchant
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_170px]">
              <label className="relative block">
                <span className="sr-only">Search merchant by name</span>
                <input
                  placeholder="Search merchant name..."
                  value={name}
                  onChange={(event) => {
                    setPage(0)
                    setName(event.target.value)
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon path="m21 21-4.3-4.3m1.3-5.4a6.7 6.7 0 1 1-13.4 0a6.7 6.7 0 0 1 13.4 0Z" className="h-4 w-4" />
                </span>
              </label>

              <select
                value={status}
                onChange={(event) => {
                  setPage(0)
                  setStatus(event.target.value)
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-blue-400"
              >
                <option value="">All Status</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="STUCK">Stuck</option>
                <option value="ACTIVATED">Activated</option>
              </select>

              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
              >
                <Icon path="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                Last 30 days
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Merchant Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Last Updated</th>
                    <th className="px-4 py-3">Next Step</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && merchants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
                        {error || 'No merchants found.'}
                      </td>
                    </tr>
                  )}

                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
                        Loading merchants...
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    merchants.map((merchant, index) => {
                      const meta = merchantMeta[merchant.id]
                      const stats = getStepStats(merchant, meta?.steps)
                      const nextStep =
                        meta?.nextStepName || merchant.nextStep || FALLBACK_STEPS[Math.min(stats.completed, FALLBACK_STEPS.length - 1)] || '-'
                      const isSelected = selectedMerchant?.id === merchant.id

                      return (
                        <tr
                          key={merchant.id}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                          onClick={() => setSelectedMerchantId(merchant.id)}
                        >
                          <td className="px-4 py-4">
                            <p className="text-base font-bold text-slate-800">{merchant.name || 'Unnamed merchant'}</p>
                            <p className="text-sm text-slate-400">ID: {merchant.id || '-'}</p>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusStyles[merchant.status] || 'bg-slate-100 text-slate-600'}`}
                            >
                              {formatStatus(merchant.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="mb-1 text-sm font-semibold text-slate-700">
                              {stats.completed} / {stats.total}
                            </p>
                            <div className="h-2 w-36 rounded-full bg-slate-200">
                              <div
                                className={`h-2 rounded-full ${progressBarTone(merchant.status)}`}
                                style={{ width: `${stats.percent}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-slate-500">
                            {formatLastUpdated(merchant.lastUpdated || merchant.lastUpdatedAt || merchant.updatedAt, index)}
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-slate-600">{nextStep}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2 text-slate-500">
                              <button
                                type="button"
                                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white transition-colors hover:bg-slate-100"
                              >
                                <Icon path="M1 12s4-7 11-7s11 7 11 7s-4 7-11 7s-11-7-11-7Zm11 3a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z" />
                              </button>
                              <button
                                type="button"
                                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white transition-colors hover:bg-slate-100"
                              >
                                <Icon path="M12 5.5v.01M12 12v.01M12 18.5v.01" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-500">
                Showing {merchants.length === 0 ? 0 : page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, totalMerchants || (page + 1) * PAGE_SIZE)} of{' '}
                {totalMerchants || merchants.length} merchants
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((prev) => prev - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">{page + 1}</span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <MerchantDetail key={selectedMerchant?.id || 'empty'} merchant={selectedMerchant} onMerchantUpdated={fetchData} />
    </div>
  )
}
