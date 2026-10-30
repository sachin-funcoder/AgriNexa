import React from 'react';
import { PackageOpen } from 'lucide-react';
import { PrimaryButton } from './Button';

export function EmptyState({
  icon: Icon = PackageOpen,
  title = 'No Data Found',
  description = 'There are no records to display at this moment.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`p-12 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-none space-y-4 max-w-lg mx-auto transition-colors ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto shadow-inner">
        <Icon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {actionLabel && onAction && (
        <div className="pt-2">
          <PrimaryButton onClick={onAction} size="sm">
            {actionLabel}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

