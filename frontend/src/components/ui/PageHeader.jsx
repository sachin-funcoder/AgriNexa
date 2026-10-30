import React from 'react';
import { Sparkles } from 'lucide-react';

export function PageHeader({
  badge,
  badgeIcon: BadgeIcon = Sparkles,
  title,
  subtitle,
  children,
  className = '',
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/80 dark:from-slate-900/90 dark:via-slate-900 dark:to-emerald-950/80 border border-emerald-100/90 dark:border-slate-800/80 shadow-md dark:shadow-xl p-6 sm:p-8 transition-colors ${className}`}>
      {/* Background radial accent glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          {badge && (
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
              {BadgeIcon && <BadgeIcon className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />}
              <span>{badge}</span>
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>

          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {children && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

