import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Sprout, 
  TrendingUp, 
  PieChart, 
  Calculator, 
  MapPin, 
  Users, 
  Menu, 
  X, 
  Globe2,
  Sparkles,
  CreditCard,
  ShieldCheck,
  User,
  Bot,
  CloudSun,
  LayoutDashboard,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('kn') ? 'en' : 'kn';
    i18n.changeLanguage(nextLang);
  };

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/price-trends', label: t('nav.priceTrends'), icon: TrendingUp },
    { to: '/harvest-split', label: t('nav.harvestSplit'), icon: PieChart },
    { to: '/calculator', label: t('nav.calculator'), icon: Calculator },
    { to: '/mandi-compare', label: t('nav.mandiCompare'), icon: MapPin },
    { to: '/community', label: t('nav.community'), icon: Users },
    { to: '/crop-advisor', label: t('nav.cropAdvisor', 'Crop Advisor'), icon: CloudSun },
    { to: '/prediction-protection', label: t('nav.protection', 'Protection'), icon: ShieldCheck },
    { to: '/subscriptions', label: t('nav.subscriptions', 'Plans'), icon: CreditCard },
    { to: '/chat', label: i18n.language.startsWith('kn') ? 'ಕೃಷಿ AI' : 'Krishi AI', icon: Bot, isSpecial: true },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <NavLink to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-agri-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-agri-950/50 group-hover:scale-105 transition-transform">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-agri-600 dark:group-hover:text-agri-400 transition-colors">
                  AgriNexa
                </span>
                <span className="px-1.5 py-0.5 text-[10px] uppercase font-semibold bg-emerald-100 text-emerald-800 dark:bg-agri-950 dark:text-agri-400 border border-emerald-300 dark:border-agri-800/60 rounded">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block -mt-0.5">
                {t('app.tagline')}
              </p>
            </div>
          </NavLink>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    item.isSpecial
                      ? 'bg-gradient-to-r from-emerald-600/15 to-agri-600/15 text-emerald-700 border border-emerald-500/40 hover:bg-emerald-600/25 dark:from-emerald-600/30 dark:to-agri-600/30 dark:text-emerald-300 dark:border-emerald-500/50 dark:hover:bg-emerald-600/40 shadow-sm'
                      : isActive
                      ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-300 dark:bg-agri-950 dark:text-agri-400 dark:border-agri-800/50 shadow-inner'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${item.isSpecial ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-emerald-600 dark:text-agri-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Controls: Language Toggle, Theme Toggle & User / Auth */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={isDark ? (i18n.language.startsWith('kn') ? 'ಬೆಳಕಿನ ಥೀಮ್‌ಗೆ ಬದಲಾಯಿಸಿ' : 'Switch to Light Mode') : (i18n.language.startsWith('kn') ? 'ಕತ್ತಲೆಯ ಥೀಮ್‌ಗೆ ಬದಲಾಯಿಸಿ' : 'Switch to Dark Mode')}
              className="p-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:border-agri-500 hover:text-agri-700 dark:hover:text-agri-300 transition-colors"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:border-agri-500 hover:text-agri-700 dark:hover:text-agri-300 transition-colors"
              title="Toggle Language / ಭಾಷೆಯನ್ನು ಬದಲಾಯಿಸಿ"
            >
              <Globe2 className="w-3.5 h-3.5 text-agri-600 dark:text-agri-400" />
              <span>{i18n.language.startsWith('kn') ? 'ಕನ್ನಡ' : 'English'}</span>
            </button>

            {isAuthenticated ? (
              <NavLink
                to="/profile"
                className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  location.pathname === '/profile'
                    ? 'bg-emerald-100 dark:bg-agri-950 text-emerald-800 dark:text-agri-300 border-emerald-400 dark:border-agri-600'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-agri-500'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-agri-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {user?.full_name?.charAt(0) || 'F'}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">{user?.full_name}</span>
                {user?.active_subscription_plan === 'PROTECTION' && (
                  <span className="px-1 py-0.2 text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded">
                    Raksha
                  </span>
                )}
              </NavLink>
            ) : (
              <NavLink
                to="/auth"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-agri-600 hover:bg-agri-500 text-white transition-colors shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </NavLink>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-900 focus:outline-none"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden glass-panel border-b border-slate-200 dark:border-slate-800 px-4 pt-2 pb-4 space-y-1 bg-white/95 dark:bg-slate-950/95">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium ${
                  isActive
                    ? 'bg-emerald-100 dark:bg-agri-950 text-emerald-800 dark:text-agri-400 border border-emerald-300 dark:border-agri-800/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-agri-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 py-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Theme / ಥೀಮ್</span>
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>

          {isAuthenticated ? (
            <NavLink
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900"
            >
              <User className="w-4 h-4 text-agri-600 dark:text-agri-400" />
              <span>Farmer Profile ({user?.full_name})</span>
            </NavLink>
          ) : (
            <NavLink
              to="/auth"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-emerald-700 hover:bg-slate-100 dark:text-agri-400 dark:hover:bg-slate-900"
            >
              <User className="w-4 h-4" />
              <span>Sign In / Farmer Registration</span>
            </NavLink>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
