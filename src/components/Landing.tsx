"use client";
import Link from "next/link";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Boxes, ShieldCheck, Sparkles, Zap, FileCheck, BarChart3,
  ArrowRight, Check, Globe2, DollarSign, Clock, Brain, Workflow,
  Upload, ScanLine, UserCheck, Send, AlertTriangle, TrendingUp,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function CountUp({ to, prefix = "", suffix = "", duration = 1.6, decimals = 0 }: { to: number; prefix?: string; suffix?: string; duration?: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (latest) => `${prefix}${latest.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    if (inView) {
      const controls = animate(mv, to, { duration, ease: [0.16, 1, 0.3, 1] });
      return controls.stop;
    }
  }, [inView, mv, to, duration]);
  return <motion.span ref={ref}>{rounded}</motion.span>;
}

function Nav({ signedIn }: { signedIn: boolean }) {
  return (
    <nav className="landing-nav">
      <Link href="/" className="landing-logo">
        <span className="landing-logo-mark"><Boxes size={18} /></span>
        TradeCo-Pilot
      </Link>
      <div className="landing-nav-links">
        <a href="#why">Why</a>
        <a href="#how">How it works</a>
        <a href="#examples">Examples</a>
        <a href="#roi">ROI</a>
        <a href="#pricing">Pricing</a>
        <Link href="/lookup">Free HS lookup</Link>
        {signedIn ? (
          <Link href="/dashboard" className="btn-primary">Dashboard <ArrowRight size={14} /></Link>
        ) : (
          <>
            <Link href="/sign-in" style={{ color: "var(--text-secondary)" }}>Sign in</Link>
            <Link href="/sign-up" className="btn-primary">Get started <ArrowRight size={14} /></Link>
          </>
        )}
      </div>
    </nav>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <motion.div initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} className="section-tag">
            <Sparkles size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "-1px" }} />
            AI customs classifier · audit-defensible
          </motion.div>
          <motion.h1 variants={fadeUp}>
            Stop guessing HS codes.<br /><span className="accent">Start saving thousands.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="hero-sub">
            TradeCo-Pilot classifies any product to a 10-digit harmonized tariff code in 60 seconds.
            Confidence-scored, reasoning shown, and routed to a licensed broker when the model isn't sure —
            so your declarations stand up to a CBP audit.
          </motion.p>
          <motion.div variants={fadeUp} className="hero-cta">
            <Link href={signedIn ? "/dashboard" : "/sign-up"} className="btn-primary btn-large">
              {signedIn ? "Open dashboard" : "Start free trial"} <ArrowRight size={16} />
            </Link>
            <a href="#examples" className="btn-secondary btn-large">See live examples</a>
          </motion.div>
          <motion.div variants={fadeUp} className="hero-trust">
            <span className="hero-trust-item"><Check size={14} color="var(--success)" /> No credit card to start</span>
            <span className="hero-trust-item"><Check size={14} color="var(--success)" /> 60-second setup</span>
            <span className="hero-trust-item"><Check size={14} color="var(--success)" /> SOC-2 path in motion</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroProductCard />
        </motion.div>
      </div>
    </section>
  );
}

function HeroProductCard() {
  return (
    <div style={{
      background: "white",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      boxShadow: "var(--shadow-xl)",
      padding: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Live classification</span>
        <span className="pill pill-auto">AUTO_APPROVED</span>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>Women's cashmere knit sweater</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Supplier: IT · Unit value: $80.00</div>
      </div>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 1.4, delay: 0.6, ease: "easeInOut" }}
        style={{
          height: 4, background: "linear-gradient(90deg, var(--primary), #06b6d4)",
          borderRadius: 2, marginBottom: 20,
        }}
      />
      <div style={{ display: "grid", gap: 12 }}>
        <Row label="HS code" value="6110.12.2070" mono />
        <Row label="Confidence" value={<span className="conf conf-high">94.2%</span>} />
        <Row label="Duty (US)" value="16.0%" />
        <Row label="Landed cost / unit" value="$95.36" />
      </div>
      <div style={{
        marginTop: 16, padding: 14, background: "var(--primary-50)",
        borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5,
      }}>
        <Brain size={13} style={{ display: "inline", marginRight: 6, color: "var(--primary)" }} />
        Heading 6110 covers sweaters knit or crocheted. Subheading 6110.12 specifies cashmere goats' wool. GRI 1 applied.
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 14, ...(mono ? { fontFamily: "ui-monospace, monospace" } : {}) }}>{value}</span>
    </div>
  );
}

function StatBar() {
  return (
    <section style={{ padding: "32px 0 0", marginTop: -40 }}>
      <div className="container">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
          variants={stagger} className="stat-bar"
        >
          <motion.div variants={fadeUp} className="stat">
            <div className="stat-value"><CountUp to={18000} prefix="$" /></div>
            <div className="stat-label">Avg. annual savings per SMB</div>
          </motion.div>
          <motion.div variants={fadeUp} className="stat">
            <div className="stat-value"><CountUp to={94} suffix="%" /></div>
            <div className="stat-label">Auto-classification accuracy</div>
          </motion.div>
          <motion.div variants={fadeUp} className="stat">
            <div className="stat-value"><CountUp to={60} suffix="s" /></div>
            <div className="stat-label">From upload to declaration</div>
          </motion.div>
          <motion.div variants={fadeUp} className="stat">
            <div className="stat-value"><CountUp to={50} prefix="$" suffix="K" /></div>
            <div className="stat-label">Avoided per audit incident</div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Why() {
  const features = [
    {
      icon: <DollarSign size={20} />,
      title: "Stop overpaying duty",
      desc: "SMBs over-pay duties by 5–15% because brokers default to safe-but-wrong HS codes. Our classifier finds the precise sub-heading. You keep the difference.",
    },
    {
      icon: <ShieldCheck size={20} />,
      title: "Audit-defensible declarations",
      desc: "Every classification ships with a reasoning trail, confidence score, and licensed-broker sign-off available on-demand. CBP-ready.",
    },
    {
      icon: <Zap size={20} />,
      title: "Built for SMB speed",
      desc: "Connect Shopify, paste a CSV, or call our API. We classify, estimate landed cost, and queue declarations — all in one place. No IT project.",
    },
  ];
  return (
    <section id="why" className="section">
      <div className="container">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} style={{ textAlign: "center", marginBottom: 56 }}>
          <motion.div variants={fadeUp} className="section-tag">Why TradeCo-Pilot</motion.div>
          <motion.h2 variants={fadeUp} className="section-title">Three reasons SMBs switch.</motion.h2>
          <motion.p variants={fadeUp} className="section-subtitle" style={{ margin: "0 auto" }}>
            Enterprise compliance tools cost $50K+/year and need a 6-month IT project. We replace them with a $299/month SaaS that pays for itself in the first shipment.
          </motion.p>
        </motion.div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="card-grid">
          {features.map((f, i) => (
            <motion.div key={i} variants={fadeUp} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <Upload size={18} />, title: "Connect or upload", desc: "Shopify OAuth, NetSuite, ShipStation, or paste a CSV. Your SKUs land in seconds." },
    { icon: <ScanLine size={18} />, title: "AI classifies", desc: "Claude Sonnet 4.6 reads title, description, materials, and image — assigns a 10-digit HS code with rationale." },
    { icon: <UserCheck size={18} />, title: "Broker reviews edges", desc: "Anything under your confidence threshold routes to a licensed customs broker. You see the decision in your dashboard." },
    { icon: <Send size={18} />, title: "Submit declarations", desc: "Landed cost computed, declaration package signed, customs filing initiated. Full audit trail saved." },
  ];
  return (
    <section id="how" className="section" style={{ background: "var(--bg)" }}>
      <div className="container">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} style={{ textAlign: "center", marginBottom: 56 }}>
          <motion.div variants={fadeUp} className="section-tag">How it works</motion.div>
          <motion.h2 variants={fadeUp} className="section-title">From SKU to filed declaration in 4 steps.</motion.h2>
        </motion.div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="steps">
          {steps.map((s, i) => (
            <motion.div key={i} variants={fadeUp} className="step">
              <span className="step-num">{i + 1}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ color: "var(--primary)" }}>{s.icon}</span>
                <h3 className="step-title">{s.title}</h3>
              </div>
              <p className="step-desc">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Examples() {
  const examples = [
    {
      title: "Persian wool rug — IR",
      sub: "Hand-knotted Tabriz pattern, 100% wool pile on cotton warp",
      hs: "5701.10.9000",
      confidence: 0.85,
      duty: "0% (free)",
      rationale: "Chapter 57 carpets; heading 5701 knotted; subheading 5701.10 wool pile. GRI 1.",
      status: "auto",
    },
    {
      title: "Cashmere knit sweater — IT",
      sub: "Women's pullover, 100% cashmere",
      hs: "6110.12.2070",
      confidence: 0.94,
      duty: "16.0%",
      rationale: "Heading 6110 sweaters knit. 6110.12 specifies cashmere. Women's sub-statistical 2070.",
      status: "auto",
    },
    {
      title: "Smartphone 5G 128GB — CN",
      sub: "Apple-style flagship, titanium body",
      hs: "8517.13.0000",
      confidence: 0.97,
      duty: "0% (free)",
      rationale: "Chapter 85 electrical machinery. 8517 telephones. 8517.13 smartphones (new from 2022 HS).",
      status: "auto",
    },
    {
      title: "Glazed ceramic mug — MX",
      sub: "12oz porcelain, dishwasher safe",
      hs: "6911.10.4100",
      confidence: 0.78,
      duty: "20.5%",
      rationale: "Chapter 69 ceramics. 6911 porcelain tableware. Subheading 4100 retail-packed sets — review.",
      status: "review",
    },
  ];
  return (
    <section id="examples" className="section">
      <div className="container">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} style={{ textAlign: "center", marginBottom: 48 }}>
          <motion.div variants={fadeUp} className="section-tag">Real classifications</motion.div>
          <motion.h2 variants={fadeUp} className="section-title">Four products. Four sub-headings. Four reasons.</motion.h2>
          <motion.p variants={fadeUp} className="section-subtitle" style={{ margin: "0 auto" }}>
            These were generated by the live system on real product descriptions. The model picks the precise sub-heading and shows its work.
          </motion.p>
        </motion.div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="examples">
          {examples.map((ex, i) => (
            <motion.div key={i} variants={fadeUp} className="example">
              <div className="example-input">
                <div className="example-input-title">{ex.title}</div>
                <div>{ex.sub}</div>
              </div>
              <div className="example-output">
                <div className="example-row">
                  <span className="example-label">HS code</span>
                  <span className="example-value" style={{ color: "var(--primary)" }}>{ex.hs}</span>
                </div>
                <div className="example-row">
                  <span className="example-label">Confidence</span>
                  <span className={`conf ${ex.confidence >= 0.85 ? "conf-high" : ex.confidence >= 0.7 ? "conf-med" : "conf-low"}`}>
                    {(ex.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="example-row">
                  <span className="example-label">US duty</span>
                  <span className="example-value">{ex.duty}</span>
                </div>
                <div className="example-row">
                  <span className="example-label">Status</span>
                  <span className={`pill pill-${ex.status === "auto" ? "auto" : "needs"}`}>
                    {ex.status === "auto" ? "AUTO_APPROVED" : "NEEDS_REVIEW"}
                  </span>
                </div>
                <p className="example-rationale">"{ex.rationale}"</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ROI() {
  const [cogs, setCogs] = useState(2_000_000);
  const [dutyRate, setDutyRate] = useState(8);
  const [skus, setSkus] = useState(500);

  const dutiesPerYear = cogs * (dutyRate / 100);
  const overpayment = dutiesPerYear * 0.08;
  const auditAvoidance = Math.min(skus * 25, 25000);
  const totalSavings = overpayment + auditAvoidance;
  const proCost = 2499 * 12;
  const net = totalSavings - proCost;

  return (
    <section id="roi" className="section" style={{ background: "var(--bg)" }}>
      <div className="container">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} style={{ textAlign: "center", marginBottom: 48 }}>
          <motion.div variants={fadeUp} className="section-tag">Calculate your savings</motion.div>
          <motion.h2 variants={fadeUp} className="section-title">Most TradeCo-Pilot customers save 4–8× the subscription.</motion.h2>
          <motion.p variants={fadeUp} className="section-subtitle" style={{ margin: "0 auto" }}>
            Plug your real numbers in. Math is based on industry-standard 5–15% duty overpayment reduction and a $5K–$50K avoided-audit envelope.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="roi-card"
        >
          <div className="roi-grid">
            <div className="roi-inputs">
              <label>
                Annual import COGS (USD)
                <input type="number" min={0} step={100000} value={cogs} onChange={(e) => setCogs(Math.max(0, +e.target.value))} />
              </label>
              <label>
                Average duty rate (%)
                <input type="number" min={0} max={50} step={0.5} value={dutyRate} onChange={(e) => setDutyRate(Math.max(0, Math.min(50, +e.target.value)))} />
              </label>
              <label>
                Active SKUs
                <input type="number" min={1} step={10} value={skus} onChange={(e) => setSkus(Math.max(1, +e.target.value))} />
              </label>
            </div>

            <div className="roi-result">
              <div className="roi-result-label">Estimated net annual savings</div>
              <div className="roi-result-value">
                ${Math.max(0, Math.round(net)).toLocaleString()}
              </div>
              <div className="roi-result-sub">
                Based on <strong>${Math.round(overpayment).toLocaleString()}</strong> in recovered duty overpayment + <strong>${Math.round(auditAvoidance).toLocaleString()}</strong> in avoided audit fines, minus <strong>${proCost.toLocaleString()}</strong> Pro subscription.
                <br />
                ROI multiple: <strong style={{ color: "#fbbf24" }}>{(totalSavings / proCost).toFixed(1)}×</strong> on subscription cost.
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Pricing({ signedIn }: { signedIn: boolean }) {
  const tiers = [
    {
      name: "Starter",
      price: 299,
      desc: "For DTC brands launching cross-border.",
      features: ["500 SKUs / month", "10-digit HS classification", "Landed cost estimates", "Daily regulatory alerts", "Email support"],
      featured: false,
    },
    {
      name: "Growth",
      price: 799,
      desc: "Most popular for scaling brands.",
      features: ["5,000 SKUs / month", "Everything in Starter", "Shopify + NetSuite connectors", "Audit log + reports", "Priority support"],
      featured: true,
    },
    {
      name: "Pro",
      price: 2499,
      desc: "Custom rules, dedicated brokers.",
      features: ["Unlimited SKUs", "Everything in Growth", "Dedicated broker pool", "Custom tariff rules", "SLA + Slack support"],
      featured: false,
    },
  ];
  return (
    <section id="pricing" className="section">
      <div className="container">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} style={{ textAlign: "center", marginBottom: 56 }}>
          <motion.div variants={fadeUp} className="section-tag">Pricing</motion.div>
          <motion.h2 variants={fadeUp} className="section-title">Simple. Per-month. Cancel anytime.</motion.h2>
        </motion.div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="pricing-grid">
          {tiers.map((t) => (
            <motion.div key={t.name} variants={fadeUp} className={`price-card ${t.featured ? "featured" : ""}`}>
              <div className="price-name">{t.name}</div>
              <div>
                <span className="price-amount">${t.price.toLocaleString()}</span>
                <span className="price-period"> /mo</span>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 8 }}>{t.desc}</p>
              <ul className="price-features">
                {t.features.map((f, i) => (
                  <li key={i}><Check size={16} /> {f}</li>
                ))}
              </ul>
              <Link
                href={signedIn ? "/settings/billing" : "/sign-up"}
                className={t.featured ? "btn-primary" : "btn-secondary"}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {signedIn ? "Subscribe" : "Start trial"} <ArrowRight size={14} />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CTA({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="section-tight">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }} className="cta-section"
        >
          <h2>Your next shipment can pay for the year.</h2>
          <p>One correct sub-heading reclassification on a $50K shipment can save $4,000. Multiply by your SKU count. We pay for ourselves before our first invoice.</p>
          <Link href={signedIn ? "/dashboard" : "/sign-up"} className="btn-primary btn-large">
            {signedIn ? "Open dashboard" : "Start your free trial"} <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="landing-logo-mark" style={{ width: 24, height: 24 }}><Boxes size={14} /></span>
        <span>© 2026 TradeCo-Pilot</span>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <Link href="/lookup">Free HS lookup</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/sign-in">Sign in</Link>
      </div>
    </footer>
  );
}

export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="landing-root">
      <Nav signedIn={signedIn} />
      <Hero signedIn={signedIn} />
      <StatBar />
      <Why />
      <HowItWorks />
      <Examples />
      <ROI />
      <Pricing signedIn={signedIn} />
      <CTA signedIn={signedIn} />
      <Footer />
    </div>
  );
}
