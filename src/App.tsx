import { useState, useEffect, useRef } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Dashboard from "./Dashboard";
import Editor from "./Editor";
import {
  Sparkles,
  ArrowRight,
  Play,
  Menu,
  X,
  Check,
  Plus,
  Minus,
  Wand2,
  Palette,
  MousePointer2,
  Video,
  BarChart3,
  Rocket,
  Star,
  Quote,
  Layers,
  Zap,
  Shield,
  Cpu,
  Eye,
  FileVideo,
  FileCode,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ───────── Types ───────── */
interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  popular: boolean;
  badge: string;
  description: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface ExportCard {
  num: string;
  title: string;
  desc: string;
  icon: React.ElementType;
}

/* ───────── Data ───────── */
const navLinks = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Showcase", href: "#showcase" },
  { label: "Pricing", href: "#pricing" },
];

const horizontalCards = [
  { title: "Generate", subtitle: "AI writes your motion", icon: Wand2 },
  { title: "Sync", subtitle: "Brand DNA applied", icon: Palette },
  { title: "Edit", subtitle: "No keyframes needed", icon: MousePointer2 },
  { title: "Ship", subtitle: "Any format, anywhere", icon: Rocket },
  { title: "Analyze", subtitle: "Know what converts", icon: BarChart3 },
];

const features3D = [
  { icon: Cpu, title: "AI Motion Core", desc: "Trained on millions of premium animations." },
  { icon: Eye, title: "Vision Preview", desc: "See every variant before you commit." },
  { icon: Layers, title: "Layer Logic", desc: "Complex scenes, simple controls." },
  { icon: Zap, title: "Instant Export", desc: "Lottie, SVG, MP4, React — one click." },
  { icon: Shield, title: "Enterprise Safe", desc: "SOC 2, SSO, audit logs." },
  { icon: Video, title: "Cinematic Quality", desc: "4K motion, optimized delivery." },
];

const exportCards: ExportCard[] = [
  { num: "01", title: "MP4", desc: "Share-ready video at smooth frame rates.", icon: FileVideo },
  { num: "02", title: "Animated SVG", desc: "Sharp, lightweight motion for the web.", icon: FileCode },
  { num: "03", title: "Lottie JSON", desc: "Native vectors and editable motion for apps.", icon: Rocket },
];

const testimonials = [
  { quote: "We stopped outsourcing motion. Anim8 is our entire animation department now.", author: "Priya Patel", role: "Founder, CraftStudio" },
  { quote: "The scroll-driven demos alone increased our demo requests by 3x.", author: "Rahul Shah", role: "Product Lead, NexusPay" },
  { quote: "It feels like the future of design tooling.", author: "Maya Desai", role: "Design Director, Orbit" },
];

const pricingFeatures = [
  "Unlimited image + video vectorization",
  "Animate with your AI via MCP + CLI",
  "Keyframes, spring bounce & text animation",
  "Camera motion & character rigging",
  "Editable SVG & Figma Motion imports",
  "MP4, SVG & Lottie exports",
];

const pricingPlans: Plan[] = [
  {
    name: "Pro Monthly",
    price: "$9",
    period: "USD / month",
    features: pricingFeatures,
    cta: "Subscribe for $9/mo",
    popular: false,
    badge: "Cancel anytime",
    description: "All of Pro, one month at a time. Keep your rate while you stay subscribed.",
  },
  {
    name: "Founding Lifetime",
    price: "$79",
    period: "USD, once",
    features: pricingFeatures,
    cta: "Get lifetime access",
    popular: true,
    badge: "First 100 purchases",
    description: "One payment. More room to make things move. No subscription renewal.",
  },
];

const faqs: FAQItem[] = [
  { question: "Is coding required?", answer: "No. Anim8 is built for designers, marketers, and product teams. If you can describe motion, you can ship it." },
  { question: "What formats export?", answer: "Lottie JSON, SVG, CSS, MP4, WebM, GIF, and React components." },
  { question: "Can I use it commercially?", answer: "Yes. All plans include commercial usage rights. Enterprise includes indemnification." },
  { question: "Is there a trial?", answer: "Scale plan is free for 14 days, no card required." },
];

