import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Calendar,
  MessageSquare,
  AlertCircle,
  LayoutDashboard,
  Plus,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  ChevronRight,
  Send,
  X,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  Map,
  Filter,
  User,
  Mail,
  Award,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation
} from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { format } from 'date-fns';
import { cn, CATEGORIES, ISSUE_CATEGORIES, DEPARTMENTS, BRANCHES, YEARS, safeFormatDate, generateCalendarEvent } from './utils';
import { extractDeadline, classifyIssuePriority, getChatbotResponse } from './services/geminiService';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';

// --- Types ---
interface Notice {
  id: number;
  title: string;
  content: string;
  category: string;
  department: string;
  branch: string;
  year: string;
  photo_url?: string;
  views?: number;
  date_posted: string;
}

interface Issue {
  id: number;
  student_email: string;
  title: string;
  description: string;
  category: string;
  department: string;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string;
  photo_url?: string;
  priority: string;
  status: string;
  created_at: string;
}

// --- Helper to generate Google Maps link ---
const getGoogleMapsLink = (lat: number | null, lng: number | null) => {
  if (lat && lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  return null;
};

// ========== Profile Popup Component ==========
const ProfilePopup = ({ user, onClose }: { user: any; onClose: () => void }) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute right-0 top-12 w-64 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden z-50"
    >
      <div className="p-4 border-b border-slate-100/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{user?.name || user?.email?.split('@')[0]}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50/50 rounded-lg">
          <User size={16} />
          <span className="capitalize">{user?.role}</span>
        </div>
        {user?.department && (
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50/50 rounded-lg">
            <BookOpen size={16} />
            <span>{user.department} • {user?.branch} • {user?.year}</span>
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50/50 rounded-lg">
          <Mail size={16} />
          <span className="truncate">{user?.email}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ========== Responsive Sidebar ==========
const Sidebar = ({ isAdmin, mobileOpen, setMobileOpen }: { isAdmin: boolean; mobileOpen: boolean; setMobileOpen: (open: boolean) => void }) => {
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = isAdmin ? [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Bell, label: 'Notices', path: '/admin/notices' },
    { icon: AlertCircle, label: 'Issues', path: '/admin/issues' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
  ] : [
    { icon: Bell, label: 'Feed', path: '/' },
    { icon: AlertCircle, label: 'Report Issue', path: '/report' },
    { icon: Clock, label: 'My Complaints', path: '/my-issues' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/50">
      <div className="p-4 md:p-6 border-b border-slate-100/50">
        <div className="flex items-center gap-2">
          {/* Logo image */}
          <img src="/campushublogo.png" alt="CampusHub" className="h-8 w-auto" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CampusHub</h1>
        </div>
      </div>
      <nav className="flex-1 p-2 md:p-4 space-y-1 md:space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all duration-200",
                location.pathname === item.path
                  ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 font-medium shadow-sm border-l-4 border-indigo-500"
                  : "text-slate-500 hover:bg-slate-50/50 hover:text-slate-900"
              )}
            >
              <item.icon size={20} className={location.pathname === item.path ? "text-indigo-600" : ""} />
              <span className="text-sm md:text-base">{item.label}</span>
            </motion.div>
          </Link>
        ))}
      </nav>
      <div className="p-2 md:p-4 border-t border-slate-100/50">
        <motion.button
          whileHover={{ scale: 1.02, x: 5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            logout();
            setMobileOpen(false);
          }}
          className="flex items-center gap-3 px-3 md:px-4 py-2 md:py-3 w-full text-slate-500 hover:text-red-600 hover:bg-red-50/50 rounded-xl transition-all"
        >
          <LogOut size={20} />
          <span className="text-sm md:text-base">Logout</span>
        </motion.button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 20 }}
              className="absolute left-0 top-0 bottom-0 w-64 bg-white/95 backdrop-blur-xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ========== Responsive Navbar ==========
