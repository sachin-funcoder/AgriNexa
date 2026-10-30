import React from 'react';

export function CardSkeleton({ count = 3, className = '' }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-5 space-y-3 animate-pulse shadow-sm"
        >
          <div className="flex justify-between items-center">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" />
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-36" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 overflow-hidden p-4 space-y-3 animate-pulse shadow-sm">
      <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-48 mb-4" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 bg-slate-200 dark:bg-slate-800/80 rounded flex-1"
                style={{ width: `${100 / cols}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