/* ───────── Preloader ───────── */
function Preloader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(eased * 100);
      setCount(value);
      if (progress < 1) requestAnimationFrame(tick);
      else setTimeout(onDone, 400);
    };
    requestAnimationFrame(tick);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
      exit={{ y: "-100%" }}
      transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="text-center">
        <p className="font-display text-[15vw] font-black leading-none text-slate-900">{count}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Loading experience</p>
      </div>
    </motion.div>
  );
}

/* ───────── Custom Cursor ───────── */
function CustomCursor() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 500, damping: 50 });
  const sy = useSpring(y, { stiffness: 500, damping: 50 });
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setHidden(false);
    };
    const enter = () => setHidden(false);
    const leave = () => setHidden(true);

    const handleOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [data-cursor='hover']")) setHovered(true);
    };
    const handleOut = () => setHovered(false);

    window.addEventListener("mousemove", move);
    document.body.addEventListener("mouseenter", enter);
    document.body.addEventListener("mouseleave", leave);
    document.addEventListener("mouseover", handleOver);
    document.addEventListener("mouseout", handleOut);

    return () => {
      window.removeEventListener("mousemove", move);
      document.body.removeEventListener("mouseenter", enter);
      document.body.removeEventListener("mouseleave", leave);
      document.removeEventListener("mouseover", handleOver);
      document.removeEventListener("mouseout", handleOut);
    };
  }, [x, y]);

  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return null;

  return (
    <>
      <motion.div
        style={{ x: sx, y: sy }}
        className="pointer-events-none fixed top-0 left-0 z-[9999] hidden md:block"
      >
        <motion.div
          animate={{ scale: hovered ? 2.5 : 1, opacity: hidden ? 0 : 1 }}
          className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900"
          style={{ width: 16, height: 16 }}
        />
      </motion.div>
      <motion.div
        style={{ x, y }}
        className="pointer-events-none fixed top-0 left-0 z-[9998] hidden md:block"
      >
        <motion.div
          animate={{ opacity: hidden ? 0 : 0.4 }}
          className="-translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-900"
          style={{ width: 48, height: 48 }}
        />
      </motion.div>
    </>
  );
}