const Navbar = ({ userEmail, onSearch, onMenuClick }: { userEmail: string; onSearch?: (val: string) => void; onMenuClick: () => void }) => {
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { user } = useAuth();
  const profileRef = useRef<HTMLDivElement>(null);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm"
    >
      <div className="px-3 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 hover:bg-slate-100/50 rounded-lg text-slate-500"
          >
            <Menu size={24} />
          </button>
          <div className="md:hidden flex items-center gap-2">
            {/* Mobile logo */}
            <img src="/campushublogo.png" alt="CampusHub" className="h-8 w-auto" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CampusHub</h1>
          </div>

          {/* Desktop search */}
          <div className="hidden md:relative md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search notices, events..."
              onChange={(e) => onSearch?.(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-100/50 border border-slate-200/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/50 rounded-full w-64 transition-all outline-none text-sm backdrop-blur-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile search toggle */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 hover:bg-slate-100/50 rounded-lg text-slate-500"
          >
            <Search size={20} />
          </button>

          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{userEmail.split('@')[0]}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role || 'Student'}</p>
          </div>
          <div className="relative" ref={profileRef}>
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              onClick={() => setShowProfile(!showProfile)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md cursor-pointer text-sm md:text-base"
            >
              {userEmail[0].toUpperCase()}
            </motion.div>
            <AnimatePresence>
              {showProfile && <ProfilePopup user={user} onClose={() => setShowProfile(false)} />}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      <AnimatePresence>
        {showMobileSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3 md:hidden"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search notices, events..."
                onChange={(e) => onSearch?.(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100/50 border border-slate-200/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/50 rounded-xl transition-all outline-none text-sm backdrop-blur-sm"
                autoFocus
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

// ========== Student Views ==========

const NoticeFeed = ({ searchQuery }: { searchQuery: string }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [extractedDeadline, setExtractedDeadline] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNoticeImage, setSelectedNoticeImage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/notices')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setNotices(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Notice fetch error:", err);
        setLoading(false);
      });
  }, []);

  const handleNoticeClick = async (notice: Notice) => {
    setSelectedNotice(notice);
    setIsExtracting(true);
    setExtractedDeadline(null);
    fetch(`/api/notices/${notice.id}`);
    const deadline = await extractDeadline(notice.content);
    setExtractedDeadline(deadline);
    setIsExtracting(false);
  };

  const filteredNotices = notices.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filter === 'All' || n.category === filter;
    const matchesDept = deptFilter === 'All' || n.department === deptFilter || n.department === 'All';
    const matchesBranch = branchFilter === 'All' || n.branch === branchFilter || n.branch === 'All';
    const matchesYear = yearFilter === 'All' || n.year === yearFilter || n.year === 'All';
    return matchesSearch && matchesCategory && matchesDept && matchesBranch && matchesYear;
  });

  return (
    <div className="space-y-4 md:space-y-6 px-3 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
        >
          Campus Notices
        </motion.h2>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/50 text-sm font-medium text-slate-600"
        >
          <Filter size={16} />
          Filters
        </button>

        {/* Desktop filters */}
        <div className="hidden md:flex flex-wrap gap-2">
          <motion.select
            whileHover={{ scale: 1.02 }}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          >
            <option value="All">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </motion.select>
          <motion.select
            whileHover={{ scale: 1.02 }}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          >
            <option value="All">All Branches</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </motion.select>
          <motion.select
            whileHover={{ scale: 1.02 }}
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          >
            <option value="All">All Years</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </motion.select>
        </div>
      </div>

      {/* Mobile filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden"
          >
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 space-y-3">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="All">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="All">All Branches</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="All">All Years</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['All', ...CATEGORIES].map(cat => (
          <motion.button
            key={cat}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(cat)}
            className={cn(
              "px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all whitespace-nowrap backdrop-blur-sm",
              filter === cat
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                : "bg-white/80 text-slate-600 border border-slate-200 hover:border-indigo-300"
            )}
          >
            {cat}
          </motion.button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="h-48 bg-gradient-to-r from-slate-200 to-slate-300 animate-pulse rounded-2xl"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <AnimatePresence mode="popLayout">
            {filteredNotices.map((notice, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                key={notice.id}
                onClick={() => handleNoticeClick(notice)}
                className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-xl transition-all group cursor-pointer relative overflow-hidden"
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-500" />
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    className={cn(
                      "px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider backdrop-blur-sm",
                      notice.category === 'Urgent' ? "bg-red-100/80 text-red-600" :
                        notice.category === 'Exam' ? "bg-orange-100/80 text-orange-600" :
                          "bg-indigo-100/80 text-indigo-600"
                    )}
                  >
                    {notice.category}
                  </motion.span>
                  <span className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={10} className="md:w-3 md:h-3" />
                    {safeFormatDate(notice.date_posted, 'MMM d, yyyy')}
                  </span>
                </div>

                {notice.photo_url && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="mb-3 md:mb-4 overflow-hidden rounded-xl"
                  >
                    <img
                      src={notice.photo_url}
                      alt="Notice"
                      className="w-full h-32 md:h-40 object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
                    />
                  </motion.div>
                )}

                <h3 className="text-base md:text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">{notice.title}</h3>
                <p className="text-slate-600 text-xs md:text-sm line-clamp-3 mb-3 md:mb-4">{notice.content}</p>

                <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-slate-100/50">
                  <div className="flex gap-1 md:gap-2">
                    {notice.branch && notice.branch !== 'All' && <span className="text-[8px] md:text-[10px] bg-slate-100/80 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-slate-500 backdrop-blur-sm">{notice.branch}</span>}
                    {notice.year && notice.year !== 'All' && <span className="text-[8px] md:text-[10px] bg-slate-100/80 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-slate-500 backdrop-blur-sm">{notice.year}</span>}
                  </div>
                  <motion.button
                    whileHover={{ x: 5 }}
                    className="text-indigo-600 text-xs md:text-sm font-semibold flex items-center gap-1"
                  >
                    Read More <ChevronRight size={12} className="md:w-4 md:h-4" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {selectedNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-md"
            onClick={() => setSelectedNotice(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-white/90 backdrop-blur-xl w-full max-w-2xl rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 md:p-6 border-b border-slate-100/50 flex items-center justify-between">
                <span className="px-2 md:px-3 py-1 bg-indigo-100/80 text-indigo-600 rounded-full text-[10px] md:text-xs font-bold uppercase backdrop-blur-sm">{selectedNotice.category}</span>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  onClick={() => setSelectedNotice(null)}
                  className="p-1.5 md:p-2 hover:bg-slate-100/50 rounded-full transition-all text-slate-400"
                >
                  <X size={18} className="md:w-5 md:h-5" />
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {selectedNotice.photo_url && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-4 md:mb-6 cursor-pointer"
                    onClick={() => setSelectedNoticeImage(selectedNotice.photo_url!)}
                  >
                    <img
                      src={selectedNotice.photo_url}
                      alt="Notice"
                      className="max-h-48 md:max-h-64 w-full object-cover rounded-xl shadow-md hover:opacity-90 transition-opacity"
                    />
                  </motion.div>
                )}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl md:text-3xl font-bold text-slate-900 mb-3 md:mb-4"
                >
                  {selectedNotice.title}
                </motion.h2>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-slate-500 mb-4 md:mb-8 flex-wrap"
                >
                  <span className="flex items-center gap-1"><Clock size={12} className="md:w-4 md:h-4" /> {safeFormatDate(selectedNotice.date_posted, 'MMMM d, yyyy')}</span>
                  <span className="flex items-center gap-1"><Users size={12} className="md:w-4 md:h-4" /> {selectedNotice.branch || 'All Branches'}</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="prose prose-sm md:prose-base prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap"
                >
                  {selectedNotice.content}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 md:mt-12 p-4 md:p-6 bg-indigo-50/80 backdrop-blur-sm rounded-2xl border border-indigo-100/50"
                >
                  <div className="flex items-center gap-2 mb-3 md:mb-4">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md"><Calendar size={14} className="md:w-5 md:h-5" /></div>
                    <h4 className="font-bold text-indigo-900 text-sm md:text-base">Smart Calendar Reminder</h4>
                  </div>
                  {isExtracting ? (
                    <div className="flex items-center gap-2 md:gap-3 text-indigo-600">
                      <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                      <span className="text-xs md:text-sm font-medium">AI is extracting deadlines...</span>
                    </div>
                  ) : extractedDeadline ? (
                    <div className="space-y-3 md:space-y-4">
                      <div className="bg-white p-3 md:p-4 rounded-xl border border-indigo-200/50">
                        <p className="text-[10px] md:text-xs font-bold text-indigo-400 uppercase mb-1">Detected Event</p>
                        <p className="font-bold text-slate-900 text-sm md:text-base">{extractedDeadline.event}</p>
                        <p className="text-xs md:text-sm text-slate-500 mt-2 flex items-center gap-1"><Clock size={12} className="md:w-4 md:h-4" /> {extractedDeadline.date || 'Date not specified'}</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => generateCalendarEvent({
                          title: extractedDeadline.event,
                          description: extractedDeadline.description || selectedNotice.content,
                          date: extractedDeadline.date
                        })}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-2 md:py-3 text-sm md:text-base rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={14} className="md:w-5 md:h-5" /> Add to Calendar
                      </motion.button>
                    </div>
                  ) : (
                    <p className="text-xs md:text-sm text-indigo-600 italic">No specific deadlines detected in this notice.</p>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image modal for notice images */}
      <AnimatePresence>
        {selectedNoticeImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedNoticeImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ type: "spring", damping: 20 }}
              className="relative max-w-4xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={selectedNoticeImage} alt="Notice full size" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
              <motion.button
                whileHover={{ scale: 1.1 }}
                onClick={() => setSelectedNoticeImage(null)}
                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ========== ReportIssue with error handling (already responsive) ==========
const ReportIssue = ({ userEmail }: { userEmail: string }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: ISSUE_CATEGORIES[0],
    department: DEPARTMENTS[0],
    location_name: ''
  });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAiAnalyzing(true);
    setError(null);
    const aiResult = await classifyIssuePriority(formData.description);
    const formDataToSend = new FormData();
    formDataToSend.append('student_email', userEmail);
    formDataToSend.append('title', formData.title);
    formDataToSend.append('description', formData.description);
    formDataToSend.append('category', formData.category);
    formDataToSend.append('department', formData.department);
    formDataToSend.append('location_name', formData.location_name);
    if (location?.lat) formDataToSend.append('location_lat', location.lat.toString());
    if (location?.lng) formDataToSend.append('location_lng', location.lng.toString());
    formDataToSend.append('priority', aiResult.priority);
    if (photo) formDataToSend.append('photo', photo);

    const res = await fetch('/api/issues', {
      method: 'POST',
      body: formDataToSend,
    });

    if (res.ok) {
      navigate('/my-issues');
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to submit issue. Please try again.');
    }
    setIsSubmitting(false);
    setAiAnalyzing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto px-3 md:px-0"
    >
      <div className="bg-white/80 backdrop-blur-xl p-4 md:p-8 rounded-3xl border border-slate-200/50 shadow-xl hover:shadow-2xl transition-all">
        <div className="flex items-center gap-3 mb-8">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-red-50 to-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-md"
          >
            <AlertCircle size={20} className="md:w-6 md:h-6" />
          </motion.div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">Report an Issue</h2>
            <p className="text-slate-500 text-xs md:text-sm">Help us keep the campus in top shape.</p>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-4 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-600 rounded-xl text-sm"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="space-y-1 md:space-y-2">
            <label className="text-xs md:text-sm font-semibold text-slate-700">Issue Title</label>
            <input
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Broken fan in Room 302"
              className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all bg-white/50 backdrop-blur-sm text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm font-semibold text-slate-700">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none appearance-none bg-white/50 backdrop-blur-sm text-sm"
              >
                {ISSUE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm font-semibold text-slate-700">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none appearance-none bg-white/50 backdrop-blur-sm text-sm"
              >
                {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1 md:space-y-2">
            <label className="text-xs md:text-sm font-semibold text-slate-700">Building/Location</label>
            <input
              required
              value={formData.location_name}
              onChange={e => setFormData({ ...formData, location_name: e.target.value })}
              placeholder="e.g., Block A, 3rd Floor"
              className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all bg-white/50 backdrop-blur-sm text-sm"
            />
          </div>
          <div className="space-y-1 md:space-y-2">
            <label className="text-xs md:text-sm font-semibold text-slate-700">Description</label>
            <textarea
              required
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Describe the issue in detail..."
              className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none bg-white/50 backdrop-blur-sm text-sm"
            />
          </div>
          <div className="space-y-1 md:space-y-2">
            <label className="text-xs md:text-sm font-semibold text-slate-700">Photo Evidence (Optional)</label>
            <div className="flex items-center justify-center w-full">
              <motion.label
                whileHover={{ scale: 1.02 }}
                className="flex flex-col items-center justify-center w-full h-24 md:h-32 border-2 border-slate-200/50 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-100/50 transition-all relative overflow-hidden backdrop-blur-sm"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-4 pb-5">
                    <Plus className="w-6 h-6 md:w-8 md:h-8 text-slate-400 mb-1 md:mb-2" />
                    <p className="text-xs md:text-sm text-slate-500">Click to upload photo</p>
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
              </motion.label>
            </div>
            {photoPreview && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                type="button"
                onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                className="text-xs text-red-600 hover:underline mt-1"
              >
                Remove photo
              </motion.button>
            )}
          </div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-3 md:p-4 bg-slate-50/50 backdrop-blur-sm rounded-2xl flex items-center justify-between border border-slate-200/50"
          >
            <div className="flex items-center gap-2 md:gap-3">
              <MapPin className={cn(location ? "text-green-500" : "text-slate-400")} size={16} className="md:w-5 md:h-5" />
              <span className="text-xs md:text-sm text-slate-600">
                {location ? "Location Captured" : "Auto-detect Location"}
              </span>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={handleGetLocation}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              {location ? "Refresh" : "Enable"}
            </motion.button>
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 md:py-4 text-sm md:text-base rounded-2xl transition-all shadow-lg shadow-indigo-200/50 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {aiAnalyzing ? "AI Prioritizing..." : "Submitting..."}
              </>
            ) : (
              "Submit Report"
            )}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
};

