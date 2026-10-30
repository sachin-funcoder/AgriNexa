import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function KPIStatCard({
  title,
  value,
  prefix = '',
  suffix = '',
  trend,
  trendDirection = 'neutral', // 'up' | 'down' | 'neutral'
  subtitle,
  icon: Icon,
  variant = 'default',
  className = '',
}) {
  const numberRef = useRef(null);
  const numericValue = typeof value === 'number' ? value : parseFloat(value);
  const isNumber = !isNaN(numericValue);

  useEffect(() => {
    if (!isNumber || !numberRef.current) return;

    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      numberRef.current.innerText = `${prefix}${numericValue.toLocaleString('en-IN')}${suffix}`;
      return;
    }

    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: numericValue,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        if (numberRef.current) {
          const current = Math.round(obj.val);
          numberRef.current.innerText = `${prefix}${current.toLocaleString('en-IN')}${suffix}`;
        }
      }
    });

    return () => tween.kill();
  }, [numericValue, prefix, suffix, isNumber]);

  const borderVariant = {
    default: 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/50',
    emerald: 'border-emerald-300 dark:border-emerald-800/80 shadow-emerald-500/10 dark:shadow-emerald-950/20',
    amber: 'border-amber-300 dark:border-amber-800/80 shadow-amber-500/10 dark:shadow-amber-950/20',
    teal: 'border-teal-300 dark:border-teal-800/80 shadow-teal-500/10 dark:shadow-teal-950/20'
  }[variant] || 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/50';

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/85 backdrop-blur-md border ${borderVariant} p-5 shadow-sm dark:shadow-lg transition-all duration-300 hover:shadow-md dark:hover:shadow-xl hover:-translate-y-0.5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block tracking-wide">
            {title}
          </span>

          <div className="flex items-baseline gap-2">
            <span
              ref={numberRef}
              className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white"
            >
              {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}{suffix}
            </span>
          </div>

          {trend && (
            <div className="flex items-center gap-1.5 text-xs font-semibold pt-1">
              {trendDirection === 'up' && (
                <span className="inline-flex items-center text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border dark:border-emerald-800/60">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {trend}
                </span>
              )}
              {trendDirection === 'down' && (
                <span className="inline-flex items-center text-rose-700 bg-rose-100 border-rose-300 dark:text-rose-400 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border dark:border-rose-800/60">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  {trend}
                </span>
              )}
              {trendDirection === 'neutral' && (
                <span className="inline-flex items-center text-slate-600 bg-slate-100 border-slate-300 dark:text-slate-400 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border dark:border-slate-700">
                  <Minus className="w-3 h-3 mr-1" />
                  {trend}
                </span>
              )}
              {subtitle && <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">{subtitle}</span>}
            </div>
          )}

          {!trend && subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-emerald-600 dark:text-emerald-400 shrink-0 shadow-inner">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