/* ───────── Particle Canvas ───────── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const count = Math.min(80, Math.floor(width / 18));

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
      });
    }

    let mouse = { x: width / 2, y: height / 2 };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", onMove);

    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          p.x -= dx * 0.008;
          p.y -= dy * 0.008;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const d = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(15, 23, 42, ${0.1 * (1 - d / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
}

/* ───────── Navbar ───────── */
function Navbar() {
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: visible ? 0 : -100 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 glass-light"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <span className="font-display">Anim8</span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                {l.label}
              </a>
            ))}
          </div>
          <Link to="/dashboard" className="hidden rounded-full bg-slate-900 px-5 py-2 text-xs font-black uppercase tracking-widest text-white transition-transform hover:scale-105 md:block">
            Get access
          </Link>
          <button onClick={() => setMenuOpen(true)} className="md:hidden text-slate-900">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-white md:hidden"
          >
            <div className="flex h-full flex-col items-center justify-center gap-8">
              <button onClick={() => setMenuOpen(false)} className="absolute top-6 right-6 text-slate-900">
                <X className="h-8 w-8" />
              </button>
              {navLinks.map((l) => (
                <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="font-display text-4xl font-black text-slate-900">
                  {l.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ───────── Hero ───────── */
function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-line", {
        y: 120,
        opacity: 0,
        rotateX: 45,
        duration: 1.4,
        stagger: 0.12,
        ease: "power4.out",
        delay: 2.2,
      });
      gsap.from(".hero-sub", { y: 40, opacity: 0, duration: 1, ease: "power3.out", delay: 2.8 });
      gsap.from(".hero-cta", { y: 40, opacity: 0, duration: 1, ease: "power3.out", delay: 3 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20">
      <div className="relative z-10 mx-auto max-w-7xl text-center">
        <div className="overflow-hidden">
          <h1 className="hero-line font-display text-[13vw] font-black leading-[0.85] tracking-tighter text-slate-900 md:text-[11vw]">
            Motion
          </h1>
        </div>
        <div className="overflow-hidden">
          <h1 className="hero-line font-display text-[13vw] font-black leading-[0.85] tracking-tighter text-slate-900 md:text-[11vw]">
            that <span className="text-stroke">moves</span>
          </h1>
        </div>
        <div className="overflow-hidden">
          <h1 className="hero-line font-display text-[13vw] font-black leading-[0.85] tracking-tighter text-slate-900 md:text-[11vw]">
            people
          </h1>
        </div>

        <p className="hero-sub mx-auto mt-8 max-w-xl text-base font-medium leading-relaxed text-slate-500 md:text-lg">
          Anim8 is the AI-native animation platform for product teams who refuse to ship boring software.
        </p>

        <div className="hero-cta mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a href="#pricing" className="group flex items-center gap-3 rounded-full bg-slate-900 px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/15 transition-transform hover:scale-105">
            Start creating
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <button className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-8 py-4 text-sm font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50">
            <Play className="h-4 w-4 fill-current" />
            Watch film
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.4, duration: 1 }}
        className="absolute bottom-10 left-6 z-10 hidden flex-col gap-2 md:flex"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Scroll</span>
        <div className="h-16 w-[1px] bg-slate-200">
          <motion.div animate={{ y: [0, 64, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="h-4 w-[1px] bg-slate-900" />
        </div>
      </motion.div>

      <div className="absolute bottom-10 right-6 z-10 hidden text-right md:block">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">2026</p>
        <p className="mt-1 text-sm font-bold text-slate-900">SaaS Motion OS</p>
      </div>
    </section>
  );
}

/* ───────── Manifesto Pinned ───────── */
function Manifesto() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const words = textRef.current?.querySelectorAll(".manifesto-word");
      if (!words) return;
      gsap.fromTo(
        words,
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.03,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "+=150%",
            scrub: true,
            pin: true,
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const copy =
    "The best products don't just function. They feel alive. Every scroll, every hover, every loading state is a chance to build trust, spark delight, and move users closer to action. Anim8 gives your team the power to ship that feeling — at scale.";

  return (
    <section id="manifesto" ref={sectionRef} className="relative z-10 flex min-h-screen items-center justify-center bg-white px-6">
      <div ref={textRef} className="mx-auto max-w-6xl">
        <p className="font-display text-3xl font-bold leading-tight text-slate-900 md:text-5xl lg:text-6xl">
          {copy.split(" ").map((word, i) => (
            <span key={i} className="manifesto-word mr-[0.3em] inline-block">
              {word}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/* ───────── Card Animations ───────── */
function GenerateAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40 text-indigo-600 animate-wand">
        <path d="M30 90 L75 45 L85 55 L40 100 Z" fill="currentColor" />
        <path d="M70 40 L85 25 L95 35 L80 50 Z" fill="currentColor" opacity="0.8" />
      </svg>
      <div className="absolute top-4 left-6 h-3 w-3 rounded-full bg-indigo-400 animate-sparkle" style={{ animationDelay: "0s" }} />
      <div className="absolute top-12 right-8 h-2 w-2 rounded-full bg-pink-400 animate-sparkle" style={{ animationDelay: "0.4s" }} />
      <div className="absolute bottom-8 left-10 h-2.5 w-2.5 rotate-45 bg-amber-400 animate-sparkle" style={{ animationDelay: "0.8s" }} />
      <div className="absolute bottom-12 right-12 h-3 w-3 rounded-full bg-indigo-300 animate-sparkle" style={{ animationDelay: "1.2s" }} />
    </div>
  );
}

function SyncAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40 text-indigo-200">
        <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
      <div className="absolute flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50">
        <div className="absolute h-4 w-4 rounded-full bg-indigo-600 animate-palette-dot" style={{ animationDelay: "0s" }} />
        <div className="absolute h-4 w-4 rounded-full bg-pink-500 animate-palette-dot" style={{ animationDelay: "0.5s" }} />
        <div className="absolute h-4 w-4 rounded-full bg-amber-500 animate-palette-dot" style={{ animationDelay: "1s" }} />
        <div className="absolute h-4 w-4 rounded-full bg-emerald-500 animate-palette-dot" style={{ animationDelay: "1.5s" }} />
      </div>
    </div>
  );
}

function EditAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40 text-indigo-600 animate-cursor">
        <path d="M35 30 L35 95 L55 75 L75 105 L90 95 L70 65 L95 65 Z" fill="currentColor" />
      </svg>
      <div className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-400 animate-ripple" />
      <div className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-400 animate-ripple" style={{ animationDelay: "1s" }} />
    </div>
  );
}

function ShipAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40 animate-rocket">
        <path d="M60 15 L75 55 L95 60 L75 65 L60 105 L45 65 L25 60 L45 55 Z" fill="#4f46e5" />
        <path d="M50 85 L45 110 L55 95 Z" fill="#ec4899" className="animate-flame" style={{ transformOrigin: "50px 100px" }} />
        <path d="M70 85 L75 110 L65 95 Z" fill="#ec4899" className="animate-flame" style={{ transformOrigin: "70px 100px", animationDelay: "0.2s" }} />
      </svg>
    </div>
  );
}

