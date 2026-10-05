import { useState, useEffect, useRef } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Dashboard from "./Dashboard";
import PaidAccessGate from "./auth/PaidAccessGate";
import Editor from "./Editor";
import { GoogleSignInButton, GoogleSignInProvider, useGoogleSignIn } from './auth/GoogleSignIn';
import { createCheckout, type PaidPlan } from './lib/billing';
import { getFirebaseAuth } from './lib/firebase';
import {
  Sparkles,
  ArrowRight,
  Menu,
  X,
  Check,
  Plus,
  Minus,
  Wand2,
  Palette,
  MousePointer2,
  Video,
  Rocket,
  Layers,
  FileCode,
  Upload,
  Download,
  Crown,
  Infinity as InfinityIcon,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ───────── Types ───────── */
interface Plan {
  id: 'pro' | 'lifetime';
  name: string;
  price: string;
  period: string;
  features: { label: string; comingSoon?: boolean }[];
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
  { label: "Why Vekto", href: "#manifesto" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Showcase", href: "#showcase" },
  { label: "Pricing", href: "#pricing" },
];

const horizontalCards = [
  { title: "Import", subtitle: "Start with the files you have", icon: Upload },
  { title: "Trace", subtitle: "Turn pixels into editable paths", icon: Wand2 },
  { title: "Edit", subtitle: "Get the details how you want them", icon: MousePointer2 },
  { title: "Animate", subtitle: "Set the pace with keyframes", icon: Layers },
  { title: "Export", subtitle: "Take your work with you", icon: Download },
];

const features3D = [
  { icon: Wand2, title: "PNG to SVG", desc: "Have a logo or illustration as a PNG? Turn it into SVG paths you can edit." },
  { icon: Palette, title: "Make it your own", desc: "Change a color, move a shape, or add some text. The small details are yours to adjust." },
  { icon: Layers, title: "A timeline you can see", desc: "Set keyframes, adjust the timing, and play it back until the movement feels right." },
  { icon: Video, title: "Work with your clips", desc: "Import a video or GIF up to 10 seconds long, then inspect and vectorize its frames." },
  { icon: Upload, title: "Keep your files close", desc: "Find your uploads and saved projects in one workspace, ready for the next round of changes." },
  { icon: Download, title: "Export when you're ready", desc: "Download an SVG, animated SVG, or Lottie JSON file to use in your next project." },
];

const exportCards: ExportCard[] = [
  { num: "01", title: "SVG", desc: "Save a still frame as a vector file. Handy for logos, illustrations, and icons.", icon: FileCode },
  { num: "02", title: "Animated SVG", desc: "Keep the movement in an SVG file you can use on the web.", icon: FileCode },
  { num: "03", title: "Lottie JSON", desc: "Export your animation for projects that use a Lottie player.", icon: Rocket },
];

const useCases = [
  { title: "Give that logo a second life.", description: "Only have a PNG? Trace it, tweak the colors, and save an SVG you can keep working with.", audience: "For brand designers", icon: Palette },
  { title: "Try a little movement.", description: "Start with a shape or some text. Add a few keyframes and play it back. Sometimes that's all an idea needs.", audience: "For UI and motion designers", icon: Layers },
  { title: "One more change? No problem.", description: "Reopen your saved project, adjust the detail you missed, and export a fresh version. No need to start over.", audience: "For everyday design work", icon: MousePointer2 },
];

const pricingFeatures = [
  { label: "Unlimited image + video vectorization" },
  { label: "Animate with your AI via MCP + CLI", comingSoon: true },
  { label: "Keyframes, timing & text animation" },
  { label: "Layers, shapes & color editing" },
  { label: "Editable SVG" },
  { label: "SVG & Lottie exports" },
];

const pricingPlans: Plan[] = [
  {
    id: 'pro',
    name: "Pro",
    price: "$5",
    period: "/ month",
    features: pricingFeatures,
    cta: "Subscribe for $5/mo",
    popular: false,
    badge: "",
    description: "Pay month to month while you're working on a project.",
  },
  {
    id: 'lifetime',
    name: "Lifetime",
    price: "$29",
    period: "one-time",
    features: pricingFeatures,
    cta: "Get Lifetime for $29",
    popular: true,
    badge: "Best value",
    description: "Pay once and come back whenever you have something to make.",
  },
];

const faqs: FAQItem[] = [
  { question: "Do I need to know how to code?", answer: "No. You can edit shapes, colors, text, and keyframes right in the browser. Using the exported files in an app or website depends on how you're building it." },
  { question: "What can I bring into Vekto?", answer: "Convert PNG artwork with the PNG-to-SVG tool. In the editor, you can import SVGs, Lottie JSON, and videos or GIFs up to 10 seconds long. Some imported features may not be supported; the editor flags those for you." },
  { question: "What can I download?", answer: "An SVG snapshot, an animated SVG, or Lottie JSON. You can also save an editable project file to come back to later." },
  { question: "Can I animate with my AI tools?", answer: "MCP and CLI access are coming soon. For now, you can create and adjust motion with the editor's keyframes and timeline." },
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
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Getting things ready</p>
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
            <span className="font-display">vekto</span>
          </a>
          <div className="hidden items-center gap-8 lg:flex">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                {l.label}
              </a>
            ))}
          </div>
          <GoogleSignInButton className="hidden rounded-full bg-slate-900 px-5 py-2 text-xs font-black uppercase tracking-widest text-white transition-transform hover:scale-105 lg:block">
            Get access
          </GoogleSignInButton>
          <button aria-label="Open navigation" onClick={() => setMenuOpen(true)} className="lg:hidden text-slate-900">
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
            className="fixed inset-0 z-[60] overflow-y-auto bg-white lg:hidden"
          >
            <div className="flex min-h-full flex-col items-center justify-center gap-8 py-20">
              <button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="absolute top-6 right-6 text-slate-900">
                <X className="h-8 w-8" />
              </button>
              {navLinks.map((l) => (
                <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="font-display text-4xl font-black text-slate-900">
                  {l.label}
                </a>
              ))}
              <GoogleSignInButton className="rounded-full bg-slate-900 px-6 py-3 text-white">Get access</GoogleSignInButton>
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
          Turn your artwork into editable vectors, add a little movement, and export it for your next project. All in your browser.
        </p>

        <div className="hero-cta mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <GoogleSignInButton className="group flex items-center gap-3 rounded-full bg-slate-900 px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/15 transition-transform hover:scale-105">
            Start creating
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </GoogleSignInButton>
          {/* <button className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-8 py-4 text-sm font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50"> */}
            {/* <Play className="h-4 w-4 fill-current" />
            Watch film
          {/* </button> */}
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
        <p className="mt-1 text-sm font-bold text-slate-900">Your browser. Your canvas.</p>
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
    "You've already got the artwork. You just want to change a color, tidy up a shape, or add a little movement. That shouldn't mean starting from scratch. Bring your files into Vekto, work on the details, and export something you can actually use.";

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
      const media = gsap.matchMedia();
      media.add('(min-width: 1024px)', () => gsap.to(track, {
        x: () => -(track.scrollWidth - window.innerWidth),
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: () => `+=${track.scrollWidth - window.innerWidth}`,
          invalidateOnRefresh: true,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      }));
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
            From file to finished.
          </h2>
          <p className="mt-6 max-w-md text-base font-medium text-slate-500">
            Bring in artwork, turn it into vectors, and adjust the details. Add motion when you need it.
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
            Tools you'll actually use
          </h2>
          <p className="max-w-sm text-base font-medium text-slate-500">
            A place to work on your artwork, try out motion, and get the file you need.
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
      const media = gsap.matchMedia();
      media.add('(min-width: 1024px)', () => gsap.from(panelRef.current, {
        scale: 0.85,
        borderRadius: "3rem",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=100%",
          scrub: true,
          pin: true,
        },
      }));
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
            Your work.
            <br />
            Ready to use.
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

