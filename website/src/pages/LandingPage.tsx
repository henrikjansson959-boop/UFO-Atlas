import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--sky)] text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float-slow absolute -left-16 top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(246,167,82,0.35),_transparent_70%)] blur-xl" />
        <div className="animate-float-medium absolute right-0 top-32 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(76,164,140,0.35),_transparent_70%)] blur-xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(31,103,122,0.2),_transparent_70%)] blur-xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-5 pb-16 pt-8 sm:px-8 lg:px-10">
        <header className="mb-14 flex items-center justify-between rounded-full border border-[var(--line)] bg-white/70 px-5 py-3 backdrop-blur">
          <p className="font-display text-lg tracking-wide">UFO Atlas</p>
          <div className="flex space-x-3">
            <Link
              to="/admin"
              className="rounded-full border border-[var(--line)] bg-[var(--fog)] px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white"
            >
              Admin
            </Link>
            <button className="rounded-full border border-[var(--line)] bg-[var(--fog)] px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white">
              Join Updates
            </button>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-[var(--line)] bg-white/75 px-4 py-1 text-sm font-medium text-[var(--teal-700)]">
              New Exploration Web Experience
            </p>
            <h1 className="font-display text-5xl leading-tight sm:text-6xl">
              Discover strange sightings with style, speed, and story.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[var(--ink-soft)]">
              UFO Atlas tracks reports, patterns, and places in one cinematic dashboard built for curious minds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-full bg-[var(--teal-700)] px-6 py-3 text-sm font-semibold text-[var(--sand)] transition hover:-translate-y-0.5 hover:bg-[var(--teal-800)]">
                Launch Beta
              </button>
              <button className="rounded-full border border-[var(--line)] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white">
                View Roadmap
              </button>
            </div>
          </div>

          <div className="relative rounded-[28px] border border-[var(--line)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.85),_rgba(235,244,248,0.8))] p-6 shadow-[0_25px_70px_rgba(22,43,56,0.12)]">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--teal-600)]">
              Live Signals
            </p>
            <ul className="space-y-4">
              {[
                ['North Coast', '14 sightings this week'],
                ['Mountain Corridor', '9 unusual trajectories'],
                ['Open Ocean', '5 cross-radar anomalies'],
              ].map(([zone, note], index) => (
                <li
                  className="animate-rise rounded-2xl border border-[var(--line)] bg-white/70 p-4"
                  style={{ animationDelay: `${index * 110}ms` }}
                  key={zone}
                >
                  <p className="font-semibold">{zone}</p>
                  <p className="text-sm text-[var(--ink-soft)]">{note}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Smart Timeline',
              text: 'Filter reports by shape, speed, time, and confidence in one flowing interface.',
            },
            {
              title: 'Map Intelligence',
              text: 'Heat zones reveal when and where activity spikes without clutter or noise.',
            },
            {
              title: 'Case Profiles',
              text: 'Each case combines witness notes, media, and metadata for fast comparisons.',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-[var(--line)] bg-white/80 p-6 backdrop-blur transition hover:-translate-y-1"
            >
              <h2 className="font-display text-2xl">{item.title}</h2>
              <p className="mt-2 text-[var(--ink-soft)]">{item.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
