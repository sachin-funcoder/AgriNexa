import React from 'react';

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  icon: Icon,
  className = '',
  type = 'button',
  size = 'md',
  ...props
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size] || 'px-4 py-2 text-sm';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold rounded-xl text-white transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 shadow-lg shadow-emerald-950/40 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${sizeClasses} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 mr-2 shrink-0 transition-transform group-hover:scale-110" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled = false,
  icon: Icon,
  className = '',
  type = 'button',
  size = 'md',
  ...props
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size] || 'px-4 py-2 text-sm';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium rounded-xl text-slate-700 dark:text-slate-200 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 ${sizeClasses} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 mr-2 shrink-0 text-slate-500 dark:text-slate-400" />}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  onClick,
  label,
  className = '',
  size = 'md',
  variant = 'secondary',
  ...props
}) {
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  }[size] || 'p-2';

  const variantClasses = variant === 'primary'
    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
    : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 shadow-sm';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-xl transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

