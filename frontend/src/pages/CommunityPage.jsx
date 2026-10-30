import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, MessageSquare, AlertCircle, ShieldAlert, FileText, CheckCircle2,
  Clock, ThumbsUp, Send, Filter, Search, PlusCircle, ChevronDown, ChevronUp,
  MapPin, AlertTriangle, ShieldCheck, RefreshCw, X, Eye, EyeOff, Check
} from 'lucide-react';

import { SUPPORTED_CROPS, KARNATAKA_MANDIS } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import mandiApi from '../services/mandiApi';

const POST_CATEGORIES = [
  'Market Price',
  'Mandi Experience',
  'Weighing Issue',
  'Payment Delay',
  'Transport',
  'Storage',
  'General Discussion'
];

const REPORT_CATEGORIES = [
  'Suspected underpayment',
  'Incorrect weighing',
  'Payment delay',
  'Unexpected deductions',
  'Quality dispute',
  'Other'
];

const STATUS_ORDER = [
  'Submitted',
  'Under Review',
  'Additional Information Needed',
  'Resolved',
  'Closed'
];

const categoryBadgeStyle = (cat) => {
  switch (cat) {
    case 'Market Price':
      return 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60';
    case 'Transport':
      return 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-800/60';
    case 'Storage':
      return 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-800/60';
    case 'Weighing Issue':
    case 'Payment Delay':
      return 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60';
    case 'Mandi Experience':
      return 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800/60';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
};

const statusBadgeStyle = (status) => {
  switch (status) {
    case 'Submitted':
      return 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800/60';
    case 'Under Review':
      return 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60';
    case 'Additional Information Needed':
      return 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800/60';
    case 'Resolved':
      return 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60';
    case 'Closed':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
};

const CommunityPage = () => {
  const { t, i18n } = useTranslation();
  const isKn = i18n.language?.startsWith('kn');

  // Navigation tab state
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'create' | 'report' | 'my_reports' | 'moderation'
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  // Feed state
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [feedError, setFeedError] = useState(null);

  // Feed filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCrop, setFilterCrop] = useState('');
  const [filterMandi, setFilterMandi] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');

  // Comments state: { [postId]: boolean (isExpanded) }
  const [expandedComments, setExpandedComments] = useState({});
  const [newCommentText, setNewCommentText] = useState({});
  const [commentSubmitting, setCommentSubmitting] = useState({});
  const [flaggedPosts, setFlaggedPosts] = useState({});

  // Create post form state
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostCategory, setNewPostCategory] = useState(POST_CATEGORIES[0]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCrop, setNewPostCrop] = useState('');
  const [newPostMandi, setNewPostMandi] = useState('');
  const [createPostLoading, setCreatePostLoading] = useState(false);
  const [createPostSuccess, setCreatePostSuccess] = useState(false);
  const [createPostError, setCreatePostError] = useState(null);

  // Report form state
  const [reportCategory, setReportCategory] = useState(REPORT_CATEGORIES[0]);
  const [reportMandi, setReportMandi] = useState(KARNATAKA_MANDIS[0]?.id || '');
  const [reportCrop, setReportCrop] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportAmount, setReportAmount] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccessId, setReportSuccessId] = useState(null);
  const [reportError, setReportError] = useState(null);

  // My Reports state
  const [myReports, setMyReports] = useState([]);
  const [loadingMyReports, setLoadingMyReports] = useState(false);

  // Moderation state
  const [modQueue, setModQueue] = useState(null);
  const [loadingModQueue, setLoadingModQueue] = useState(false);
  const [modConfirmModal, setModConfirmModal] = useState(null); // { type, id, payload, message }

  // ---------------------------------------------------------------------------
  // Data Fetching: Posts Feed
  // ---------------------------------------------------------------------------
  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    setFeedError(null);
    try {
      const params = { sort_by: sortBy };
      if (filterCategory) params.category = filterCategory;
      if (filterCrop) params.crop_id = filterCrop;
      if (filterMandi) params.mandi_id = filterMandi;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await mandiApi.getCommunityPosts(params);
      setPosts(data.posts || []);
    } catch (err) {
      setFeedError(err.message || 'Failed to load community posts');
    } finally {
      setLoadingPosts(false);
    }
  }, [filterCategory, filterCrop, filterMandi, searchQuery, sortBy]);

  // Fetch posts on mount and when filter criteria change
  useEffect(() => {
    if (activeTab === 'feed') {
      fetchPosts();
    }
  }, [activeTab, fetchPosts]);

  // ---------------------------------------------------------------------------
  // Data Fetching: My Reports
  // ---------------------------------------------------------------------------
  const fetchMyReports = useCallback(async () => {
    setLoadingMyReports(true);
    try {
      const data = await mandiApi.getGrievanceReports({ farmer_id: 'farmer_demo_user' });
      setMyReports(data.reports || []);
    } catch (err) {
      console.error('Failed to load my reports:', err);
    } finally {
      setLoadingMyReports(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'my_reports') {
      fetchMyReports();
    }
  }, [activeTab, fetchMyReports]);

  // ---------------------------------------------------------------------------
  // Data Fetching: Moderation Queue
  // ---------------------------------------------------------------------------
  const fetchModQueue = useCallback(async () => {
    setLoadingModQueue(true);
    try {
      const data = await mandiApi.getModerationQueue();
      setModQueue(data);
    } catch (err) {
      console.error('Failed to load moderation queue:', err);
    } finally {
      setLoadingModQueue(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'moderation') {
      fetchModQueue();
    }
  }, [activeTab, fetchModQueue]);

  // ---------------------------------------------------------------------------
  // Handlers: Helpful Upvote & Comments
  // ---------------------------------------------------------------------------
  const handleHelpfulClick = async (postId) => {
    try {
      const updated = await mandiApi.markPostHelpful(postId);
      setPosts(prev => prev.map(p => p.post_id === postId ? { ...p, helpful_count: updated.helpful_count } : p));
    } catch (err) {
      console.error('Failed to upvote post:', err);
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleAddComment = async (postId) => {
    const text = (newCommentText[postId] || '').trim();
    if (!text) return;

    setCommentSubmitting(prev => ({ ...prev, [postId]: true }));
    try {
      const newComment = await mandiApi.addPostComment(postId, {
        content: text,
        author_name: isKn ? 'ರಮೇಶ್ ಪಟೇಲ್ (ಡೆಮೊ ರೈತ)' : 'Ramesh Patel (Demo Farmer)',
        author_id: 'farmer_demo_user'
      });

      setPosts(prev => prev.map(p => {
        if (p.post_id === postId) {
          return {
            ...p,
            comments_count: p.comments_count + 1,
            comments: [...(p.comments || []), newComment]
          };
        }
        return p;
      }));

      setNewCommentText(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      alert(err.message || 'Failed to submit comment');
    } finally {
      setCommentSubmitting(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleFlagPost = (postId) => {
    setFlaggedPosts(prev => ({ ...prev, [postId]: true }));
    setTimeout(() => {
      setFlaggedPosts(prev => ({ ...prev, [postId]: false }));
    }, 4000);
  };

  // ---------------------------------------------------------------------------
  // Handlers: Create Post Submission
  // ---------------------------------------------------------------------------
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      setCreatePostError('Title and content are required.');
      return;
    }

    setCreatePostLoading(true);
    setCreatePostError(null);
    setCreatePostSuccess(false);

    try {
      const payload = {
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        category: newPostCategory,
        author_name: isKn ? 'ರಮೇಶ್ ಪಟೇಲ್ (ಡೆಮೊ ರೈತ)' : 'Ramesh Patel (Demo Farmer)',
        author_id: 'farmer_demo_user'
      };
      if (newPostCrop) payload.crop_id = newPostCrop;
      if (newPostMandi) payload.mandi_id = newPostMandi;

      const created = await mandiApi.createCommunityPost(payload);
      setCreatePostSuccess(true);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostCrop('');
      setNewPostMandi('');

      // Refresh feed in background
      setPosts(prev => [created, ...prev]);

      setTimeout(() => {
        setCreatePostSuccess(false);
        setActiveTab('feed');
      }, 2000);
    } catch (err) {
      setCreatePostError(err.message || 'Failed to publish post');
    } finally {
      setCreatePostLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Report Submission
  // ---------------------------------------------------------------------------
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (reportDesc.trim().length < 15) {
      setReportError('Description must be at least 15 characters long.');
      return;
    }

    setReportSubmitting(true);
    setReportError(null);
    setReportSuccessId(null);

    try {
      const payload = {
        issue_category: reportCategory,
        mandi_id: reportMandi,
        incident_date: reportDate,
        description: reportDesc.trim(),
        farmer_name: isKn ? 'ರಮೇಶ್ ಪಟೇಲ್ (ಡೆಮೊ ರೈತ)' : 'Ramesh Patel (Demo Farmer)',
        farmer_id: 'farmer_demo_user'
      };
      if (reportCrop) payload.crop_id = reportCrop;
      if (reportAmount) payload.approximate_amount = parseFloat(reportAmount);

      const res = await mandiApi.submitGrievanceReport(payload);
      setReportSuccessId(res.report_id);
      setReportDesc('');
      setReportAmount('');
    } catch (err) {
      setReportError(err.message || 'Failed to submit grievance report');
    } finally {
      setReportSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Moderation Actions with Confirmation
  // ---------------------------------------------------------------------------
  const confirmModAction = async () => {
    if (!modConfirmModal) return;
    const { type, id, payload } = modConfirmModal;
    try {
      if (type === 'post') {
        const updated = await mandiApi.moderatePost(id, payload);
        if (modQueue) {
          setModQueue(prev => ({
            ...prev,
            posts: prev.posts.map(p => p.post_id === id ? updated : p),
            hidden_posts_count: prev.posts.filter(p => (p.post_id === id ? updated.status : p.status) === 'hidden').length
          }));
        }
      } else if (type === 'report') {
        const updated = await mandiApi.moderateReport(id, payload);
        if (modQueue) {
          setModQueue(prev => ({
            ...prev,
            reports: prev.reports.map(r => r.report_id === id ? updated : r)
          }));
        }
      }
      setModConfirmModal(null);
    } catch (err) {
      alert(err.message || 'Moderation action failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Users className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
            <span>{t('community.title')}</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t('community.subtitle')}</p>
        </div>

        {/* Guidelines Toggle Button */}
        <button
          onClick={() => setGuidelinesOpen(prev => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-xs text-slate-700 dark:text-slate-300 font-medium transition-colors self-start md:self-auto shadow-sm"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span>{t('community.guidelines_title')}</span>
          {guidelinesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Demo Banner */}
      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 shadow-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{t('community.demo_banner')}</span>
      </div>

      {/* Guidelines Card (Collapsible) */}
      {guidelinesOpen && (
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2 animate-fadeIn text-xs text-slate-700 dark:text-slate-300 shadow-sm">
          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            {t('community.guidelines_title')}
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1">
            <li>{t('community.guideline_1')}</li>
            <li>{t('community.guideline_2')}</li>
            <li>{t('community.guideline_3')}</li>
            <li>{t('community.guideline_4')}</li>
          </ul>
        </div>
      )}

      {/* ── Main Tab Navigation Bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'feed'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{t('community.tab_feed')}</span>
          {posts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-700/40 text-[10px]">{posts.length}</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'create'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t('community.tab_create_post')}</span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'report'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm'
          }`}
        >
          <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          <span>{t('community.tab_report')}</span>
        </button>

        <button
          onClick={() => setActiveTab('my_reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'my_reports'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t('community.tab_my_reports')}</span>
          {myReports.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-700/40 text-[10px]">{myReports.length}</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('moderation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ml-auto ${
            activeTab === 'moderation'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-amber-700 dark:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{t('community.tab_moderation')}</span>
        </button>
      </div>

      {/* ── TAB 1: COMMUNITY FEED ────────────────────────────────────────── */}
      {activeTab === 'feed' && (
        <div className="space-y-4">

          {/* Filter Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 shadow-sm">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('community.search_placeholder')}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            >
              <option value="">{t('community.filter_all_categories')}</option>
              {POST_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Crop Filter */}
            <select
              value={filterCrop}
              onChange={e => setFilterCrop(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            >
              <option value="">{t('community.filter_all_crops')}</option>
              {SUPPORTED_CROPS.map(c => (
                <option key={c.id} value={c.id}>{isKn ? c.name_kn : c.name_en}</option>
              ))}
            </select>

            {/* Mandi Filter */}
            <select
              value={filterMandi}
              onChange={e => setFilterMandi(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            >
              <option value="">{t('community.filter_all_mandis')}</option>
              {KARNATAKA_MANDIS.map(m => (
                <option key={m.id} value={m.id}>{m.name.split('(')[0].trim()}</option>
              ))}
            </select>

            {/* Sort Toggle */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            >
              <option value="latest">{t('community.sort_latest')}</option>
              <option value="helpful">{t('community.sort_helpful')}</option>
            </select>
          </div>

          {/* Posts List */}
          {loadingPosts && (
            <div className="glass-panel p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 dark:text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Loading community discussions...</p>
            </div>
          )}

          {feedError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 p-4 text-xs text-rose-800 dark:text-rose-300 shadow-sm">
              {feedError}
            </div>
          )}

          {!loadingPosts && posts.length === 0 && (
            <div className="glass-panel p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2 shadow-sm">
              <MessageSquare className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('community.empty_posts')}</p>
            </div>
          )}

          <div className="space-y-4">
            {posts.map(post => (
              <div key={post.post_id} className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm">

                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800/60 flex items-center justify-center text-xs font-bold text-emerald-800 dark:text-emerald-400">
                      {post.author_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{post.author_name}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(post.created_at, i18n.language)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Category & Tags */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${categoryBadgeStyle(post.category)}`}>
                      {post.category}
                    </span>
                    {post.crop_name && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                        🌾 {post.crop_name}
                      </span>
                    )}
                    {post.mandi_name && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5 text-sky-500 dark:text-sky-400" />
                        {post.mandi_name.split('(')[0].trim()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Post Body */}
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{post.title}</h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Post Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                  <div className="flex items-center gap-2">
                    {/* Helpful Button */}
                    <button
                      onClick={() => handleHelpfulClick(post.post_id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors shadow-sm"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{t('community.helpful_btn')}</span>
                      <span className="font-bold text-slate-900 dark:text-white ml-0.5">({post.helpful_count})</span>
                    </button>

                    {/* Toggle Comments Button */}
                    <button
                      onClick={() => toggleComments(post.post_id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                      <span>{t('community.comments_toggle')}</span>
                      <span className="font-bold text-slate-900 dark:text-white ml-0.5">({post.comments_count})</span>
                      {expandedComments[post.post_id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Report Flag Button */}
                  <div className="relative">
                    <button
                      onClick={() => handleFlagPost(post.post_id)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>{t('community.report_post_btn')}</span>
                    </button>
                    {flaggedPosts[post.post_id] && (
                      <div className="absolute right-0 bottom-full mb-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-[10px] whitespace-nowrap shadow-lg animate-fadeIn">
                        {t('community.reported_notice')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Comments Section */}
                {expandedComments[post.post_id] && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('community.comments_toggle')} ({post.comments?.length || 0})
                    </p>

                    {/* Comment List */}
                    {post.comments && post.comments.length > 0 ? (
                      <div className="space-y-2">
                        {post.comments.map(c => (
                          <div key={c.comment_id} className="p-2.5 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1 shadow-sm">
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span className="font-bold text-slate-800 dark:text-slate-300">{c.author_name}</span>
                              <span>{formatDate(c.created_at, i18n.language)}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-200">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">{t('community.no_comments_yet')}</p>
                    )}

                    {/* Add Comment Input */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newCommentText[post.post_id] || ''}
                        onChange={e => setNewCommentText({ ...newCommentText, [post.post_id]: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddComment(post.post_id);
                        }}
                        placeholder={t('community.add_comment_placeholder')}
                        maxLength={500}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                      />
                      <button
                        onClick={() => handleAddComment(post.post_id)}
                        disabled={commentSubmitting[post.post_id] || !(newCommentText[post.post_id] || '').trim()}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>{t('community.comment_submit')}</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>

        </div>
      )}

      {/* ── TAB 2: CREATE NEW POST ───────────────────────────────────────── */}
      {activeTab === 'create' && (
        <div className="max-w-2xl mx-auto glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <PlusCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('community.create_title')}</h2>
          </div>

          {createPostSuccess && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{t('community.post_success')}</span>
            </div>
          )}

          {createPostError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{createPostError}</span>
            </div>
          )}

          <form onSubmit={handleCreatePost} className="space-y-4 text-xs">
            {/* Title */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('community.post_title_label')} *
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={150}
                value={newPostTitle}
                onChange={e => setNewPostTitle(e.target.value)}
                placeholder={t('community.post_title_placeholder')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
              />
              <p className="text-[10px] text-slate-500 mt-1 text-right">{newPostTitle.length}/150 {t('community.char_limit')}</p>
            </div>

            {/* Category */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('community.post_category_label')} *
              </label>
              <select
                value={newPostCategory}
                onChange={e => setNewPostCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
              >
                {POST_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Optional Crop & Mandi Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('community.post_crop_label')}
                </label>
                <select
                  value={newPostCrop}
                  onChange={e => setNewPostCrop(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="">-- {t('community.filter_all_crops')} --</option>
                  {SUPPORTED_CROPS.map(c => (
                    <option key={c.id} value={c.id}>{isKn ? c.name_kn : c.name_en}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('community.post_mandi_label')}
                </label>
                <select
                  value={newPostMandi}
                  onChange={e => setNewPostMandi(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="">-- {t('community.filter_all_mandis')} --</option>
                  {KARNATAKA_MANDIS.map(m => (
                    <option key={m.id} value={m.id}>{m.name.split('(')[0].trim()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content Details */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('community.post_content_label')} *
              </label>
              <textarea
                required
                rows={5}
                minLength={10}
                maxLength={2000}
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder={t('community.post_content_placeholder')}
                className="w-full p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
              />
              <p className="text-[10px] text-slate-500 mt-1 text-right">{newPostContent.length}/2000 {t('community.char_limit')}</p>
            </div>

            <button
              type="submit"
              disabled={createPostLoading || !newPostTitle.trim() || newPostContent.trim().length < 10}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              {createPostLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{createPostLoading ? t('community.post_submitting') : t('community.post_submit_btn')}</span>
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 3: REPORT SUSPECTED UNFAIR PRACTICE ──────────────────────── */}
      {activeTab === 'report' && (
        <div className="max-w-2xl mx-auto glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <AlertCircle className="w-5 h-5 text-rose-500 dark:text-rose-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('community.report_title')}</h2>
          </div>

          {/* Legal / Neutral Disclaimer */}
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/60 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2 shadow-sm">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{t('community.report_disclaimer')}</p>
          </div>

          {reportSuccessId && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 p-4 text-xs text-emerald-800 dark:text-emerald-300 space-y-2 shadow-sm">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('community.report_success')} {reportSuccessId}</span>
              </p>
              <button
                onClick={() => setActiveTab('my_reports')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors shadow-sm"
              >
                View in My Reports →
              </button>
            </div>
          )}

          {reportError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{reportError}</span>
            </div>
          )}

          <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
            {/* Issue Category */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('community.report_issue_label')} *
              </label>
              <select
                value={reportCategory}
                onChange={e => setReportCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
              >
                {REPORT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Mandi & Crop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('community.report_mandi_label')} *
                </label>
                <select
                  required
                  value={reportMandi}
                  onChange={e => setReportMandi(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
                >
                  {KARNATAKA_MANDIS.map(m => (
                    <option key={m.id} value={m.id}>{m.name.split('(')[0].trim()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('community.report_crop_label')}
                </label>
                <select
                  value={reportCrop}
                  onChange={e => setReportCrop(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
                >
                  <option value="">-- {t('community.filter_all_crops')} --</option>
                  {SUPPORTED_CROPS.map(c => (
                    <option key={c.id} value={c.id}>{isKn ? c.name_kn : c.name_en}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Incident Date & Approximate Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('community.report_date_label')} *
                </label>
                <input
                  type="date"
                  required
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('community.report_amount_label')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={reportAmount}
                  onChange={e => setReportAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
                />
              </div>
            </div>

            {/* Factual Description */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('community.report_desc_label')} *
              </label>
              <textarea
                required
                rows={5}
                minLength={15}
                maxLength={2000}
                value={reportDesc}
                onChange={e => setNewReportDesc ? setNewReportDesc(e.target.value) : setReportDesc(e.target.value)}
                placeholder={t('community.report_desc_placeholder')}
                className="w-full p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
              />
              <p className="text-[10px] text-slate-500 mt-1 text-right">{reportDesc.length}/2000 {t('community.char_limit')}</p>
            </div>

            <button
              type="submit"
              disabled={reportSubmitting || reportDesc.trim().length < 15}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              {reportSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
              <span>{reportSubmitting ? t('community.report_submitting') : t('community.report_submit_btn')}</span>
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 4: MY REPORTS TRACKING ───────────────────────────────────── */}
      {activeTab === 'my_reports' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <span>{t('community.my_reports_title')}</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t('community.my_reports_subtitle')}</p>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
              <span className="text-slate-500 mr-1">{t('community.demo_identity_label')}</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-300">farmer_demo_user</span>
            </div>
          </div>

          {loadingMyReports && (
            <div className="glass-panel p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 dark:text-indigo-400 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Loading tracked reports...</p>
            </div>
          )}

          {!loadingMyReports && myReports.length === 0 && (
            <div className="glass-panel p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2 shadow-sm">
              <FileText className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('community.no_reports_yet')}</p>
            </div>
          )}

          <div className="space-y-4">
            {myReports.map(rep => {
              const currentStepIdx = STATUS_ORDER.indexOf(rep.status);

              return (
                <div key={rep.report_id} className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">

                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-300">{rep.report_id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeStyle(rep.status)}`}>
                          {rep.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{rep.issue_category}</p>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                      <p><span className="text-slate-500">{t('community.submitted_on')}:</span> {formatDate(rep.created_at, i18n.language)}</p>
                      <p><span className="text-slate-500">{t('community.last_updated')}:</span> {formatDate(rep.updated_at, i18n.language)}</p>
                    </div>
                  </div>

                  {/* Context chips */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                      {rep.mandi_name.split('(')[0].trim()}
                    </span>
                    {rep.crop_name && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                        🌾 {rep.crop_name}
                      </span>
                    )}
                    {rep.approximate_amount && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-slate-800 text-amber-700 dark:text-amber-300 font-semibold">
                        ₹{rep.approximate_amount.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60">
                    {rep.description}
                  </p>

                  {/* 5-Step Visual Timeline */}
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Resolution Lifecycle</p>
                    <div className="grid grid-cols-5 gap-1 text-center">
                      {STATUS_ORDER.map((s, idx) => {
                        const isDone = idx < currentStepIdx;
                        const isCurrent = idx === currentStepIdx;

                        return (
                          <div key={s} className="space-y-1">
                            <div className={`h-1.5 rounded-full transition-colors ${
                              isDone
                                ? 'bg-emerald-500'
                                : isCurrent
                                ? 'bg-indigo-500 animate-pulse'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`} />
                            <p className={`text-[9px] font-medium leading-tight truncate ${
                              isCurrent ? 'text-indigo-600 dark:text-indigo-300 font-bold' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'
                            }`}>
                              {s}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Review Notes */}
                  {rep.status_notes && (
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t('community.inspector_notes')}</span>
                      </p>
                      <p className="text-[11px] text-indigo-800 dark:text-indigo-300/90 leading-relaxed">{rep.status_notes}</p>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ── TAB 5: DEMO MODERATION CONSOLE ───────────────────────────────── */}
      {activeTab === 'moderation' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <span>{t('community.mod_title')}</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t('community.mod_disclaimer')}</p>
            </div>
            <button
              onClick={fetchModQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium hover:border-slate-400 dark:hover:border-slate-500 self-start sm:self-auto shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Queue</span>
            </button>
          </div>

          {loadingModQueue && (
            <div className="glass-panel p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500 dark:text-amber-400 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Loading moderation queue...</p>
            </div>
          )}

          {modQueue && (
            <>
              {/* Aggregates Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-panel p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('community.mod_pending_reports')}</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{modQueue.pending_reports_count}</p>
                </div>
                <div className="glass-panel p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('community.mod_hidden_posts')}</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{modQueue.hidden_posts_count}</p>
                </div>
                <div className="glass-panel p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('community.mod_total_posts')}</p>
                  <p className="text-xl font-bold text-sky-600 dark:text-sky-400">{modQueue.total_posts}</p>
                </div>
                <div className="glass-panel p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Grievances</p>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{modQueue.total_reports}</p>
                </div>
              </div>

              {/* Section 1: Grievance Reports Review */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>{t('community.all_reports')} ({modQueue.reports?.length || 0})</span>
                </h3>

                <div className="space-y-3">
                  {modQueue.reports?.map(rep => (
                    <div key={rep.report_id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 text-xs shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300">{rep.report_id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeStyle(rep.status)}`}>
                            {rep.status}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{rep.issue_category}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{rep.mandi_name} • {formatDate(rep.created_at, i18n.language)}</span>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{rep.description}</p>

                      {/* Status Update Action Bar */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">{t('community.mod_update_status')}:</span>
                        {STATUS_ORDER.map(s => {
                          if (s === rep.status) return null;
                          return (
                            <button
                              key={s}
                              onClick={() => {
                                setModConfirmModal({
                                  type: 'report',
                                  id: rep.report_id,
                                  payload: { status: s, status_notes: `Status transitioned to ${s} by demonstration moderator.` },
                                  message: `${t('community.mod_confirm_status')} ${rep.report_id} to '${s}'?`
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-300 dark:border-slate-700 transition-colors shadow-sm"
                            >
                              → {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Community Posts Visibility Moderation */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                  <span>{t('community.all_posts')} ({modQueue.posts?.length || 0})</span>
                </h3>

                <div className="space-y-2">
                  {modQueue.posts?.map(p => (
                    <div key={p.post_id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
                      <div className="space-y-0.5 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'hidden' ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800/60' : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60'
                          }`}>
                            {p.status === 'hidden' ? t('community.status_hidden') : t('community.status_active')}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{p.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{p.content}</p>
                        <p className="text-[10px] text-slate-500">By {p.author_name} • {formatDate(p.created_at, i18n.language)}</p>
                      </div>

                      {/* Action Toggle */}
                      <div>
                        {p.status === 'active' ? (
                          <button
                            onClick={() => {
                              setModConfirmModal({
                                type: 'post',
                                id: p.post_id,
                                payload: { status: 'hidden' },
                                message: t('community.mod_confirm_hide')
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{t('community.mod_action_hide')}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setModConfirmModal({
                                type: 'post',
                                id: p.post_id,
                                payload: { status: 'active' },
                                message: `Approve and unhide post '${p.title}'?`
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t('community.mod_action_unhide')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODERATION CONFIRMATION MODAL ─────────────────────────────────── */}
      {modConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel p-5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 space-y-4 shadow-2xl animate-fadeIn text-xs">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Confirm Moderation Action</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{modConfirmModal.message}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setModConfirmModal(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors shadow-sm"
              >
                {t('community.action_cancel')}
              </button>
              <button
                onClick={confirmModAction}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors shadow-md"
              >
                {t('community.action_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CommunityPage;
