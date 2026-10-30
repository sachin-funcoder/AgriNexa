import React from 'react';

export function StatusBadge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) {
  const variantStyles = {
    success: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-500/40',
    warning: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-500/40',
    error: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-500/40',
    info: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-500/40',
    teal: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-500/40',
    neutral: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/80 dark:text-slate-300 dark:border-slate-700/80',
    gold: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-harvest-950/70 dark:text-harvest-300 dark:border-harvest-500/40'
  }[variant] || 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/80 dark:text-slate-300 dark:border-slate-700/80';

  const dotColors = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    error: 'bg-rose-400',
    info: 'bg-sky-400',
    teal: 'bg-teal-400',
    neutral: 'bg-slate-400',
    gold: 'bg-harvest-400'
  }[variant] || 'bg-slate-400';

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border transition-colors ${sizeClasses} ${variantStyles} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${dotColors}`} />
      )}
      {children}
    </span>
  );
}