/* ───────── Product facts ───────── */
function ProductFacts() {
  return (
    <section className="relative z-10 border-y border-slate-100 bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 text-center md:grid-cols-3">
          {[
            { value: "SVG", label: "Editable vector exports" },
            { value: "Lottie", label: "Animation files" },
            { value: "Web", label: "Work in your browser" },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display text-6xl font-black text-slate-900 lg:text-7xl">{s.value}</p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.2em] text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Everyday use cases ───────── */
function UseCaseCard({ item, i }: { item: typeof useCases[0]; i: number }) {
  return (
    <div className="marquee-card group w-[340px] shrink-0 rounded-[2rem] border border-slate-200 bg-slate-50 p-8 hover:border-indigo-200 hover:bg-white md:w-[420px]">
      <item.icon className="h-10 w-10 text-indigo-400" />
      <h3 className="mt-6 font-display text-xl font-black leading-snug text-slate-900">{item.title}</h3>
      <p className="mt-4 text-base font-medium leading-relaxed text-slate-600">{item.description}</p>
      <p className="mt-8 text-sm font-bold text-indigo-600">{item.audience}</p>
      <span className="mt-6 block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">0{i + 1}</span>
    </div>
  );
}

function UseCases() {
  const duplicated = [...useCases, ...useCases, ...useCases];

  return (
    <section id="use-cases" className="relative z-10 overflow-hidden bg-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="max-w-2xl font-display text-5xl font-black leading-[0.95] text-slate-900 md:text-7xl">
          For the things you're making.
        </h2>
        <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-slate-500">A logo that needs a refresh. An icon that could use some motion. A small change before you send the final file.</p>
      </div>

      <div className="marquee-container relative mt-16">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent md:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent md:w-32" />

        <div className="marquee-track gap-6 pl-6">
          {duplicated.map((item, i) => (
            <UseCaseCard key={`${item.title}-${i}`} item={item} i={(i % useCases.length) + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Pricing ───────── */
function Pricing() {
  const login = useGoogleSignIn();
  const [pendingPlan, setPendingPlan] = useState<PaidPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const pending = useRef(false);
  const begin = async (plan: PaidPlan) => {
    if (pending.current) return;
    pending.current = true; setPendingPlan(plan); setCheckoutError('');
    try { await createCheckout(plan); }
    catch (cause) { setCheckoutError(cause instanceof Error ? cause.message : 'Checkout could not be created.'); }
    finally { pending.current = false; setPendingPlan(null); }
  };
  const checkout = (plan: PaidPlan) => {
    setCheckoutError('');
    try { if (getFirebaseAuth().currentUser) void begin(plan); else login.signIn(() => begin(plan)); }
    catch (cause) { setCheckoutError(cause instanceof Error ? cause.message : 'Sign in to continue.'); }
  };
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
              className={`pricing-plan flex min-w-0 flex-col rounded-[2.5rem] border bg-white p-8 transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 md:p-10 ${plan.popular ? "border-violet-400 shadow-lg shadow-violet-500/10 hover:border-violet-500" : "border-slate-200 hover:border-indigo-200"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-2xl font-black text-slate-900 md:text-3xl">{plan.name}</h3>
                {plan.badge && <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-violet-700"><Crown className="h-4 w-4 fill-current" />{plan.badge}</span>}
              </div>
              <p className="mt-2 text-base font-medium leading-relaxed text-slate-500">{plan.description}</p>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-6xl font-black text-slate-900">{plan.price}</span>
                <span className="text-base font-bold text-slate-500">{plan.period}</span>
              </div>

              <ul className="mt-8 space-y-4">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-3 text-sm font-bold text-slate-700">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-violet-600 p-1 text-white" />
                    <span className="min-w-0">{f.label}{f.comingSoon && <span className="pricing-coming-soon ml-2 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700"><Sparkles className="h-3 w-3" />Coming soon</span>}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 mb-4">
                {plan.popular && <p className="flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-600"><InfinityIcon className="h-5 w-5 shrink-0" />Pay once. Use forever.</p>}
              </div>
              <button
                type="button" onClick={() => checkout(plan.id)} disabled={!!pendingPlan || login.busy} aria-busy={pendingPlan === plan.id || login.busy}
                className={`mt-auto flex w-full items-center justify-center gap-3 rounded-2xl px-3 py-4 text-sm font-black transition-transform hover:scale-[1.02] ${
                  plan.popular
                    ? "bg-slate-900 text-white"
                    : "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                }`}
              >
                {pendingPlan === plan.id ? 'Opening checkout…' : plan.cta}<ArrowRight className="h-5 w-5 shrink-0" />
              </button>
            </div>
          ))}
        </div>
        {checkoutError && <p role="alert" className="mt-6 text-center text-sm font-medium text-red-600">{checkoutError}</p>}
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
          A few questions
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
          <h2 className="relative z-10 mx-auto max-w-4xl whitespace-nowrap font-display text-[clamp(1.25rem,5.8vw,6rem)] font-black leading-[0.95] text-white">
            Got an idea?
          </h2>
          <p className="relative z-10 mx-auto mt-6 max-w-lg text-base font-medium leading-relaxed text-slate-300">Bring a file you already have, or start with an empty canvas. See where it takes you.</p>
          <div className="relative z-10 mt-10 flex flex-col items-center justify-center">
            <GoogleSignInButton className="group flex items-center gap-3 rounded-full bg-white px-8 py-4 text-sm font-black text-slate-900 shadow-xl shadow-slate-900/20 transition-transform hover:scale-105">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </GoogleSignInButton>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Footer ───────── */
function Footer() {
  const links = [
    { label: "Privacy Policy", to: "/privacy" },
    { label: "Terms & Conditions", to: "/terms" },
  ];

  return (
    <footer className="relative z-10 border-t border-slate-200 bg-slate-50 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <Link to="/" className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          <span className="font-display">vekto</span>
        </Link>

        <p className="text-sm font-medium text-slate-500">
          Vekto © 2026. All rights reserved.
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
          <a href="https://x.com/abhay8769" target="_blank" rel="noopener noreferrer" aria-label="Abhay Solanki on Twitter (opens in a new tab)" className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-900">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
            </svg>
          </a>
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
        <>When you use Vekto, we may collect information you provide directly to us, including your name, email address, and account information.<br /><br />When you create or use projects, we may store project information and content associated with your account, including SVG files, animations, images, videos, and other assets you upload or create.<br /><br />We may also collect limited technical and usage information, such as your IP address, browser type, device information, and information about how you use Vekto, where necessary to operate, secure, and improve the service.</>,
    },
    {
      title: "2. How We Use Your Information",
      content:
        <>We use collected information to:<br /><br />
          • Provide and operate Vekto<br />
          • Create and manage your account<br />
          • Store and synchronize your projects and assets<br />
          • Process payments and purchases<br />
          • Provide customer support<br />
          • Improve and maintain Vekto<br />
          • Detect, prevent, and address fraud, abuse, and security issues<br />
          • Communicate with you about your account, purchases, and important service updates<br /><br />
          We do not use your uploaded project content to publicly display or distribute it without your permission.</>,
    },
    {
      title: "3. How We Store Your Data",
      content:
        <>Vekto uses third-party infrastructure providers to operate the service.<br /><br />
          Depending on the type of data, information may be stored or processed using services such as:<br /><br />
          • <strong>Firebase</strong> for authentication and project/account metadata<br />
          • <strong>Cloudflare R2</strong> for uploaded files and project assets<br />
          • <strong>Vercel</strong> for application hosting and deployment<br />
          • <strong>Payment providers</strong> for processing purchases and subscriptions<br /><br />
          These providers may process information according to their own privacy policies and applicable terms.</>,
    },
    {
      title: "4. Sharing Your Information",
      content:
        <>We do not sell your personal information.<br /><br />We may share information with service providers that help us operate Vekto, such as authentication, cloud storage, hosting, analytics, and payment providers.<br /><br />We may also disclose information when required by law, to protect our rights or users, or to prevent fraud, abuse, or security threats.</>,
    },
    {
      title: "5. Data Security",
      content:
        <>We use reasonable technical and organizational measures designed to protect your information from unauthorized access, loss, misuse, or disclosure.<br /><br />However, no method of transmitting or storing information over the internet is completely secure, and we cannot guarantee absolute security.</>,
    },
    {
      title: "6. Your Data and Projects",
      content:
        <>You retain ownership of the content and projects you create or upload to Vekto, subject to any rights granted to us that are necessary to provide the service.<br /><br />You may request deletion of your account and associated personal information by contacting us.<br /><br />Some information may need to be retained where required by law, for legitimate business purposes, or to prevent fraud and abuse.</>,
    },
    {
      title: "7. Cookies and Analytics",
      content:
        <>Vekto may use cookies and similar technologies that are necessary to operate the website, maintain sessions, understand usage, and improve the service.<br /><br />Where applicable, you may control certain cookies through your browser settings.</>,
    },
    {
      title: "8. Payments",
      content:
        <>Payments for Vekto subscriptions or lifetime purchases are processed by third-party payment providers.<br /><br />Vekto does not directly store your complete payment card details. Payment providers may collect and process payment information according to their own privacy policies.</>,
    },
    {
      title: "9. Children's Privacy",
      content:
        <>Vekto is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.<br /><br />If you believe that a child has provided us with personal information, please contact us so we can take appropriate action.</>,
    },
    {
      title: "10. Changes to This Policy",
      content:
        <>We may update this Privacy Policy from time to time.<br /><br />When we make changes, we will update the Effective Date at the top of this page. If we make significant changes, we may provide additional notice where appropriate.</>,
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
            <span className="font-display">vekto</span>
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
            Effective Date: October 5, 2026
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
            If you have questions about this Privacy Policy, your personal information, or a data deletion request, please contact us at:<br /><br />
            <a href="mailto:solankiabhay722@gmail.com" className="text-indigo-600 hover:underline">
              <strong>solankiabhay722@gmail.com</strong>
            </a>
          </p>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <Link to="/" className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <span className="font-display">vekto</span>
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
    { title: "1. Acceptance of Terms", content: <>{"By accessing or using Vekto, you agree to be bound by these Terms & Conditions. If you do not agree with these terms, please do not use Vekto."}<br /><br />{"These Terms apply to all visitors, users, and customers who access or use the Vekto service."}</> },
    { title: "2. Description of Vekto", content: <>{"Vekto is a browser-based creative tool for creating, editing, vectorizing, and animating digital content."}<br /><br />{"Vekto may provide features including:"}<br /><br />{"? Image and video vectorization"}<br />{"? Editable SVG creation and editing"}<br />{"? SVG animation"}<br />{"? Lottie animation and export"}<br />{"? Keyframes and animation controls"}<br />{"? Spring and text animations"}<br />{"? Camera motion and character rigging"}<br />{"? Project storage and management"}<br />{"? Other features that may be added or changed over time"}<br /><br />{"We may modify, improve, suspend, or discontinue features of Vekto at any time."}</> },
    { title: "3. User Accounts", content: <>{"Some Vekto features require an account."}<br /><br />{"You are responsible for:"}<br /><br />{"? Providing accurate account information"}<br />{"? Keeping your account credentials secure"}<br />{"? Maintaining the security of your account"}<br />{"? All activity performed through your account"}<br /><br />{"You must notify us if you believe your account has been accessed without authorization."}</> },
    { title: "4. Plans, Payments and Subscriptions", content: <>{"Vekto currently offers paid access through monthly and lifetime plans."}<br /><br />{"Monthly Plan"}<br /><br />{"The monthly plan costs $5 per month."}<br /><br />{"The subscription may automatically renew each month unless cancelled before the next billing period."}<br /><br />{"Lifetime Plan"}<br /><br />{"The lifetime plan costs $29 as a one-time payment."}<br /><br />{"A lifetime purchase provides continued access to the Vekto features included with the lifetime plan for the lifetime of the Vekto service, subject to these Terms."}<br /><br />{"Lifetime access does not guarantee that every future feature introduced by Vekto will be included unless we explicitly state otherwise."}<br /><br />{"Payments"}<br /><br />{"Payments are processed through third-party payment providers. Vekto does not directly store your complete payment card information."}<br /><br />{"Prices may change in the future. Any changes will not affect a payment that has already been completed unless otherwise required by law."}</> },
    { title: "5. Refunds and Cancellations", content: <>{"You may cancel your monthly subscription at any time. Cancellation will normally prevent the next renewal while allowing access to continue through the current paid billing period."}<br /><br />{"Because lifetime purchases provide permanent access to the service, lifetime purchases are generally non-refundable, except where a refund is required by applicable law or where Vekto chooses to provide one."}<br /><br />{"If you experience a billing issue, contact us at solankiabhay722@gmail.com."}</> },
    { title: "6. Your Content and Intellectual Property", content: <>{"You retain ownership of the content and projects that you create or upload to Vekto."}<br /><br />{"This may include:"}<br /><br />{"? SVG files"}<br />{"? Images"}<br />{"? Videos"}<br />{"? Animations"}<br />{"? Lottie files"}<br />{"? Designs"}<br />{"? Other project assets"}<br /><br />{"You grant Vekto a limited, non-exclusive license to process, store, transmit, and display your content only as necessary to provide and operate the service."}<br /><br />{"Vekto does not claim ownership of your content."}<br /><br />{"Vekto's software, website, branding, logos, design, and other original materials remain the property of Vekto or their respective owners."}</> },
    { title: "7. Third-Party Content", content: <>{"You are responsible for ensuring that you have the necessary rights, licenses, and permissions for any content you upload, import, convert, or use through Vekto."}<br /><br />{"You must not use Vekto to process or distribute content that infringes another person's copyright, trademark, privacy rights, or other intellectual property rights."}</> },
    { title: "8. Acceptable Use", content: <>{"You agree not to:"}<br /><br />{"? Use Vekto for unlawful purposes"}<br />{"? Upload malware, viruses, or other harmful code"}<br />{"? Attempt to gain unauthorized access to Vekto or another user's account"}<br />{"? Interfere with or disrupt the service"}<br />{"? Abuse, overload, or attack our infrastructure"}<br />{"? Reverse engineer or attempt to extract source code from the service where prohibited by law"}<br />{"? Use Vekto to infringe the rights of others"}<br />{"? Use the service to create or distribute content that violates applicable laws"}<br /><br />{"We may suspend or terminate accounts that violate these Terms or create a risk to Vekto, our users, or third parties."}</> },
    { title: "9. Service Availability", content: <>{"Vekto is provided on an \"as is\" and \"as available\" basis."}<br /><br />{"We do not guarantee that:"}<br /><br />{"? Vekto will always be available"}<br />{"? The service will always be error-free"}<br />{"? All features will always work without interruption"}<br />{"? Uploaded content will never be lost or corrupted"}<br /><br />{"We recommend keeping independent backups of important projects and exported files."}</> },
    { title: "10. Data and Project Storage", content: <>{"Vekto may use third-party infrastructure providers to store account information, project metadata, uploaded files, and other assets."}<br /><br />{"While we take reasonable measures to protect stored data, you acknowledge that no online storage system can guarantee absolute security or permanent availability."}<br /><br />{"Our handling of personal information is described in our Privacy Policy."}</> },
    { title: "11. Termination", content: <>{"You may stop using Vekto at any time."}<br /><br />{"We may suspend or terminate your access if you materially violate these Terms, engage in abusive or unlawful activity, or create a security or operational risk."}<br /><br />{"Where appropriate, we may provide notice before termination."}<br /><br />{"Termination does not automatically remove obligations that by their nature should continue after termination."}</> },
    { title: "12. Limitation of Liability", content: <>{"To the fullest extent permitted by applicable law, Vekto and its operators will not be liable for indirect, incidental, special, consequential, or exemplary damages arising from your use of, or inability to use, the service."}<br /><br />{"This includes loss of data, projects, revenue, profits, or business opportunities, to the extent permitted by law."}<br /><br />{"Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited."}</> },
    { title: "13. Indemnification", content: <>{"To the extent permitted by applicable law, you agree to be responsible for claims, losses, liabilities, and expenses arising from your unlawful use of Vekto, your violation of these Terms, or your infringement of the rights of another person or entity."}</> },
    { title: "14. Governing Law", content: <>{"These Terms shall be governed by and interpreted according to the applicable laws of India, without regard to conflict-of-law principles."}<br /><br />{"Any disputes will be subject to the jurisdiction of the courts having appropriate jurisdiction in India."}</> },
    { title: "15. Changes to These Terms", content: <>{"We may update these Terms & Conditions from time to time."}<br /><br />{"When changes are made, we will update the Last updated date at the top of this page."}<br /><br />{"Your continued use of Vekto after updated Terms become effective constitutes acceptance of the revised Terms, to the extent permitted by applicable law."}</> },
  ];

  return (
    <div className="min-h-screen bg-white font-display">
      <CustomCursor />
      <ParticleCanvas />
      <nav className="fixed top-0 left-0 right-0 z-50 glass-light">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <span className="font-display">vekto</span>
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
            Last updated: October 5, 2026
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
            If you have any questions about these Terms &amp; Conditions, payments, refunds, or your account, please contact us at:<br /><br />
            <a href="mailto:solankiabhay722@gmail.com" className="text-indigo-600 hover:underline">
              solankiabhay722@gmail.com
            </a>
          </p>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <Link to="/" className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <span className="font-display">vekto</span>
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
        <ProductFacts />
        <UseCases />
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
    <GoogleSignInProvider><Routes>
      <Route path="/" element={<LandingPage loading={loading} setLoading={setLoading} />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/dashboard" element={<PaidAccessGate pricing={<Pricing />}><Dashboard /></PaidAccessGate>} />
      <Route path="/editor" element={<PaidAccessGate pricing={<Pricing />}><Editor /></PaidAccessGate>} />
      <Route path="/editor/:projectId" element={<PaidAccessGate pricing={<Pricing />}><Editor /></PaidAccessGate>} />
    </Routes></GoogleSignInProvider>
  );
}