// ========== MyIssues with clickable images and GPS location (already responsive) ==========
const MyIssues = ({ userEmail }: { userEmail: string }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/issues/student/${userEmail}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setIssues(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch issues error:", err);
        setLoading(false);
      });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ISSUE_UPDATED') {
          setIssues(prev => Array.isArray(prev) ? prev.map(issue => issue.id === msg.data.id ? msg.data : issue) : []);
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    };
    return () => socket.close();
  }, [userEmail]);

  return (
    <div className="space-y-4 md:space-y-6 px-3 md:px-0">
      <motion.h2
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
      >
        My Reported Issues
      </motion.h2>
      {loading ? (
        <div className="space-y-3 md:space-y-4">
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="h-20 md:h-24 bg-gradient-to-r from-slate-200 to-slate-300 animate-pulse rounded-2xl"
            />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 md:py-20 bg-white/80 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300/50"
        >
          <AlertCircle className="mx-auto text-slate-300 mb-3 md:mb-4" size={40} className="md:w-12 md:h-12" />
          <p className="text-slate-500 text-sm md:text-base">You haven't reported any issues yet.</p>
          <Link to="/report" className="text-indigo-600 font-bold mt-2 inline-block text-sm md:text-base hover:underline">Report your first issue</Link>
        </motion.div>
      ) : (
        <>
          <div className="space-y-3 md:space-y-4">
            {issues.map(issue => {
              const mapsLink = getGoogleMapsLink(issue.location_lat, issue.location_lng);
              return (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.01, x: 5 }}
                  key={issue.id}
                  className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-slate-200/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 group hover:border-indigo-200/50 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start sm:items-center gap-3 md:gap-4 w-full sm:w-auto">
                    <motion.div
                      whileHover={{ rotate: 10 }}
                      className={cn(
                        "w-8 h-8 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                        issue.status === 'Resolved' ? "bg-green-50 text-green-600" :
                          issue.status === 'In Progress' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                      )}
                    >
                      {issue.status === 'Resolved' ? <CheckCircle2 size={16} className="md:w-6 md:h-6" /> : <Clock size={16} className="md:w-6 md:h-6" />}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm md:text-base">{issue.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {mapsLink ? (
                          <a
                            href={mapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] md:text-xs text-slate-500 flex items-center gap-1 hover:text-indigo-600 transition-colors"
                          >
                            <MapPin size={10} className="md:w-3 md:h-3" /> {issue.location_name} ({issue.department})
                          </a>
                        ) : (
                          <span className="text-[10px] md:text-xs text-slate-500 flex items-center gap-1">
                            <MapPin size={10} className="md:w-3 md:h-3" /> {issue.location_name} ({issue.department})
                          </span>
                        )}
                        <span className={cn(
                          "text-[8px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded uppercase",
                          issue.priority === 'High' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {issue.priority} Priority
                        </span>
                      </div>
                      {issue.location_lat && issue.location_lng && (
                        <p className="text-[8px] md:text-[10px] text-slate-400 mt-1">
                          GPS: {issue.location_lat.toFixed(6)}, {issue.location_lng.toFixed(6)}
                        </p>
                      )}
                      {issue.photo_url && (
                        <motion.img
                          whileHover={{ scale: 1.1 }}
                          src={issue.photo_url}
                          alt="Issue"
                          className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg mt-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedImage(issue.photo_url!)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="text-right w-full sm:w-auto flex sm:block justify-between items-center sm:items-end gap-2">
                    <span className={cn(
                      "px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold",
                      issue.status === 'Resolved' ? "bg-green-100 text-green-700" :
                        issue.status === 'In Progress' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {issue.status}
                    </span>
                    <p className="text-[8px] md:text-[10px] text-slate-400 mt-1">{safeFormatDate(issue.created_at, 'MMM d, h:mm a')}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Image modal */}
          <AnimatePresence>
            {selectedImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={() => setSelectedImage(null)}
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  transition={{ type: "spring", damping: 20 }}
                  className="relative max-w-4xl max-h-[90vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img src={selectedImage} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
                  >
                    <X size={20} className="md:w-6 md:h-6" />
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

// ========== SmartCalendar (already responsive) ==========
const SmartCalendar = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const res = await fetch('/api/notices');
      const notices = await res.json();
      const extracted = await Promise.all(notices.slice(0, 5).map(async (n: Notice) => {
        const deadline = await extractDeadline(n.content);
        if (deadline && deadline.date) {
          return { ...deadline, noticeId: n.id };
        }
        return null;
      }));
      setEvents(extracted.filter(e => e !== null));
      setLoading(false);
    };
    fetchEvents();
  }, []);

  return (
    <div className="space-y-6 md:space-y-8 px-3 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
        >
          Smart Campus Calendar
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-r from-indigo-50 to-purple-50 px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center gap-2 text-indigo-600 text-xs md:text-sm font-bold backdrop-blur-sm w-fit"
        >
          <Calendar size={14} className="md:w-4 md:h-4" /> AI Powered
        </motion.div>
      </div>
      {loading ? (
        <div className="space-y-3 md:space-y-4">
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="h-24 md:h-32 bg-gradient-to-r from-slate-200 to-slate-300 animate-pulse rounded-3xl"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {events.map((event, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              key={i}
              className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-3xl border border-slate-200/50 shadow-sm hover:shadow-xl transition-all flex flex-col sm:flex-row gap-4"
            >
              <motion.div
                whileHover={{ rotate: 5 }}
                className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-md flex-shrink-0"
              >
                <span className="text-[10px] md:text-xs font-bold uppercase">{event.date.split(' ')[0]}</span>
                <span className="text-xl md:text-2xl font-black">{event.date.split(' ')[1] || i + 10}</span>
              </motion.div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-base md:text-lg truncate">{event.event}</h3>
                <p className="text-xs md:text-sm text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => generateCalendarEvent({
                      title: event.event,
                      description: event.description || '',
                      date: event.date
                    })}
                    className="text-xs font-bold px-2 md:px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-md transition-all"
                  >
                    Add to Calendar
                  </motion.button>
                  <Link to="/" className="text-xs font-bold px-2 md:px-3 py-1.5 bg-slate-100/80 text-slate-600 rounded-lg hover:bg-slate-200/80 transition-all backdrop-blur-sm">View Notice</Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Admin Views ---

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>({ totalIssues: 0, resolvedIssues: 0, highPriority: 0, totalViews: 0, topQuestions: [] });
  const [recentIssues, setRecentIssues] = useState<Issue[]>([]);
  const [categoryDist, setCategoryDist] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/analytics/summary')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setCategoryDist(data.categoryDist);
      });
    fetch('/api/issues')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRecentIssues(data.slice(0, 5));
        }
      });
  }, []);

  return (
    <div className="space-y-6 md:space-y-8 px-3 md:px-0">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Admin Overview</h2>
        <div className="text-xs md:text-sm text-slate-500">Last updated: {format(new Date(), 'h:mm a')}</div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        {[
          { label: 'Total Issues', value: stats.totalIssues, color: 'indigo', icon: AlertCircle },
          { label: 'Resolved Rate', value: stats.totalIssues ? `${Math.round((stats.resolvedIssues / stats.totalIssues) * 100)}%` : '0%', color: 'green', icon: CheckCircle2 },
          { label: 'Notice Views', value: stats.totalViews, color: 'blue', icon: Bell },
          { label: 'High Priority', value: stats.highPriority, color: 'red', icon: AlertCircle },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className="bg-white/80 backdrop-blur-sm p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200/50 shadow-sm hover:shadow-xl transition-all"
          >
            <div className={cn("w-6 h-6 md:w-10 md:h-10 rounded-xl flex items-center justify-center mb-2 md:mb-4",
              stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                stat.color === 'green' ? "bg-green-50 text-green-600" :
                  stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                    "bg-red-50 text-red-600"
            )}>
              <stat.icon size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-slate-500 text-[10px] md:text-sm font-medium">{stat.label}</p>
            <p className="text-lg md:text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-sm p-4 md:p-8 rounded-3xl border border-slate-200/50 shadow-sm"
          >
            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-4 md:mb-6">Issue Distribution by Category</h3>
            <div className="h-48 md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryDist}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/80 backdrop-blur-sm p-4 md:p-8 rounded-3xl border border-slate-200/50 shadow-sm"
          >
            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-4 md:mb-6">Top Asked Questions (FAQ Bot)</h3>
            <div className="space-y-2 md:space-y-4">
              {stats.topQuestions?.map((q: any, i: number) => (
                <motion.div
                  key={i}
                  whileHover={{ x: 5 }}
                  className="flex items-center justify-between p-2 md:p-4 bg-slate-50/80 backdrop-blur-sm rounded-xl md:rounded-2xl border border-slate-200/50"
                >
                  <span className="text-xs md:text-sm font-medium text-slate-700">{q.q}</span>
                  <span className="bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-600 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold">{q.count} hits</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-sm p-4 md:p-8 rounded-3xl border border-slate-200/50 shadow-sm h-fit sticky top-24"
        >
          <h3 className="text-base md:text-lg font-bold text-slate-900 mb-4 md:mb-6">Recent Reports</h3>
          <div className="space-y-2 md:space-y-4">
            {recentIssues.map(issue => (
              <motion.div
                key={issue.id}
                whileHover={{ x: 5 }}
                className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl md:rounded-2xl hover:bg-slate-50/50 transition-all cursor-pointer"
              >
                <div className={cn(
                  "w-1.5 h-1.5 md:w-2 md:h-2 rounded-full",
                  issue.priority === 'High' ? "bg-red-500" : "bg-indigo-500"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-bold text-slate-900 truncate">{issue.title}</p>
                  <p className="text-[10px] md:text-xs text-slate-500">{issue.location_name}</p>
                </div>
                <ChevronRight size={12} className="md:w-4 md:h-4 text-slate-300" />
              </motion.div>
            ))}
            <Link to="/admin/issues" className="block text-center text-indigo-600 text-xs md:text-sm font-bold mt-3 md:mt-4 hover:underline">View All Issues</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// ========== IssueManagement with GPS location and clickable images (already responsive with scroll) ==========
const IssueManagement = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState('All');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/issues')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setIssues(data);
        }
      })
      .catch(err => console.error("Issue management fetch error:", err));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'NEW_ISSUE') {
          setIssues(prev => Array.isArray(prev) ? [msg.data, ...prev] : [msg.data]);
        } else if (msg.type === 'ISSUE_UPDATED') {
          setIssues(prev => Array.isArray(prev) ? prev.map(i => i.id === msg.data.id ? msg.data : i) : []);
        }
      } catch (e) {
        console.error("WS Admin Message Error:", e);
      }
    };
    return () => socket.close();
  }, []);

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  };

  const filteredIssues = filter === 'All' ? issues : issues.filter(i => i.status === filter);

  return (
    <div className="space-y-4 md:space-y-6 px-3 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Manage Issues</h2>
        <div className="flex flex-wrap gap-2">
          {['All', 'Pending', 'In Progress', 'Resolved'].map(s => (
            <motion.button
              key={s}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(s)}
              className={cn(
                "px-2 md:px-4 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-all backdrop-blur-sm",
                filter === s
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                  : "bg-white/80 text-slate-600 border border-slate-200/50 hover:border-indigo-300"
              )}
            >
              {s}
            </motion.button>
          ))}
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/50 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100/50">
                <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Issue</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Coordinates</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Photo</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/50">
              {filteredIssues.map(issue => {
                const mapsLink = getGoogleMapsLink(issue.location_lat, issue.location_lng);
                return (
                  <motion.tr
                    key={issue.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: "rgba(249, 250, 251, 0.5)" }}
                    className="transition-all"
                  >
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <p className="font-bold text-slate-900 text-xs md:text-sm">{issue.title}</p>
                      <p className="text-[10px] md:text-xs text-slate-500 truncate max-w-[150px] md:max-w-[200px]">{issue.description}</p>
                      <p className="text-[8px] md:text-[10px] text-indigo-600 font-medium mt-1">{issue.department}</p>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-sm text-slate-600">
                      {mapsLink ? (
                        <a
                          href={mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-indigo-600 underline underline-offset-2 flex items-center gap-1"
                        >
                          <MapPin size={10} className="md:w-3 md:h-3" /> {issue.location_name}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} className="md:w-3 md:h-3" /> {issue.location_name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs text-slate-500">
                      {issue.location_lat && issue.location_lng ? (
                        <span>
                          {issue.location_lat.toFixed(6)}, {issue.location_lng.toFixed(6)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <span className={cn(
                        "px-1 md:px-2 py-0.5 md:py-1 rounded text-[8px] md:text-[10px] font-bold uppercase",
                        issue.priority === 'High' ? "bg-red-100 text-red-600" :
                          issue.priority === 'Medium' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                      )}>
                        {issue.priority}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      {issue.photo_url ? (
                        <img
                          src={issue.photo_url}
                          alt="Issue"
                          className="w-8 h-8 md:w-12 md:h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedImage(issue.photo_url!)}
                        />
                      ) : (
                        <span className="text-slate-400 text-[10px] md:text-xs">No photo</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <span className={cn(
                        "px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold",
                        issue.status === 'Resolved' ? "bg-green-100 text-green-700" :
                          issue.status === 'In Progress' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex gap-1 md:gap-2">
                        {issue.status !== 'In Progress' && issue.status !== 'Resolved' && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(issue.id, 'In Progress')}
                            className="p-1 md:p-2 text-blue-600 hover:bg-blue-50/80 rounded-lg transition-all"
                            title="Mark In Progress"
                          >
                            <Clock size={12} className="md:w-4 md:h-4" />
                          </motion.button>
                        )}
                        {issue.status !== 'Resolved' && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(issue.id, 'Resolved')}
                            className="p-1 md:p-2 text-green-600 hover:bg-green-50/80 rounded-lg transition-all"
                            title="Mark Resolved"
                          >
                            <CheckCircle2 size={12} className="md:w-4 md:h-4" />
                          </motion.button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ type: "spring", damping: 20 }}
              className="relative max-w-4xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={selectedImage} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
              <motion.button
                whileHover={{ scale: 1.1 }}
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ========== NoticeManagement with photo upload (already responsive) ==========
const NoticeManagement = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: CATEGORIES[0],
    department: 'Engineering',
    branch: 'All',
    year: 'All'
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    const res = await fetch('/api/notices');
    const data = await res.json();
    setNotices(data);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingNotice 
      ? `/api/notices/${editingNotice.id}`
      : '/api/notices';
    const method = editingNotice ? 'PUT' : 'POST';

    const formDataToSend = new FormData();
    formDataToSend.append('title', formData.title);
    formDataToSend.append('content', formData.content);
    formDataToSend.append('category', formData.category);
    formDataToSend.append('department', formData.department);
    formDataToSend.append('branch', formData.branch);
    formDataToSend.append('year', formData.year);
    if (photo) formDataToSend.append('photo', photo);

    try {
      const res = await fetch(url, {
        method,
        body: formDataToSend,
      });

      if (res.ok) {
        fetchNotices();
        setShowForm(false);
        setEditingNotice(null);
        setFormData({ title: '', content: '', category: CATEGORIES[0], department: 'Engineering', branch: 'All', year: 'All' });
        setPhoto(null);
        setPhotoPreview(null);
        setError(null);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save notice');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Network error. Check server connection.');
    }
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      department: notice.department || 'Engineering',
      branch: notice.branch || 'All',
      year: notice.year || 'All'
    });
    if (notice.photo_url) {
      setPhotoPreview(notice.photo_url);
    }
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setNotices(notices.filter(n => n.id !== id));
      setDeleteConfirm(null);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete notice');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 px-3 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Manage Notices</h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setEditingNotice(null);
            setFormData({ title: '', content: '', category: CATEGORIES[0], department: 'Engineering', branch: 'All', year: 'All' });
            setPhoto(null);
            setPhotoPreview(null);
            setError(null);
            setShowForm(true);
          }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 md:px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all text-sm md:text-base"
        >
          <Plus size={16} className="md:w-5 md:h-5" /> Post Notice
        </motion.button>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-md"
            onClick={() => {
              setShowForm(false);
              setEditingNotice(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-white/90 backdrop-blur-xl w-full max-w-xl rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh] border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-lg md:text-xl font-bold text-slate-900">
                  {editingNotice ? 'Edit Notice' : 'Post New Notice'}
                </h3>
                <motion.button
                  whileHover={{ rotate: 90 }}
                  onClick={() => {
                    setShowForm(false);
                    setEditingNotice(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} className="md:w-6 md:h-6" />
                </motion.button>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-4 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-600 rounded-xl text-sm"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                <input
                  required
                  placeholder="Notice Title"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all bg-white/50 backdrop-blur-sm text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none bg-white/50 backdrop-blur-sm text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none bg-white/50 backdrop-blur-sm text-sm"
                  >
                    <option value="All">All Departments</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <select
                    value={formData.branch}
                    onChange={e => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none bg-white/50 backdrop-blur-sm text-sm"
                  >
                    <option value="All">All Branches</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select
                    value={formData.year}
                    onChange={e => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none bg-white/50 backdrop-blur-sm text-sm"
                  >
                    <option value="All">All Years</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-1 md:space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-slate-700">Attach Image (Optional)</label>
                  <motion.label
                    whileHover={{ scale: 1.02 }}
                    className="flex flex-col items-center justify-center w-full h-24 md:h-32 border-2 border-slate-200/50 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-100/50 transition-all relative overflow-hidden backdrop-blur-sm"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-4 pb-5">
                        <Plus className="w-5 h-5 md:w-8 md:h-8 text-slate-400 mb-1 md:mb-2" />
                        <p className="text-xs md:text-sm text-slate-500">Click to upload image</p>
                      </div>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />
                  </motion.label>
                  {photoPreview && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      type="button"
                      onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                      className="text-xs text-red-600 hover:underline mt-1"
                    >
                      Remove image
                    </motion.button>
                  )}
                </div>
                <textarea
                  required
                  placeholder="Notice Content"
                  rows={6}
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 md:px-4 py-2 md:py-3 rounded-xl border border-slate-200/50 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none bg-white/50 backdrop-blur-sm text-sm"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-2 md:py-4 text-sm md:text-base rounded-2xl hover:shadow-lg transition-all"
                >
                  {editingNotice ? 'Update Notice' : 'Publish Notice'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 md:p-6 max-w-sm w-full shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base md:text-lg font-bold text-slate-900 mb-3 md:mb-4">Confirm Delete</h3>
              <p className="text-sm md:text-base text-slate-600 mb-5 md:mb-6">Are you sure you want to delete this notice? This action cannot be undone.</p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold py-2 md:py-3 text-sm md:text-base rounded-xl hover:shadow-lg transition-all"
                >
                  Delete
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-slate-100/80 text-slate-700 font-bold py-2 md:py-3 text-sm md:text-base rounded-xl hover:bg-slate-200/80 transition-all backdrop-blur-sm"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notices List */}
      <div className="grid grid-cols-1 gap-3 md:gap-4">
        {notices.map(notice => (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5, scale: 1.01 }}
            className="bg-white/80 backdrop-blur-sm p-3 md:p-6 rounded-2xl border border-slate-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-indigo-200/50 hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-3 md:gap-4">
              {notice.photo_url && (
                <img src={notice.photo_url} alt="Notice" className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg" />
              )}
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-sm md:text-base truncate">{notice.title}</h4>
                <p className="text-[10px] md:text-xs text-slate-500 mt-1">
                  {notice.category} • {format(new Date(notice.date_posted), 'MMM d, yyyy')} • {notice.views || 0} views
                </p>
              </div>
            </div>
            <div className="flex gap-2 self-end sm:self-center">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleEdit(notice)}
                className="p-1.5 md:p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-lg transition-all"
                title="Edit Notice"
              >
                <Settings size={14} className="md:w-5 md:h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setDeleteConfirm(notice.id)}
                className="p-1.5 md:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50/80 rounded-lg transition-all"
                title="Delete Notice"
              >
                <X size={14} className="md:w-5 md:h-5" />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ========== Chatbot (already responsive) ==========
const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: 'Hi! I am CampusBuddy, your friendly campus assistant. How can I help you today? 😊' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationContext, setConversationContext] = useState<any>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const [faqsRes, noticesRes] = await Promise.all([
        fetch('/api/faqs'),
        fetch('/api/notices')
      ]);
      
      let faqs = [];
      if (faqsRes.ok) {
        faqs = await faqsRes.json();
      } else {
        console.warn('Failed to fetch FAQs');
      }
      
      let notices = [];
      if (noticesRes.ok) {
        notices = await noticesRes.json();
      } else {
        console.warn('Failed to fetch notices');
      }

      const response = await getChatbotResponse(userMsg, faqs, notices, conversationContext);
      
      const botText = typeof response.text === 'string' ? response.text : "Hmm, I didn't quite get that.";
      
      setMessages(prev => [...prev, { role: 'bot', text: botText }]);
      setConversationContext(response.newContext || {});
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I'm having trouble connecting. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", damping: 20 }}
            className="bg-white/90 backdrop-blur-xl w-72 md:w-80 h-[400px] md:h-[450px] rounded-3xl shadow-2xl border border-white/20 flex flex-col overflow-hidden mb-2 md:mb-4"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3 md:p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-6 h-6 md:w-8 md:h-8 bg-white/20 rounded-full flex items-center justify-center"
                >
                  <MessageSquare size={12} className="md:w-4 md:h-4" />
                </motion.div>
                <span className="font-bold text-sm md:text-base">CampusBuddy</span>
              </div>
              <motion.button
                whileHover={{ rotate: 90 }}
                onClick={() => setIsOpen(false)}
              >
                <X size={16} className="md:w-5 md:h-5" />
              </motion.button>
            </div>
            <div ref={scrollRef} className="flex-1 p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4 bg-slate-50/50">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}
                >
                  <div className={cn(
                    "max-w-[80%] p-2 md:p-3 rounded-2xl text-xs md:text-sm shadow-md",
                    m.role === 'user'
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none"
                      : "bg-white text-slate-700 border border-slate-200/50 rounded-tl-none"
                  )}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white p-2 md:p-3 rounded-2xl rounded-tl-none border border-slate-200/50 flex gap-1">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-300 rounded-full"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                      className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-300 rounded-full"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                      className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-300 rounded-full"
                    />
                  </div>
                </motion.div>
              )}
            </div>
            <div className="p-2 md:p-4 border-t border-slate-100/50 flex gap-2 bg-white/50 backdrop-blur-sm">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 text-xs md:text-sm bg-slate-100/50 border-none rounded-xl px-3 md:px-4 py-1.5 md:py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm"
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSend}
                className="p-1.5 md:p-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-md transition-all"
              >
                <Send size={14} className="md:w-5 md:h-5" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={isOpen ? "open" : "closed"}
        variants={{
          open: { rotate: 90 },
          closed: { rotate: 0 }
        }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg shadow-indigo-200/50 flex items-center justify-center"
      >
        {isOpen ? <X size={18} className="md:w-6 md:h-6" /> : <MessageSquare size={18} className="md:w-6 md:h-6" />}
      </motion.button>
    </div>
  );
};

// --- Main App Layout ---
const AppLayout = ({ children, onSearch }: { children: React.ReactNode; onSearch?: (val: string) => void }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <Sidebar isAdmin={isAdmin} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col">
        <Navbar
          userEmail={user?.email || ''}
          onSearch={onSearch}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-3 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
        <Chatbot />
      </div>
    </div>
  );
};

// --- Main App Routes ---
const AppRoutes = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AppLayout>
            <Routes>
              <Route index element={<AdminDashboard />} />
              <Route path="notices" element={<NoticeManagement />} />
              <Route path="issues" element={<IssueManagement />} />
              <Route path="analytics" element={<div className="p-20 text-center text-slate-400">Analytics Detail View Coming Soon</div>} />
            </Routes>
          </AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/*" element={
        <ProtectedRoute allowedRoles={['student']}>
          <AppLayout onSearch={setSearchQuery}>
            <Routes>
              <Route index element={<NoticeFeed searchQuery={searchQuery} />} />
              <Route path="report" element={<ReportIssue userEmail={user?.email || ''} />} />
              <Route path="my-issues" element={<MyIssues userEmail={user?.email || ''} />} />
              <Route path="calendar" element={<SmartCalendar />} />
            </Routes>
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

// --- Root App ---
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}