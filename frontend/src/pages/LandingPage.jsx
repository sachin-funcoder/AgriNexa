import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import {
  TrendingUp,
  Sprout,
  PieChart,
  MapPin,
  CloudSun,
  ShieldCheck,
  Bot,
  Users,
  ArrowRight,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  DollarSign,
  Activity,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Canvas3DHero } from '../components/ui/Canvas3DHero';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const isKn = i18n.language?.startsWith('kn');
  const heroRef = useRef(null);
  const cardsRef = useRef(null);

  // Helper to guide unauthenticated visitors to login first with redirection
  const getDestination = (target) => (
    isAuthenticated ? target : { pathname: '/auth', state: { from: { pathname: target } } }
  );

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.hero-anim-item',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power2.out', clearProps: 'all' }
      );

      gsap.fromTo(
        '.feature-card-anim',
        { y: 20, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power2.out', clearProps: 'all' }
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const features = [
    {
      to: '/dashboard',
      icon: TrendingUp,
      title: isKn ? 'ಮಂಡಿ ಮಾರುಕಟ್ಟೆ ದರಗಳು' : 'Live Mandi Intelligence',
      desc: isKn ? 'ಕರ್ನಾಟಕದ ಪ್ರಮುಖ ಎಪಿಎಂಸಿ ಮಂಡಿಗಳ ದಿನನಿತ್ಯದ ಮಾದರಿ, ಕನಿಷ್ಠ ಹಾಗೂ ಗರಿಷ್ಠ ದರಗಳು.' : 'Real-time spot prices, modal rates, and daily arrival volumes across Karnataka APMCs.',
      badge: 'APMC Live'
    },
    {
      to: '/price-trends',
      icon: Activity,
      title: isKn ? '14-ದಿನಗಳ ಎಐ ದರ ಭವಿಷ್ಯ' : '14-Day Price Forecasting',
      desc: isKn ? 'ಅನಿಶ್ಚಿತತೆಯ ಶ್ರೇಣಿಗಳೊಂದಿಗೆ ಮುಂಬರುವ ಬೆಲೆ ಪ್ರವೃತ್ತಿ ಮುನ್ಸೂಚನೆ.' : 'Confidence interval projections predicting modal price momentum and market glut warnings.',
      badge: 'Predictive AI'
    },
    {
      to: '/mandi-compare',
      icon: MapPin,
      title: isKn ? 'ಸ್ಮಾರ್ಟ್ ಮಂಡಿ ಹೋಲಿಕೆ' : 'Smart Mandi Comparison',
      desc: isKn ? 'ಸಾರಿಗೆ ಮತ್ತು ಮಾರುಕಟ್ಟೆ ವೆಚ್ಚ ಕಳೆದು ಅತ್ಯುತ್ತಮ ನಿವ್ವಳ ಲಾಭ ನೀಡುವ ಮಂಡಿ ಹುಡುಕಿ.' : 'Net-return ranking deducting road freight and APMC cess to maximize pocket returns.',
      badge: 'Freight Optimized'
    },
    {
      to: '/harvest-split',
      icon: PieChart,
      title: isKn ? 'ಹಾರ್ವೆಸ್ಟ್ ಸ್ಪ್ಲಿಟ್ ಆಪ್ಟಿಮೈಜರ್' : 'Multi-Mandi Harvest Split',
      desc: isKn ? 'ತಕ್ಷಣ ಮಾರಾಟ vs ಗೋದಾಮಿನಲ್ಲಿ ಶೇಖರಣೆ ಸಮತೋಲನಗೊಳಿಸುವ ಗಣಿತ ಮಾದರಿ.' : 'LP allocation model balancing immediate local sales against cold storage holding.',
      badge: 'LP Solver'
    },
    {
      to: '/crop-advisor',
      icon: CloudSun,
      title: isKn ? 'ಹವಾಮಾನ ಮತ್ತು ಬೆಳೆ ಸಲಹೆಗಾರ' : 'Climate & Crop Advisor',
      desc: isKn ? 'ಸ್ಥಳೀಯ ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ ಮತ್ತು ಮಳೆ ಮುನ್ಸೂಚನೆ ಆಧಾರಿತ ಬೆಳೆ ಶಿಫಾರಸುಗಳು.' : 'Soil suitability scoring and IMD multi-horizon weather outlooks calibrated for Karnataka.',
      badge: 'UAS Bangalore'
    },
    {
      to: '/prediction-protection',
      icon: ShieldCheck,
      title: isKn ? '35% ಎಐ ಬೆಲೆ ರಕ್ಷಣೆ' : 'AI Prediction Protection',
      desc: isKn ? 'ಎಐ ಗುರಿಗಿಂತ ಮಾರುಕಟ್ಟೆ ಕುಸಿದಾಗ ಪ್ರಸ್ತಾವಿತ 35% ಪರಿಶೀಲಿಸಿದ ನಷ್ಟ ರಕ್ಷಣೆ.' : 'Proposed 35% verified eligible loss buffer mitigating sudden market price crashes.',
      badge: 'Farmer Safety Net'
    },
    {
      to: '/chat',
      icon: Bot,
      title: isKn ? 'ಕೃಷಿ AI ಧ್ವನಿ ಸಹಾಯಕ' : 'Multilingual Voice AI',
      desc: isKn ? 'ಕನ್ನಡ ಮತ್ತು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ಪಡೆಯಿರಿ.' : 'Speak or type in Kannada and English to query prices, transport, and cultivation advice.',
      badge: 'Kannada + English'
    },
    {
      to: '/community',
      icon: Users,
      title: isKn ? 'ರೈತ ಸಮುದಾಯ ಮತ್ತು ಪಾರದರ್ಶಕತೆ' : 'Community & Transparency',
      desc: isKn ? 'ಮಂಡಿ ಅನುಭವಗಳು, ತೂಕದ ಸಮಸ್ಯೆಗಳು ಹಾಗೂ ಮಾರುಕಟ್ಟೆ ದೂರುಗಳ ವೇದಿಕೆ.' : 'Peer-to-peer farmer discussions, mandi experiences, and transparent grievance logging.',
      badge: 'Farmer Forum'
    }
  ];

  return (
    <div className="space-y-16 py-6" ref={heroRef}>
      {/* ─── HERO SECTION ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white via-emerald-50/40 to-slate-50 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950 border border-slate-200/90 dark:border-slate-800/80 p-6 sm:p-12 lg:p-16 shadow-xl dark:shadow-2xl transition-colors">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 dark:from-emerald-900/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Typography & CTAs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="hero-anim-item inline-flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                AgriNexa AI 2.0 • Karnataka APMC Intelligence
              </span>
              <StatusBadge variant="success" dot size="sm">
                FastAPI Live
              </StatusBadge>
            </div>

            <h1 className="hero-anim-item text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
              {isKn ? (
                <>ಉತ್ತಮ ನಿರ್ಧಾರಗಳಿಂದ <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 dark:from-emerald-400 dark:via-teal-300 dark:to-amber-300">ಸ್ಮಾರ್ಟ್ ಕೃಷಿ</span> ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.</>
              ) : (
                <>Smarter Farming Starts With <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 dark:from-emerald-400 dark:via-teal-300 dark:to-amber-300">Better Decisions.</span></>
              )}
            </h1>

            <p className="hero-anim-item text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg max-w-2xl leading-relaxed">
              {isKn
                ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ, ಕೊಯ್ಲು ಯೋಜನೆ ರೂಪಿಸಿ, ಮಂಡಿಗಳನ್ನು ಹೋಲಿಕೆ ಮಾಡಿ ಮತ್ತು AgriNexa AI ಜೊತೆಗೆ ಲಾಭದಾಯಕ ಕೃಷಿ ನಿರ್ಧಾರಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.'
                : 'Understand market prices, plan your harvest, compare mandis, and make more informed farming decisions with AgriNexa AI.'}
            </p>

            <div className="hero-anim-item flex flex-wrap items-center gap-4 pt-2">
              <Link to={getDestination('/dashboard')}>
                <PrimaryButton size="lg" icon={TrendingUp}>
                  {isKn ? 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಿರಿ' : 'Open Market Command Center'}
                </PrimaryButton>
              </Link>

              <Link to={getDestination('/chat')}>
                <SecondaryButton size="lg" icon={Bot}>
                  {isKn ? 'ಕೃಷಿ AI ಜೊತೆ ಮಾತನಾಡಿ' : 'Try Voice Assistant'}
                </SecondaryButton>
              </Link>
            </div>

            {/* Quick Metrics Bar */}
            <div className="hero-anim-item grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800/80">
              <div>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">8+</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">{isKn ? 'ಕರ್ನಾಟಕ ಎಪಿಎಂಸಿಗಳು' : 'Karnataka APMCs'}</span>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">14-Day</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">{isKn ? 'ದರ ಮುನ್ಸೂಚನೆ' : 'Price Forecasting'}</span>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">35%</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">{isKn ? 'ಪ್ರಸ್ತಾವಿತ ರಕ್ಷಣೆ' : 'AI Protection Buffer'}</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Canvas / Visual Hero */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <Canvas3DHero className="w-full max-w-md mx-auto" />
          </div>
        </div>
      </section>

      {/* ─── SUITE MODULES SHOWCASE ─────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">
              Integrated Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isKn ? 'ರೈತರಿಗಾಗಿ ಸಂಪೂರ್ಣ ತಂತ್ರಜ್ಞಾನ ವ್ಯವಸ್ಥೆ' : 'Complete Agricultural Intelligence Suite'}
            </h2>
          </div>
          <Link
            to={getDestination('/dashboard')}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 inline-flex items-center gap-1 group"
          >
            <span>{isKn ? 'ಎಲ್ಲಾ ಸೌಲಭ್ಯಗಳು' : 'Explore All Features'}</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" ref={cardsRef}>
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                to={getDestination(item.to)}
                className="feature-card-anim group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-5 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-lg dark:hover:shadow-emerald-950/20 hover:-translate-y-1 flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-slate-800/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-slate-700/80 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/60 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 group-hover:border-emerald-500/40">
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  <span>{isKn ? 'ಪ್ರವೇಶಿಸಿ' : 'Launch Feature'}</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ─── FARMER IMPACT SECTION ─────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-900/40 p-8 sm:p-12 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center sm:text-left">
          <div className="space-y-2">
            <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold text-lg mb-3">
              1
            </span>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {isKn ? 'ನಿಖರ ಸಾರಿಗೆ ಲೆಕ್ಕಾಚಾರ' : 'Freight & Mandi Arbitrage'}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isKn
                ? 'ಸ್ಥಳೀಯ ಮಂಡಿಗಿಂತ ಬೆಂಗಳೂರು ಅಥವಾ ಕೋಲಾರ ಮಾರುಕಟ್ಟೆಗೆ ಸಾಗಾಟ ಮಾಡಿದರೆ ಎಷ್ಟು ನಿವ್ವಳ ಲಾಭ ಉಳಿಯುತ್ತದೆ ಎಂದು ತಿಳಿಯಿರಿ.'
                : 'Instantly calculate if transporting produce to Bengaluru, Kolar, or Hubballi yields higher net returns after diesel freight.'}
            </p>
          </div>

          <div className="space-y-2">
            <span className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 border border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-400 flex items-center justify-center font-bold text-lg mb-3">
              2
            </span>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {isKn ? 'ಕೊಯ್ಲು ವಿಭಜನೆ ಮತ್ತು ಶೇಖರಣೆ' : 'Harvest Conservation LP'}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isKn
                ? 'ಎಲ್ಲಾ ಸರಕನ್ನು ಒಂದೇ ದಿನ ಮಾರದೆ, ಬೆಲೆ ಹೆಚ್ಚಾಗುವ ನಿರೀಕ್ಷೆಯ ದಿನಕ್ಕೆ ಸರಿಯಾಗಿ ಶೇಖರಣೆ ಮಾಡುವ ಯೋಜನೆ.'
                : 'Linear programming solver optimizes multi-day sales across mandis while preventing inventory spoilage and glut crashes.'}
            </p>
          </div>

          <div className="space-y-2">
            <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-400 flex items-center justify-center font-bold text-lg mb-3">
              3
            </span>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {isKn ? 'ಧ್ವನಿ ಮೂಲಕ ಕೃಷಿ ಮಾಹಿತಿ' : 'Voice-First AI Assistant'}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isKn
                ? 'ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ: "ಇವತ್ತು ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?" ಎಂದು ಕೇಳಿ ತಕ್ಷಣ ಉತ್ತರ ಪಡೆಯಿರಿ.'
                : 'Kannada and English speech recognition allowing farmers with limited technical literacy to ask questions naturally.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

