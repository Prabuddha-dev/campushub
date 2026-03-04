// src/App.tsx
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
  Map
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
  date_posted: string;
  views?: number;
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

// --- Sidebar with logout ---
const Sidebar = ({ isAdmin }: { isAdmin: boolean }) => {
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

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
          <h1 className="text-xl font-bold text-slate-900">CampusHub</h1>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              location.pathname === item.path
                ? "bg-indigo-50 text-indigo-600 font-medium"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

// --- Navbar ---
const Navbar = ({ userEmail, onSearch }: { userEmail: string; onSearch?: (val: string) => void }) => (
  <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
    <div className="flex items-center gap-4">
      <button className="lg:hidden text-slate-500"><Menu size={24} /></button>
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search notices, events..."
          onChange={(e) => onSearch?.(e.target.value)}
          className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-full w-64 transition-all outline-none text-sm"
        />
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-slate-900">{userEmail.split('@')[0]}</p>
        <p className="text-xs text-slate-500">Student</p>
      </div>
      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
        {userEmail[0].toUpperCase()}
      </div>
    </div>
  </header>
);

// --- Student Views ---

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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Campus Notices</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium outline-none"
          >
            <option value="All">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium outline-none"
          >
            <option value="All">All Branches</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium outline-none"
          >
            <option value="All">All Years</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              filter === cat ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredNotices.map((notice) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={notice.id}
                onClick={() => handleNoticeClick(notice)}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    notice.category === 'Urgent' ? "bg-red-100 text-red-600" :
                      notice.category === 'Exam' ? "bg-orange-100 text-orange-600" :
                        "bg-indigo-100 text-indigo-600"
                  )}>
                    {notice.category}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    {safeFormatDate(notice.date_posted, 'MMM d, yyyy')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{notice.title}</h3>
                <p className="text-slate-600 text-sm line-clamp-3 mb-4">{notice.content}</p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex gap-2">
                    {notice.branch && notice.branch !== 'All' && <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">{notice.branch}</span>}
                    {notice.year && notice.year !== 'All' && <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">{notice.year}</span>}
                  </div>
                  <button className="text-indigo-600 text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                    Read More <ChevronRight size={16} />
                  </button>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold uppercase">{selectedNotice.category}</span>
                <button onClick={() => setSelectedNotice(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">{selectedNotice.title}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-500 mb-8">
                  <span className="flex items-center gap-1"><Clock size={16} /> {safeFormatDate(selectedNotice.date_posted, 'MMMM d, yyyy')}</span>
                  <span className="flex items-center gap-1"><Users size={16} /> {selectedNotice.branch || 'All Branches'}</span>
                </div>
                <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedNotice.content}
                </div>
                <div className="mt-12 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Calendar size={18} /></div>
                    <h4 className="font-bold text-indigo-900">Smart Calendar Reminder</h4>
                  </div>
                  {isExtracting ? (
                    <div className="flex items-center gap-3 text-indigo-600">
                      <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                      <span className="text-sm font-medium">AI is extracting deadlines...</span>
                    </div>
                  ) : extractedDeadline ? (
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-xl border border-indigo-200">
                        <p className="text-xs font-bold text-indigo-400 uppercase mb-1">Detected Event</p>
                        <p className="font-bold text-slate-900">{extractedDeadline.event}</p>
                        <p className="text-sm text-slate-500 mt-2 flex items-center gap-1"><Clock size={14} /> {extractedDeadline.date || 'Date not specified'}</p>
                      </div>
                      <button
                        onClick={() => generateCalendarEvent({
                          title: extractedDeadline.event,
                          description: extractedDeadline.description || selectedNotice.content,
                          date: extractedDeadline.date
                        })}
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={18} /> Add to Calendar
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-indigo-600 italic">No specific deadlines detected in this notice.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ========== ReportIssue with error handling ==========
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Report an Issue</h2>
            <p className="text-slate-500 text-sm">Help us keep the campus in top shape.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Issue Title</label>
            <input
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Broken fan in Room 302"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
              >
                {ISSUE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
              >
                {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Building/Location</label>
            <input
              required
              value={formData.location_name}
              onChange={e => setFormData({ ...formData, location_name: e.target.value })}
              placeholder="e.g., Block A, 3rd Floor"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea
              required
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Describe the issue in detail..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Photo Evidence (Optional)</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all relative overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Plus className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">Click to upload photo</p>
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
            {photoPreview && (
              <button
                type="button"
                onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                className="text-xs text-red-600 hover:underline mt-1"
              >
                Remove photo
              </button>
            )}
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className={cn(location ? "text-green-500" : "text-slate-400")} size={20} />
              <span className="text-sm text-slate-600">
                {location ? "Location Captured" : "Auto-detect Location"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleGetLocation}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              {location ? "Refresh" : "Enable"}
            </button>
          </div>
          <button
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {aiAnalyzing ? "AI Prioritizing..." : "Submitting..."}
              </>
            ) : (
              "Submit Report"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ========== MyIssues with clickable images and GPS location ==========
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">My Reported Issues</h2>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
          <AlertCircle className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500">You haven't reported any issues yet.</p>
          <Link to="/report" className="text-indigo-600 font-bold mt-2 inline-block">Report your first issue</Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {issues.map(issue => {
              const mapsLink = getGoogleMapsLink(issue.location_lat, issue.location_lng);
              return (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={issue.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between group hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      issue.status === 'Resolved' ? "bg-green-50 text-green-600" :
                        issue.status === 'In Progress' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                    )}>
                      {issue.status === 'Resolved' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{issue.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {mapsLink ? (
                          <a
                            href={mapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-500 flex items-center gap-1 hover:text-indigo-600 transition-colors"
                          >
                            <MapPin size={12} /> {issue.location_name} ({issue.department})
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin size={12} /> {issue.location_name} ({issue.department})
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                          issue.priority === 'High' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {issue.priority} Priority
                        </span>
                      </div>
                      {issue.location_lat && issue.location_lng && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          GPS: {issue.location_lat.toFixed(6)}, {issue.location_lng.toFixed(6)}
                        </p>
                      )}
                      {issue.photo_url && (
                        <img
                          src={issue.photo_url}
                          alt="Issue"
                          className="w-16 h-16 object-cover rounded-lg mt-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedImage(issue.photo_url!)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      issue.status === 'Resolved' ? "bg-green-100 text-green-700" :
                        issue.status === 'In Progress' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {issue.status}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-2">{safeFormatDate(issue.created_at, 'MMM d, h:mm a')}</p>
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
                  className="relative max-w-4xl max-h-[90vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img src={selectedImage} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Smart Campus Calendar</h2>
        <div className="bg-indigo-50 px-4 py-2 rounded-xl flex items-center gap-2 text-indigo-600 text-sm font-bold">
          <Calendar size={18} /> AI Powered
        </div>
      </div>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map((event, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex gap-6"
            >
              <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex flex-col items-center justify-center text-indigo-600">
                <span className="text-xs font-bold uppercase">{event.date.split(' ')[0]}</span>
                <span className="text-2xl font-black">{event.date.split(' ')[1] || i + 10}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-lg">{event.event}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => generateCalendarEvent({
                      title: event.event,
                      description: event.description || '',
                      date: event.date
                    })}
                    className="text-xs font-bold px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                  >
                    Add to Calendar
                  </button>
                  <Link to="/" className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all">View Notice</Link>
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Admin Overview</h2>
        <div className="text-sm text-slate-500">Last updated: {format(new Date(), 'h:mm a')}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Issues', value: stats.totalIssues, color: 'indigo', icon: AlertCircle },
          { label: 'Resolved Rate', value: stats.totalIssues ? `${Math.round((stats.resolvedIssues / stats.totalIssues) * 100)}%` : '0%', color: 'green', icon: CheckCircle2 },
          { label: 'Notice Views', value: stats.totalViews, color: 'blue', icon: Bell },
          { label: 'High Priority', value: stats.highPriority, color: 'red', icon: AlertCircle },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4",
              stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                stat.color === 'green' ? "bg-green-50 text-green-600" :
                  stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                    "bg-red-50 text-red-600"
            )}>
              <stat.icon size={20} />
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Issue Distribution by Category</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryDist}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Top Asked Questions (FAQ Bot)</h3>
            <div className="space-y-4">
              {stats.topQuestions?.map((q: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <span className="text-sm font-medium text-slate-700">{q.q}</span>
                  <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">{q.count} hits</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-fit sticky top-24">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Reports</h3>
          <div className="space-y-4">
            {recentIssues.map(issue => (
              <div key={issue.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  issue.priority === 'High' ? "bg-red-500" : "bg-indigo-500"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{issue.title}</p>
                  <p className="text-xs text-slate-500">{issue.location_name}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            ))}
            <Link to="/admin/issues" className="block text-center text-indigo-600 text-sm font-bold mt-4 hover:underline">View All Issues</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== IssueManagement with GPS location and clickable images ==========
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Manage Issues</h2>
        <div className="flex gap-2">
          {['All', 'Pending', 'In Progress', 'Resolved'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                filter === s ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Issue</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Coordinates</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Photo</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredIssues.map(issue => {
              const mapsLink = getGoogleMapsLink(issue.location_lat, issue.location_lng);
              return (
                <tr key={issue.id} className="hover:bg-slate-50/50 transition-all">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{issue.title}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{issue.description}</p>
                    <p className="text-[10px] text-indigo-600 font-medium mt-1">{issue.department}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {mapsLink ? (
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-indigo-600 underline underline-offset-2 flex items-center gap-1"
                      >
                        <MapPin size={14} /> {issue.location_name}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} /> {issue.location_name}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {issue.location_lat && issue.location_lng ? (
                      <span>
                        {issue.location_lat.toFixed(6)}, {issue.location_lng.toFixed(6)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase",
                      issue.priority === 'High' ? "bg-red-100 text-red-600" :
                        issue.priority === 'Medium' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {issue.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {issue.photo_url ? (
                      <img
                        src={issue.photo_url}
                        alt="Issue"
                        className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedImage(issue.photo_url!)}
                      />
                    ) : (
                      <span className="text-slate-400 text-xs">No photo</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      issue.status === 'Resolved' ? "bg-green-100 text-green-700" :
                        issue.status === 'In Progress' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {issue.status !== 'In Progress' && issue.status !== 'Resolved' && (
                        <button
                          onClick={() => updateStatus(issue.id, 'In Progress')}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Mark In Progress"
                        >
                          <Clock size={18} />
                        </button>
                      )}
                      {issue.status !== 'Resolved' && (
                        <button
                          onClick={() => updateStatus(issue.id, 'Resolved')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Mark Resolved"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
              className="relative max-w-4xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={selectedImage} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
              >
                <X size={24} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    const res = await fetch('/api/notices');
    const data = await res.json();
    setNotices(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingNotice 
      ? `/api/notices/${editingNotice.id}`
      : '/api/notices';
    const method = editingNotice ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      fetchNotices();
      setShowForm(false);
      setEditingNotice(null);
      setFormData({ title: '', content: '', category: CATEGORIES[0], department: 'Engineering', branch: 'All', year: 'All' });
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
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setNotices(notices.filter(n => n.id !== id));
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Manage Notices</h2>
        <button
          onClick={() => {
            setEditingNotice(null);
            setFormData({ title: '', content: '', category: CATEGORIES[0], department: 'Engineering', branch: 'All', year: 'All' });
            setShowForm(true);
          }}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
        >
          <Plus size={20} /> Post Notice
        </button>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <div className="bg-white w-full max-w-xl rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingNotice ? 'Edit Notice' : 'Post New Notice'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingNotice(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  required
                  placeholder="Notice Title"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="All">All Departments</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={formData.branch}
                    onChange={e => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="All">All Branches</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select
                    value={formData.year}
                    onChange={e => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="All">All Years</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <textarea
                  required
                  placeholder="Notice Content"
                  rows={6}
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <button className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all">
                  {editingNotice ? 'Update Notice' : 'Publish Notice'}
                </button>
              </form>
            </div>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-4">Confirm Delete</h3>
              <p className="text-slate-600 mb-6">Are you sure you want to delete this notice? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 bg-red-600 text-white font-bold py-2 rounded-xl hover:bg-red-700 transition-all"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-2 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notices List */}
      <div className="grid grid-cols-1 gap-4">
        {notices.map(notice => (
          <div key={notice.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900">{notice.title}</h4>
              <p className="text-xs text-slate-500 mt-1">
                {notice.category} • {format(new Date(notice.date_posted), 'MMM d, yyyy')} • {notice.views || 0} views
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(notice)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Edit Notice"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => setDeleteConfirm(notice.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Delete Notice"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== UPDATED Chatbot component with safe destructuring ==========
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

      // Get bot response with context – returns { text, newContext }
      const response = await getChatbotResponse(userMsg, faqs, notices, conversationContext);
      
      // Ensure we have a string for text
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
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-white w-80 h-[450px] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-4"
          >
            <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><MessageSquare size={16} /></div>
                <span className="font-bold">CampusBuddy</span>
              </div>
              <button onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>
            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] p-3 rounded-2xl text-sm",
                    m.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-200 rounded-tl-none shadow-sm"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 text-sm bg-slate-100 border-none rounded-xl px-4 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={handleSend} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all">
                <Send size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center hover:scale-110 transition-all active:scale-95"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>
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
          <div className="flex w-full">
            <Sidebar isAdmin={true} />
            <div className="flex-1 flex flex-col">
              <Navbar userEmail={user?.email || ''} onSearch={setSearchQuery} />
              <main className="p-8 max-w-7xl mx-auto w-full">
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="notices" element={<NoticeManagement />} />
                  <Route path="issues" element={<IssueManagement />} />
                  <Route path="analytics" element={<div className="p-20 text-center text-slate-400">Analytics Detail View Coming Soon</div>} />
                </Routes>
              </main>
            </div>
          </div>
        </ProtectedRoute>
      } />

      <Route path="/*" element={
        <ProtectedRoute allowedRoles={['student']}>
          <div className="flex w-full">
            <Sidebar isAdmin={false} />
            <div className="flex-1 flex flex-col">
              <Navbar userEmail={user?.email || ''} onSearch={setSearchQuery} />
              <main className="p-8 max-w-7xl mx-auto w-full">
                <Routes>
                  <Route index element={<NoticeFeed searchQuery={searchQuery} />} />
                  <Route path="report" element={<ReportIssue userEmail={user?.email || ''} />} />
                  <Route path="my-issues" element={<MyIssues userEmail={user?.email || ''} />} />
                  <Route path="calendar" element={<SmartCalendar />} />
                </Routes>
              </main>
              <Chatbot />
            </div>
          </div>
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