function AnalyzeAnimation() {
  return (
    <div className="flex h-full w-full items-end justify-center gap-3 pb-4">
      <div className="w-8 rounded-t-xl bg-indigo-200 animate-bar" style={{ height: "40%", animationDelay: "0s" }} />
      <div className="w-8 rounded-t-xl bg-indigo-400 animate-bar" style={{ height: "70%", animationDelay: "0.3s" }} />
      <div className="w-8 rounded-t-xl bg-pink-400 animate-bar" style={{ height: "55%", animationDelay: "0.6s" }} />
      <div className="w-8 rounded-t-xl bg-amber-400 animate-bar" style={{ height: "85%", animationDelay: "0.9s" }} />
      <div className="w-8 rounded-t-xl bg-indigo-600 animate-bar" style={{ height: "65%", animationDelay: "1.2s" }} />
    </div>
  );
}

const cardAnimations = [GenerateAnimation, SyncAnimation, EditAnimation, ShipAnimation, AnalyzeAnimation];

/* ───────── Horizontal Scroll ───────── */
function HorizontalScroll() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!trackRef.current || !sectionRef.current) return;
      const track = trackRef.current;
      const scrollWidth = track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: -scrollWidth,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: () => `+=${scrollWidth}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="capabilities" ref={sectionRef} className="relative z-10 overflow-hidden bg-white">
      <div className="absolute top-12 left-6 z-20">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Capabilities</p>
      </div>
      <div ref={trackRef} className="flex h-screen w-max items-center gap-8 px-6 md:px-20">
        <div className="flex h-[70vh] w-[85vw] shrink-0 flex-col justify-end rounded-[3rem] border border-slate-200 bg-slate-50 p-10 md:w-[60vw] md:p-16">
          <h2 className="max-w-xl font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-7xl">
            The full motion pipeline
          </h2>
          <p className="mt-6 max-w-md text-base font-medium text-slate-500">
            Scroll to explore the five capabilities that replace your entire motion workflow.
          </p>
        </div>
        {horizontalCards.map((card, i) => {
          const Animation = cardAnimations[i];
          return (
            <div
              key={card.title}
              className="group relative flex h-[70vh] w-[70vw] shrink-0 flex-col overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-50 p-10 transition-colors hover:border-indigo-200 hover:bg-white md:w-[35vw]"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <card.icon className="h-8 w-8" />
              </div>

              <div className="flex flex-1 items-center justify-center py-6">
                <Animation />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">0{i + 1}</span>
                <h3 className="mt-2 font-display text-4xl font-black text-slate-900">{card.title}</h3>
                <p className="mt-2 text-lg font-medium text-slate-500">{card.subtitle}</p>
              </div>

              <div className="absolute top-10 right-10 text-slate-200 transition-colors group-hover:text-indigo-100">
                <card.icon className="h-40 w-40" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────── 3D Feature Grid ───────── */
function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 });

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 1000 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function FeatureGrid() {
  return (
    <section className="relative z-10 bg-white px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-2xl font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-7xl">
            Built for makers
          </h2>
          <p className="max-w-sm text-base font-medium text-slate-500">
            Every tool you need to generate, edit, and ship premium animation.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features3D.map((f, i) => (
            <TiltCard key={f.title}>
              <div className="card-hover h-full rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-6 font-display text-2xl font-black text-slate-900">{f.title}</h3>
                <p className="mt-3 font-medium text-slate-500">{f.desc}</p>
                <div className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">0{i + 1}</div>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Showcase Pinned ───────── */
function Showcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(panelRef.current, {
        scale: 0.85,
        borderRadius: "3rem",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=100%",
          scrub: true,
          pin: true,
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="showcase" ref={sectionRef} className="relative z-10 min-h-screen bg-white px-6">
      <div ref={panelRef} className="mx-auto flex h-screen max-w-7xl flex-col items-center justify-center overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(79,70,229,0.06),_transparent_60%)]" />
        <div className="relative z-10 px-6 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">The Studio</span>
          <h2 className="mx-auto mt-4 max-w-4xl font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-8xl">
            Make it once.
            <br />
            Send it anywhere.
          </h2>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 rounded-[2rem] border border-slate-200 bg-white/70 p-4 backdrop-blur md:grid-cols-3">
            {exportCards.map((card) => (
              <div key={card.title} className="rounded-2xl bg-white p-6 text-left shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{card.num}</span>
                  <card.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="mt-3 font-display text-xl font-bold text-slate-900">{card.title}</p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Stats ───────── */
function Stats() {
  return (
    <section className="relative z-10 border-y border-slate-100 bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 text-center md:grid-cols-3">
          {[
            { value: "10M+", label: "Animations shipped" },
            { value: "340%", label: "Avg. conversion lift" },
            { value: "98%", label: "Customer satisfaction" },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display text-6xl font-black text-slate-900 md:text-7xl">{s.value}</p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.2em] text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Testimonials ───────── */
function TestimonialCard({ t, i }: { t: typeof testimonials[0]; i: number }) {
  return (
    <div className="marquee-card group w-[340px] shrink-0 rounded-[2rem] border border-slate-200 bg-slate-50 p-8 hover:border-indigo-200 hover:bg-white md:w-[420px]">
      <Quote className="h-10 w-10 text-indigo-200" />
      <p className="mt-6 text-xl font-bold leading-relaxed text-slate-800">{t.quote}</p>
      <div className="mt-8 flex gap-1">
        {Array.from({ length: 5 }).map((_, j) => (
          <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="mt-4 font-display text-lg font-black text-slate-900">{t.author}</p>
      <p className="text-sm font-bold text-slate-500">{t.role}</p>
      <span className="mt-6 block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">0{i + 1}</span>
    </div>
  );
}

function Testimonials() {
  const duplicated = [...testimonials, ...testimonials, ...testimonials];

  return (
    <section className="relative z-10 overflow-hidden bg-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="max-w-2xl font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-7xl">
          Loved by builders
        </h2>
      </div>

      <div className="marquee-container relative mt-16">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent md:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent md:w-32" />

        <div className="marquee-track gap-6 pl-6">
          {duplicated.map((t, i) => (
            <TestimonialCard key={`${t.author}-${i}`} t={t} i={(i % testimonials.length) + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Pricing ───────── */
function Pricing() {
  return (
    <section id="pricing" className="relative z-10 bg-slate-50 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-7xl">
          Choose your scale
        </h2>
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col rounded-[2.5rem] border border-slate-200 bg-white p-8 transition-all duration-300 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-900/5 md:p-10"
            >
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {plan.badge}
              </span>

              <h3 className="mt-6 font-display text-2xl font-black text-slate-900 md:text-3xl">
                {plan.name}
              </h3>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-6xl font-black text-slate-900">{plan.price}</span>
                <span className="text-base font-bold text-slate-500">{plan.period}</span>
              </div>

              <p className="mt-4 text-base font-medium leading-relaxed text-slate-500">
                {plan.description}
              </p>

              <ul className="mt-8 space-y-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm font-bold text-slate-700">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`mt-auto w-full rounded-2xl py-4 text-sm font-black transition-transform hover:scale-[1.02] ${
                  plan.popular
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-slate-900 text-white"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── FAQ ───────── */
function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative z-10 bg-white px-6 py-32">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-7xl">
          Common questions
        </h2>
        <div className="mt-12 space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between text-left">
                <span className="font-display text-lg font-black text-slate-900">{faq.question}</span>
                {open === i ? <Minus className="h-5 w-5 text-slate-900" /> : <Plus className="h-5 w-5 text-slate-400" />}
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <p className="pt-4 font-medium leading-relaxed text-slate-500">{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── CTA ───────── */
function CTA() {
  return (
    <section className="relative z-10 bg-white px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-12 text-center md:p-24">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-pink-600/20 blur-3xl" />
          <h2 className="relative z-10 mx-auto max-w-4xl font-display text-5xl font-black leading-[0.95] text-white md:text-8xl">
            Your next idea
            <br />
            should move.
          </h2>
          <div className="relative z-10 mt-10 flex flex-col items-center justify-center">
            <button className="group flex items-center gap-3 rounded-full bg-white px-8 py-4 text-sm font-black text-slate-900 shadow-xl shadow-slate-900/20 transition-transform hover:scale-105">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Footer ───────── */
function Footer() {
  const links = [
    { label: "Editor", to: "#" },
    { label: "Developer docs", to: "#" },
    { label: "Figma plugin", to: "#" },
    { label: "Privacy Policy", to: "/privacy" },
    { label: "Terms & Conditions", to: "/terms" },
  ];

  return (
    <footer className="relative z-10 border-t border-slate-200 bg-slate-50 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <Link to="/" className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          <span className="font-display">Anim8</span>
        </Link>

        <p className="text-sm font-medium text-slate-500">
          Motion design, made direct.
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
          {links.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

/* ───────── Privacy Policy Page ───────── */
function PrivacyPage() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const sections = [
    {
      title: "1. Information We Collect",
      content:
        "We collect information you provide directly to us, such as your name, email address, and payment information. We also collect data about how you interact with our platform, including your IP address, browser type, device information, and usage patterns.",
    },
    {
      title: "2. How We Use Your Information",
      content:
        "We use your information to provide, maintain, and improve Anim8, process transactions, send updates and marketing communications, respond to support requests, and detect fraud or abuse.",
    },
    {
      title: "3. Sharing Your Information",
      content:
        "We do not sell your personal information. We may share data with trusted third-party service providers who help us operate our business, such as payment processors, hosting providers, and analytics services, under strict confidentiality agreements.",
    },
    {
      title: "4. Data Security",
      content:
        "We implement industry-standard security measures to protect your data, including encryption in transit and at rest, access controls, and regular security audits. However, no method of transmission over the internet is 100% secure.",
    },
    {
      title: "5. Your Rights",
      content:
        "You have the right to access, update, or delete your personal information. You may also object to certain processing activities or request a copy of your data. Contact us at privacy@anim8.studio for any data requests.",
    },
    {
      title: "6. Cookies & Tracking",
      content:
        "We use cookies and similar technologies to enhance your experience, analyze site traffic, and understand user behavior. You can manage your cookie preferences through your browser settings.",
    },
    {
      title: "7. Children's Privacy",
      content:
        "Anim8 is not intended for children under the age of 13. We do not knowingly collect personal information from children. If you believe we have collected data from a child, please contact us immediately.",
    },
    {
      title: "8. Changes to This Policy",
      content:
        "We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page and updating the effective date.",
    },
  ];

  return (
    <div className="min-h-screen bg-white font-display">
      <CustomCursor />
      <ParticleCanvas />
      <nav className="fixed top-0 left-0 right-0 z-50 glass-light">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <span>Anim8</span>
          </Link>
          <Link
            to="/"
            className="rounded-full border border-slate-200 px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50"
          >
            Back home
          </Link>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pt-40 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Legal</span>
          <h1 className="mt-4 font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-7xl">
            Privacy Policy
          </h1>
          <p className="mt-6 text-base font-medium text-slate-500">
            Effective Date: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </motion.div>

        <div className="mt-16 space-y-12">
          {sections.map((section, i) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="font-display text-2xl font-black text-slate-900">{section.title}</h2>
              <p className="mt-3 text-base font-medium leading-relaxed text-slate-500">{section.content}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 rounded-[2rem] border border-slate-200 bg-slate-50 p-8"
        >
          <h2 className="font-display text-2xl font-black text-slate-900">Contact Us</h2>
          <p className="mt-3 text-base font-medium leading-relaxed text-slate-500">
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:privacy@anim8.studio" className="text-indigo-600 hover:underline">
              privacy@anim8.studio
            </a>
            .
          </p>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <Link to="/" className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <span className="font-display">Anim8</span>
          </Link>
          <p className="text-sm font-medium text-slate-500">Motion design, made direct.</p>
          <nav className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
            <Link to="/privacy" className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Terms & Conditions
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ───────── Terms & Conditions Page ───────── */
function TermsPage() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content:
        "By accessing or using Anim8, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our platform. These terms apply to all visitors, users, and others who access or use the service.",
    },
    {
      title: "2. Description of Service",
      content:
        "Anim8 provides a browser-based motion editor that converts video into editable vector animation. Users can export animations in formats including MP4, Animated SVG, and Lottie JSON. We reserve the right to modify, suspend, or discontinue any part of the service at any time.",
    },
    {
      title: "3. User Accounts",
      content:
        "To access certain features, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use.",
    },
    {
      title: "4. Subscriptions and Payments",
      content:
        "Some features of Anim8 require payment. All payments are processed securely through our payment partners. Subscriptions renew automatically unless cancelled. Lifetime deals are non-refundable and tied to a single user account.",
    },
    {
      title: "5. Intellectual Property",
      content:
        "You retain ownership of any content you create using Anim8. However, you grant us a limited license to use your content solely for the purpose of operating and improving the service. All Anim8 branding, software, and code remain our intellectual property.",
    },
    {
      title: "6. Acceptable Use",
      content:
        "You agree not to use Anim8 for any unlawful purpose, to distribute malware, to infringe intellectual property rights, or to attempt to disrupt our services. We reserve the right to suspend or terminate accounts that violate these rules.",
    },
    {
      title: "7. Limitation of Liability",
      content:
        "Anim8 is provided on an \"as is\" and \"as available\" basis. We do not guarantee that the service will be uninterrupted or error-free. To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages.",
    },
    {
      title: "8. Termination",
      content:
        "We may terminate or suspend your access to Anim8 immediately, without prior notice, for conduct that we believe violates these terms or is harmful to other users, us, or third parties.",
    },
    {
      title: "9. Governing Law",
      content:
        "These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Anim8 operates, without regard to its conflict of law provisions.",
    },
    {
      title: "10. Changes to Terms",
      content:
        "We may update these Terms and Conditions from time to time. Continued use of the platform after changes constitutes acceptance of the new terms. We encourage you to review this page periodically.",
    },
  ];

  return (
    <div className="min-h-screen bg-white font-display">
      <CustomCursor />
      <ParticleCanvas />
      <nav className="fixed top-0 left-0 right-0 z-50 glass-light">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <span>Anim8</span>
          </Link>
          <Link
            to="/"
            className="rounded-full border border-slate-200 px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50"
          >
            Back home
          </Link>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pt-40 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Legal</span>
          <h1 className="mt-4 font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-7xl">
            Terms & Conditions
          </h1>
          <p className="mt-6 text-base font-medium text-slate-500">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </motion.div>

        <div className="mt-16 space-y-12">
          {sections.map((section, i) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="font-display text-2xl font-black text-slate-900">{section.title}</h2>
              <p className="mt-3 text-base font-medium leading-relaxed text-slate-500">{section.content}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-16 rounded-[2rem] border border-slate-200 bg-slate-50 p-8"
        >
          <h2 className="font-display text-2xl font-black text-slate-900">Questions?</h2>
          <p className="mt-3 text-base font-medium leading-relaxed text-slate-500">
            If you have any questions about these Terms, please contact us at{" "}
            <a href="mailto:legal@anim8.studio" className="text-indigo-600 hover:underline">
              legal@anim8.studio
            </a>
            .
          </p>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <Link to="/" className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <span className="font-display">Anim8</span>
          </Link>
          <p className="text-sm font-medium text-slate-500">Motion design, made direct.</p>
          <nav className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
            <Link to="/privacy" className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Terms & Conditions
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ───────── Landing Page ───────── */
function LandingPage({ loading, setLoading }: { loading: boolean; setLoading: (v: boolean) => void }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!loading) {
      const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      lenisRef.current = lenis;

      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      return () => {
        lenis.destroy();
        gsap.ticker.remove(tick);
      };
    }
  }, [loading]);

  return (
    <>
      <AnimatePresence>{loading && <Preloader onDone={() => setLoading(false)} />}</AnimatePresence>
      <CustomCursor />
      {!loading && <ParticleCanvas />}
      <div className="relative min-h-screen bg-white font-display">
        <Navbar />
        <Hero />
        <Manifesto />
        <HorizontalScroll />
        <FeatureGrid />
        <Showcase />
        <Stats />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
        <Footer />
      </div>
    </>
  );
}

/* ───────── Main App ───────── */
export default function App() {
  const [loading, setLoading] = useState(true);

  return (
    <Routes>
      <Route path="/" element={<LandingPage loading={loading} setLoading={setLoading} />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/editor" element={<Editor />} />
      <Route path="/editor/:projectId" element={<Editor />} />
    </Routes>
  );
}
