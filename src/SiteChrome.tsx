import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Menu, X, Sparkles } from "lucide-react";
import { GoogleSignInButton } from "./auth/GoogleSignIn";

const navLinks = [
  { label: "Why Vekto", href: "#manifesto" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Showcase", href: "#showcase" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "/about" },
];

export function Navbar({ about = false }: { about?: boolean }) {
  const [visible, setVisible] = useState(about);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!about || !menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); }
      if (event.key !== "Tab") return;
      const items = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [about, menuOpen]);

  useEffect(() => {
    if (about) return;
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [about]);

  return (
    <>
      <motion.nav
        aria-label="Main navigation"
        initial={about ? false : { y: -100 }}
        animate={{ y: visible ? 0 : -100 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 glass-light"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href={about ? "/" : "#"} className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <span className="font-display">vekto</span>
          </a>
          <div className="hidden items-center gap-8 lg:flex">
            {navLinks.map((l) => (
              <a key={l.label} aria-current={about && l.href === "/about" ? "page" : undefined} href={about && l.href.startsWith("#") ? `/${l.href}` : l.href} className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                {l.label}
              </a>
            ))}
          </div>
          <GoogleSignInButton className="hidden rounded-full bg-slate-900 px-5 py-2 text-xs font-black uppercase tracking-widest text-white transition-transform hover:scale-105 lg:block">
            Get access
          </GoogleSignInButton>
          <button ref={menuButtonRef} aria-expanded={menuOpen} aria-controls="site-mobile-navigation" aria-label="Open navigation" onClick={() => setMenuOpen(true)} className="lg:hidden text-slate-900">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            id="site-mobile-navigation"
            role={about ? "dialog" : undefined}
            aria-modal={about ? true : undefined}
            aria-label="Site navigation"
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
                <a key={l.label} aria-current={about && l.href === "/about" ? "page" : undefined} href={about && l.href.startsWith("#") ? `/${l.href}` : l.href} onClick={() => setMenuOpen(false)} className="font-display text-4xl font-black text-slate-900">
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


export function Footer({ about = false }: { about?: boolean }) {
  const links = [
    { label: "About", to: "/about" },
    ...(about ? [{ label: "Contact", to: "/about#contact" }] : []),
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
          Vekto © 2026. All rights reserved | Made with Claude AI
        </p>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
          {links.map((link) => (
            link.label === "Contact" ? <a key={link.label} href="#contact" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">Contact</a> :
            <Link
              key={link.label}
              to={link.to}
              className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
          <a href="https://x.com/abhay8769" target="_blank" rel="noopener noreferrer" aria-label={`Abhay Solanki on ${about ? 'X' : 'Twitter'} (opens in a new tab)`} className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-900">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={about ? "M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.4L5.5 22H2.3l7.2-8.3L.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" : "M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"} />
            </svg>
          </a>
        </nav>
      </div>
    </footer>
  );
}

