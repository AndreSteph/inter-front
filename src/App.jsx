import MerchantList from './components/MerchantList'

const navSections = [
  {
    title: '',
    items: [{ label: 'Overview', active: true }],
  },
  {
    title: 'MERCHANTS',
    items: [
      { label: 'All Merchants' },
      { label: 'Stuck Merchants' },
      { label: 'Recently Activated' },
    ],
  },
  {
    title: 'WORKFLOW',
    items: [{ label: 'Onboarding Steps' }, { label: 'Analytics' }],
  },
  {
    title: 'SETTINGS',
    items: [{ label: 'Configuration' }, { label: 'Users' }, { label: 'Audit Logs' }],
  },
]

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

function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col">
          <div className="flex h-[76px] items-center gap-3 border-b border-slate-200 px-6">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white">
              <Icon path="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            </div>
            <div className="text-xl font-extrabold tracking-tight text-slate-900">Activation Tracker</div>
          </div>

          <nav className="flex-1 space-y-7 px-5 py-6">
            {navSections.map((section) => (
              <div key={section.title || 'overview'} className="space-y-2">
                {section.title && (
                  <p className="px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </p>
                )}
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[17px] font-medium transition-colors ${
                      item.active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon path="M5 12h14M12 5v14" className="h-4 w-4 opacity-75" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="m-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-base font-bold text-slate-800">Need help?</p>
            <p className="mt-2 text-sm text-slate-500">Check docs or contact support.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"
              >
                <Icon path="M4 7h16M4 12h10M4 17h16" className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
              >
                <Icon path="M15 17h5l-1.5-2a2 2 0 0 1-.5-1.3V10a6 6 0 1 0-12 0v3.7a2 2 0 0 1-.5 1.3L4 17h5m6 0a3 3 0 1 1-6 0" />
              </button>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500">
                  <Icon path="M16 19a4 4 0 0 0-8 0m8-10a4 4 0 1 1-8 0a4 4 0 0 1 8 0Z" />
                </div>
                <span className="hidden text-sm font-semibold text-slate-700 sm:block">Admin User</span>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-7">
            <MerchantList />
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
