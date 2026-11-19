import { Link } from 'react-router-dom';

const steps = [
  { number: '01', title: 'Plan', description: 'Define farm boundaries and prepare intelligent monitoring missions.', icon: '🗺️' },
  { number: '02', title: 'Fly', description: 'Capture field imagery using compatible drone technology.', icon: '🚁' },
  { number: '03', title: 'Scan', description: 'Combine field observations with satellite vegetation insights.', icon: '🛰️' },
  { number: '04', title: 'Diagnose', description: 'Use AI-assisted image analysis to identify possible crop concerns.', icon: '🔬' },
  { number: '05', title: 'Act', description: 'Make informed decisions with appropriate expert verification.', icon: '🌱' },
];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7f0] text-[#153b2a]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-3 text-xl font-black">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#174b35] text-white shadow-lg">D</span>
          DroneVerse
        </Link>

        <nav className="hidden gap-8 text-sm font-semibold md:flex">
          <a href="#how-it-works" className="hover:text-green-700">How it works</a>
          <a href="#technology" className="hover:text-green-700">Technology</a>
          <a href="#about" className="hover:text-green-700">About</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden px-4 py-2 text-sm font-semibold sm:block">Sign in</Link>
          <Link to="/login" className="rounded-full bg-[#174b35] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-1 hover:bg-green-800">
            Get started ↗
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-12 lg:grid-cols-2 lg:pt-20">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-green-900/10 bg-white px-4 py-2 text-xs font-bold tracking-wider text-green-800 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            SMART AGRICULTURE • AI • DRONE TECHNOLOGY
          </div>

          <h1 className="max-w-2xl text-5xl font-black leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            See more.
            <span className="block text-[#79a64e]">Detect earlier.</span>
            Grow smarter.
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-[#607267]">
            Get a new perspective on your farm. Connect drone-ready workflows,
            satellite intelligence and AI-assisted crop analysis in one platform.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link to="/login" className="rounded-full bg-[#174b35] px-7 py-4 font-bold text-white shadow-xl transition hover:-translate-y-1 hover:bg-green-800">
              Explore DroneVerse ↗
            </Link>
            <a href="#how-it-works" className="rounded-full border border-green-900/20 bg-white px-7 py-4 font-bold transition hover:bg-green-50">
              Discover how it works
            </a>
          </div>

          <div className="mt-12 grid max-w-lg grid-cols-3 gap-5 border-t border-green-900/10 pt-7">
            <div><p className="text-2xl font-black">AI</p><p className="mt-1 text-xs text-gray-500">Crop intelligence</p></div>
            <div><p className="text-2xl font-black">GIS</p><p className="mt-1 text-xs text-gray-500">Farm mapping</p></div>
            <div><p className="text-2xl font-black">UAV</p><p className="mt-1 text-xs text-gray-500">Drone-ready</p></div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-5 rounded-[3rem] bg-[#dce9cc] blur-3xl opacity-70" />

          <div className="relative overflow-hidden rounded-[2rem] shadow-2xl">
            <img
              src="/images/droneverse-hero.jpg"
              alt="Aerial agricultural landscape"
              className="h-[460px] w-full object-cover sm:h-[570px]"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#102d20]/80 via-transparent to-[#102d20]/10" />

            <div className="absolute left-5 top-5 rounded-full border border-white/30 bg-black/25 px-4 py-2 text-xs font-semibold text-white backdrop-blur-lg">
              ● FIELD INTELLIGENCE
            </div>

            <div className="absolute bottom-8 left-7 right-7 text-white">
              <p className="text-xs font-bold tracking-[0.2em] text-lime-200">INTELLIGENCE FROM ABOVE</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Every field tells a story.</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
                Monitor your fields. Spot changes. Turn observations into meaningful insights.
              </p>
            </div>
          </div>

          <div className="absolute -bottom-6 left-3 rounded-2xl border border-white bg-white p-4 shadow-xl sm:-left-8 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-green-50 text-2xl">🌿</span>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-gray-500">FIELD INTELLIGENCE</p>
                <p className="mt-1 text-sm font-black text-[#174b35]">Monitor. Understand. Improve.</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">Satellite + AI-assisted analysis</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold tracking-[0.2em] text-[#79a64e]">THE PROCESS</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">From the sky to smarter decisions.</h2>
            <p className="mt-5 leading-7 text-gray-500">A connected workflow designed to help you observe, understand and manage crop health.</p>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => (
              <article key={step.number} className="rounded-3xl border border-green-900/10 bg-[#f8faf5] p-6 transition hover:-translate-y-2 hover:shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-[#79a64e]">{step.number}</span>
                  <span className="text-3xl">{step.icon}</span>
                </div>
                <h3 className="mt-8 text-xl font-black">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-500">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="technology" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.2em] text-[#79a64e]">OUR TECHNOLOGY</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Agricultural intelligence, connected.</h2>
            <p className="mt-5 leading-7 text-[#607267]">Different technologies work together to provide a clearer picture of crop and field conditions.</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <article className="rounded-3xl bg-[#174b35] p-8 text-white">
              <span className="text-4xl">🧠</span>
              <h3 className="mt-7 text-2xl font-black">AI crop analysis</h3>
              <p className="mt-4 leading-7 text-white/75">AI-assisted analysis of uploaded crop images to highlight possible disease symptoms and crop-health concerns for further verification.</p>
            </article>
            <article className="rounded-3xl bg-[#e9efdf] p-8">
              <span className="text-4xl">🛰️</span>
              <h3 className="mt-7 text-2xl font-black">Satellite intelligence</h3>
              <p className="mt-4 leading-7 text-[#607267]">Explore vegetation indices and historical field observations to understand changing crop conditions.</p>
            </article>
            <article className="rounded-3xl bg-[#e9efdf] p-8">
              <span className="text-4xl">🚁</span>
              <h3 className="mt-7 text-2xl font-black">Drone-ready mapping</h3>
              <p className="mt-4 leading-7 text-[#607267]">Organise farm boundaries, plan missions and prepare for compatible drone-image collection and future hardware integration.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="about" className="bg-[#123b2b] px-6 py-24 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.2em] text-[#b5d68e]">THE FUTURE OF FARMING</p>
            <h2 className="mt-4 text-4xl font-black sm:text-5xl">Make every observation count.</h2>
            <p className="mt-5 leading-7 text-white/70">Start building a clearer picture of your farm with DroneVerse. AI insights are decision-support tools, not a replacement for agricultural experts.</p>
          </div>
          <Link to="/login" className="shrink-0 rounded-full bg-[#b5d68e] px-8 py-4 font-black text-[#173b2a] transition hover:-translate-y-1 hover:bg-white">Get started today ↗</Link>
        </div>
      </section>

      <footer className="bg-[#0b2b1e] px-6 py-8 text-sm text-white/60">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row">
          <p className="font-black text-white">DroneVerse</p>
          <p>Smarter field intelligence. Better-informed decisions.</p>
          <p>© {new Date().getFullYear()} DroneVerse</p>
        </div>
      </footer>
    </main>
  );
}




