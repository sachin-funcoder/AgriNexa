import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sprout, ShieldCheck, HeartHandshake } from 'lucide-react';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 px-4 text-slate-500 dark:text-slate-400 text-xs mt-auto transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Sprout className="w-4 h-4 text-agri-600 dark:text-agri-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">AgriNexa</span>
          <span>•</span>
          <span>{t('app.tagline')}</span>
        </div>

        <div className="flex items-center space-x-6 text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Verified Agmarknet Signals</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <HeartHandshake className="w-3.5 h-3.5 text-amber-600 dark:text-harvest-400" />
            <span>Built for Karnataka Farmers</span>
          </div>
        </div>

        <div className="text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} AgriNexa Platform. All market forecasts are indicative scenarios.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
