import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AIInsightCard({
  tag = 'AI Market Signal',
  title,
  content,
  actionText,
  actionLink,
  onActionClick,
  variant = 'emerald',
  className = '',
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 border bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 shadow-sm dark:shadow-lg transition-colors ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
          <Sparkles className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
          {tag}
        </span>
      </div>

      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
        {title}
      </h4>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
        {content}
      </p>

      {actionText && (
        actionLink ? (
          <Link
            to={actionLink}
            className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            <span>{actionText}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onActionClick}
            className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            <span>{actionText}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        )
      )}
    </div>
  );
}

