
import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Plan',
    description: 'Define your farm boundaries and prepare an intelligent monitoring mission.',
    icon: '🗺️',
  },
  {
    number: '02',
    title: 'Fly',
    description: 'Collect field imagery using compatible drone technology or sample imagery.',
    icon: '🚁',
  },
  {
    number: '03',
    title: 'Scan',
    description: 'Combine field observations with satellite-based vegetation insights.',
    icon: '🛰️',
  },
  {
    number: '04',
    title: 'Diagnose',
    description: 'Use AI-assisted image analysis to identify possible crop health concerns.',
    icon: '🔬',
  },
  {
    number: '05',
    title: 'Act',
    description: 'Turn insights into informed decisions with expert verification.',
    icon: '🌱',
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8f2] text-[#183b2b]">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#174b35] text-white">
            D
          </span>
          DroneVerse
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#how-it-works" className="hover:text-emerald-700">How it works</a>
          <a href="#technology" className="hover:text-emerald-700">Technology</a>
          <a href="#about" className="hover:text-emerald-700">About</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold sm:block">
            Sign in
          </Link>
          <Link
            to="/login"
            className="rounded-full bg-[#174b35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#236747]"
          >
            Get started <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-12 lg:grid-cols-2 lg:pb-32 lg:pt-20">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-emerald-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            SMARTER AGRICULTURE STARTS HERE
          </div>

          <h1 className="max-w-2xl text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            See more.
            <span className="block text-[#719b50]">Detect earlier.</span>
            Grow smarter.
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-[#607267]">
            DroneVerse brings together drone imagery, satellite intelligence and AI-assisted
            crop analysis to help farmers understand their fields and make more informed decisions.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              to="/login"
              className="rounded-full bg-[#174b35] px-7 py-4 font-semibold text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-1 hover:bg-[#236747]"
            >
              Explore DroneVerse →
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-[#174b35]/20 bg-white px-7 py-4 font-semibold transition hover:bg-emerald-50"
            >
              Discover how it works
            </a>
          </div>

          <div className="mt-12 flex flex-wrap gap-8 border-t border-emerald-900/10 pt-7">
            <div>
              <p className="text-2xl font-extrabold">AI</p>
              <p className="mt-1 text-xs text-[#718078]">Crop intelligence</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold">GIS</p>
              <p className="mt-1 text-xs text-[#718078]">Field mapping</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold">UAV</p>
              <p className="mt-1 text-xs text-[#718078]">Drone-ready workflows</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-[#dce8c9] blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] bg-[#dce8c9] shadow-2xl shadow-emerald-950/15">
            <img
              src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=85"
              alt="Aerial view of green agricultural fields"
              className="h-[420px] w-full object-cover sm:h-[540px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102d20]/75 via-transparent to-transparent" />
            <div className="absolute bottom-7 left-7 right-7 text-white">
              <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200">
                INTELLIGENCE FROM ABOVE
              </p>
              <h2 className="mt-2 text-3xl font-bold">Every field tells a story.</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/80">
                Understand what is happening across your farm, one insight at a time.
              </p>
            </div>
          </div>

          <div className="absolute -bottom-6 -left-5 rounded-2xl border border-white/70 bg-white p-4 shadow-xl sm:-left-10">
            <p className="text-xs font-medium text-gray-500">FIELD INTELLIGENCE</p>
            <p className="mt-1 text-lg font-bold text-[#174b35]">Monitor. Understand. Improve.</p>
            <p className="mt-1 text-xs text-gray-500">Satellite + AI-assisted analysis</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold tracking-[0.2em] text-[#719b50]">THE PROCESS</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              From the sky to smarter decisions.
            </h2>
            <p className="mt-5 leading-7 text-gray-500">
              A connected workflow designed to help you observe, understand and manage crop health.
            </p>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => (
              <article
                key={step.number}
                className="rounded-3xl border border-emerald-900/10 bg-[#f8faf5] p-6 transition hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#719b50]">{step.number}</span>
                  <span className="text-3xl">{step.icon}</span>
                </div>
                <h3 className="mt-8 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-500">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="technology" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.2em] text-[#719b50]">OUR TECHNOLOGY</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Agricultural intelligence, connected.
            </h2>
            <p className="mt-5 leading-7 text-[#607267]">
              Different technologies work together to provide a clearer picture of crop and field conditions.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <article className="rounded-3xl bg-[#174b35] p-8 text-white">
              <span className="text-4xl">🧠</span>
              <h3 className="mt-7 text-2xl font-bold">AI crop analysis</h3>
              <p className="mt-4 leading-7 text-white/75">
                AI-assisted analysis of uploaded crop images to highlight possible disease symptoms
                and crop-health concerns for further verification.
              </p>
            </article>

            <article className="rounded-3xl bg-[#e9efdf] p-8">
              <span className="text-4xl">🛰️</span>
              <h3 className="mt-7 text-2xl font-bold">Satellite intelligence</h3>
              <p className="mt-4 leading-7 text-[#607267]">
                Explore the potential of satellite vegetation indices and historical field
                observations to understand changing crop conditions.
              </p>
            </article>

            <article className="rounded-3xl bg-[#e9efdf] p-8">
              <span className="text-4xl">🚁</span>
              <h3 className="mt-7 text-2xl font-bold">Drone-ready mapping</h3>
              <p className="mt-4 leading-7 text-[#607267]">
                Organise farm boundaries, plan missions and prepare for compatible drone-image
                collection and future hardware integration.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="about" className="bg-[#123b2b] px-6 py-24 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.2em] text-[#a9ce80]">THE FUTURE OF FARMING</p>
            <h2 className="mt-4 text-4xl font-extrabold sm:text-5xl">
              Make every observation count.
            </h2>
            <p className="mt-5 leading-7 text-white/70">
              Start building a clearer picture of your farm with DroneVerse.
              AI insights are decision-support tools, not a replacement for agricultural experts.
            </p>
          </div>
          <Link
            to="/login"
            className="shrink-0 rounded-full bg-[#b5d68e] px-8 py-4 font-bold text-[#173b2a] transition hover:bg-white"
          >
            Get started today →
          </Link>
        </div>
      </section>

      <footer className="bg-[#0b2b1e] px-6 py-8 text-sm text-white/60">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row">
          <p className="font-bold text-white">DroneVerse</p>
          <p>Smarter field intelligence. Better-informed decisions.</p>
          <p>© {new Date().getFullYear()} DroneVerse</p>
        </div>
      </footer>
    </main>
  );
}
