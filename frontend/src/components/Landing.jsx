import { SignInButton } from "@clerk/clerk-react";
import ThemeToggle from "./ThemeToggle";

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface text-on-surface font-body overflow-x-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 node-bg -z-10 opacity-30" />
      <div className="aurora-orb w-[560px] h-[560px] bg-primary/[0.38] top-[-6%] right-[8%] animate-aurora-1" />
      <div className="aurora-orb w-[520px] h-[520px] bg-accent/[0.30] bottom-[-14%] left-[-8%] animate-aurora-2" />
      <div className="aurora-orb w-[420px] h-[420px] bg-info/[0.18] top-[30%] left-[30%] animate-aurora-3" />

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-surface/50 backdrop-blur-2xl flex justify-between items-center px-6 md:px-8 h-20 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tighter gradient-text-primary font-headline">TaskStaker</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <SignInButton mode="modal">
            <button className="btn-primary px-6 py-2.5 rounded-xl font-headline font-bold text-sm">
              Get Started
            </button>
          </SignInButton>
        </div>
        <div className="bg-gradient-to-r from-secondary-container/20 to-transparent h-[1px] w-full absolute bottom-0 left-0" />
      </nav>

      <main className="relative pt-20">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary-dim font-label text-xs uppercase tracking-[0.2em]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Live on Sepolia Testnet
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-headline font-bold tracking-tighter text-on-surface leading-[0.95]">
              Stake Your Goals.<br />
              <span className="gradient-text-aurora">
                Prove Your Progress.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-2xl text-on-surface-variant max-w-2xl mx-auto font-light leading-relaxed">
              Stake Sepolia test ETH on a goal. Submit proof, then ask someone you trust to review it. AI advises. Your validator decides.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <SignInButton mode="modal">
                <button className="btn-primary px-10 py-4 rounded-xl font-headline font-bold text-lg group flex items-center gap-2">
                  Start a Task
                  <span className="material-symbols-outlined align-middle group-hover:translate-x-1 transition-transform">bolt</span>
                </button>
              </SignInButton>
              <SignInButton mode="modal">
                <button className="btn-ghost px-10 py-4 rounded-xl font-headline font-bold text-lg">
                  Sign In
                </button>
              </SignInButton>
            </div>
          </div>

          {/* Floating Preview Card */}
          <div className="mt-20 w-full max-w-4xl mx-auto px-4 relative">
            <div className="glass-card p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="font-label text-xs uppercase tracking-widest text-primary">Active Vault</label>
                    <h3 className="text-2xl md:text-3xl font-headline font-bold">Deep Work Sprint</h3>
                  </div>
                  <div className="bg-black/30 border border-white/[0.06] rounded-lg p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant text-sm">Staked Amount</span>
                      <span className="text-tertiary-fixed font-bold font-headline">0.45 ETH</span>
                    </div>
                    <div className="w-full bg-outline-variant/30 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-tertiary h-full w-[65%] shadow-[0_0_10px_rgba(255,59,48,0.5)]" />
                    </div>
                    <div className="flex justify-between text-xs font-label text-on-surface-variant">
                      <span>Progress</span>
                      <span>65% Verified</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Mini stats */}
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">security</span>
                      <span className="text-sm font-label uppercase tracking-tight text-on-surface-variant">Escrow</span>
                    </div>
                    <span className="text-sm font-bold text-on-surface">On-chain</span>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-secondary">trending_up</span>
                      <span className="text-sm font-label uppercase tracking-tight text-on-surface-variant">On validation</span>
                    </div>
                    <span className="text-sm font-bold text-tertiary">Stake returned</span>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-tertiary">verified</span>
                      <span className="text-sm font-label uppercase tracking-tight text-on-surface-variant">AI Assistant</span>
                    </div>
                    <span className="text-sm font-bold text-tertiary flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                      Online
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works — Bento Grid */}
        <section className="py-24 md:py-32 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16 md:mb-24 space-y-4">
            <h2 className="text-3xl md:text-6xl font-headline font-bold tracking-tight">How It Works</h2>
            <p className="text-on-surface-variant text-lg">Real commitments. Independent human review.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: "account_balance_wallet", title: "Stake test ETH", desc: "Commit Sepolia ETH as proof of intent. It is locked in the TaskStaker smart contract until you deliver.", step: "01", color: "primary" },
              { icon: "upload_file", title: "Submit Proof", desc: "Upload screenshots, GitHub commits, or data logs as evidence of your task completion.", step: "02", color: "secondary" },
              { icon: "psychology", title: "Human Validation", desc: "A human validator reviews your proof, backed by an AI analysis that reads the evidence and gives a pass/fail recommendation.", step: "03", color: "primary-dim" },
              { icon: "workspace_premium", title: "Claim Reward", desc: "Get your full stake back on-chain the moment your validator approves. Miss the deadline and the stake is forfeited.", step: "04", color: "tertiary" },
            ].map((item, i) => (
              <div key={i} className="glass-card glass-card-hover p-8 flex flex-col justify-between group min-h-[280px]">
                <div>
                  <div className={`w-14 h-14 rounded-full bg-${item.color}/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                    <span className={`material-symbols-outlined text-${item.color} text-3xl`}>{item.icon}</span>
                  </div>
                  <h4 className="text-xl md:text-2xl font-headline font-bold mb-3">{item.title}</h4>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{item.desc}</p>
                </div>
                <div className="mt-8 pt-4 border-t border-outline-variant/20 flex justify-between items-center">
                  <span className={`text-xs font-label uppercase tracking-widest text-${item.color}/60`}>Step {item.step}</span>
                  <span className={`material-symbols-outlined text-${item.color}/60`}>
                    {i === 3 ? "done_all" : "trending_flat"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Showcase */}
        <section className="py-24 md:py-32 bg-surface-container-low/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-center">
              <div className="w-full md:w-1/2 relative">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/20 blur-3xl rounded-full" />
                <div className="glass-card p-8 relative">
                  {/* AI Terminal mockup */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 bg-tertiary rounded-full animate-pulse" />
                    <h3 className="text-lg font-headline font-bold text-on-surface tracking-tight">AI ANALYZER ACTIVE</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-4 font-mono text-xs text-tertiary/80 leading-relaxed">
                      <p>&gt; SCANNING_BLOCK_0x9A...</p>
                      <p>&gt; PROOF_VALIDATED: OK</p>
                      <p>&gt; CONFIDENCE: 98.4%</p>
                      <p>&gt; LATENCY: 14ms</p>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                      <p className="text-xs text-primary-dim leading-relaxed">
                        <span className="font-bold">Summary:</span> Deliverables match specified metadata hash. Code quality audit reveals high adherence to security protocols. No anomalies detected.
                      </p>
                    </div>
                  </div>
                </div>
                {/* Floating proof badge */}
                <div className="absolute -bottom-6 -right-4 glass-strong p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <div>
                      <p className="font-headline font-bold text-sm">Proof Confirmed</p>
                      <p className="text-[10px] text-on-surface-variant">Task: 2h Coding Session</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 space-y-8">
                <h2 className="text-3xl md:text-5xl font-headline font-bold leading-tight">AI Helps. Humans Decide.</h2>
                <p className="text-lg text-on-surface-variant leading-relaxed">
                  Every proof gets an AI second opinion. The chatbot reads the task description and the proof file, then gives your validator a structured recommendation — context-aware, not just a keyword match.
                </p>
                <ul className="space-y-4">
                  {[
                    "Vision models that read screenshots, PDFs and commit logs as evidence",
                    "Structured pass/fail recommendations with confidence scores",
                    "Validators stay in control — AI advises, humans decide",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary mt-0.5">check_circle</span>
                      <span className="text-on-surface">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 md:py-32 px-6">
          <div className="max-w-4xl mx-auto glass-card p-10 md:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-secondary/5 -z-10" />
            <h2 className="text-3xl md:text-5xl font-headline font-bold mb-6">Ready to Lock Your First Task?</h2>
            <p className="text-on-surface-variant text-lg mb-10 max-w-xl mx-auto">
              Public commitment plus real stakes is the most reliable way to follow through. Create a task, name your validator, and put your ETH where your goal is.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignInButton mode="modal">
                <button className="btn-primary px-8 py-4 rounded-xl font-headline font-bold">
                  Launch Dashboard
                </button>
              </SignInButton>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface w-full py-12 border-t border-secondary-container/10">
        <div className="max-w-7xl mx-auto px-8 flex flex-col items-center gap-6">
          <span className="text-2xl font-black text-secondary-container font-headline">TaskStaker</span>
          <p className="text-outline text-sm font-body">© 2026 TaskStaker. Secured by the TaskStaker contract on Sepolia.</p>
          <p className="text-outline text-xs font-body">Made by Ujwal</p>
          <div className="flex gap-8">
            <a className="text-outline hover:text-primary transition-all font-body text-sm" href="#">Privacy Policy</a>
            <a className="text-outline hover:text-primary transition-all font-body text-sm" href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
