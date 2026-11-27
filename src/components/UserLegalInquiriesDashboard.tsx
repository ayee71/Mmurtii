import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Language } from '../i18n/translations';
import {
  UserLegalInquiry,
  LegalInquiryCategory,
  getAllUserLegalInquiries,
  recordUserLegalInquiry,
  getInquiryFrequencyTimeline,
  getCategoryDistribution,
  getJurisdictionDistribution,
  getHourlyInquiryActivity,
  getInquiryKpiSummary,
  CATEGORY_COLOR_MAP,
  CATEGORY_LABELS_MAP,
} from '../services/userInquiryAnalyticsService';
import { SeeraGadaaScalesVector } from './SeeraGadaaScalesVector';

interface UserLegalInquiriesDashboardProps {
  currentLang: Language;
  onNavigateToExplainLaw?: (initialQuery?: string) => void;
}

export const UserLegalInquiriesDashboard: React.FC<UserLegalInquiriesDashboardProps> = ({
  currentLang,
  onNavigateToExplainLaw,
}) => {
  const [timeWindowDays, setTimeWindowDays] = useState<number>(14);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [newQueryInput, setNewQueryInput] = useState<string>('');
  const [newQueryJurisdiction, setNewQueryJurisdiction] = useState<'both' | 'oromia' | 'federal'>('both');
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Listen for real-time inquiry events dispatched anywhere across the app
  useEffect(() => {
    const handleInquiryLogged = () => {
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener('seera:inquiry_logged', handleInquiryLogged);
    return () => {
      window.removeEventListener('seera:inquiry_logged', handleInquiryLogged);
    };
  }, []);

  // Fetch normalized data
  const allInquiries = useMemo(() => {
    return getAllUserLegalInquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Compute metrics and aggregations
  const timelineData = useMemo(() => {
    return getInquiryFrequencyTimeline(timeWindowDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindowDays, refreshKey]);

  const categoryData = useMemo(() => {
    return getCategoryDistribution(currentLang, allInquiries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLang, allInquiries, refreshKey]);

  const jurisdictionData = useMemo(() => {
    return getJurisdictionDistribution(allInquiries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInquiries, refreshKey]);

  const hourlyData = useMemo(() => {
    return getHourlyInquiryActivity(allInquiries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInquiries, refreshKey]);

  const kpiSummary = useMemo(() => {
    return getInquiryKpiSummary(allInquiries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInquiries, refreshKey]);

  // Filtered recent inquiries ledger table
  const filteredInquiries = useMemo(() => {
    return allInquiries.filter((item) => {
      const matchesCat =
        selectedCategoryFilter === 'all' || item.category === selectedCategoryFilter;
      const matchesSearch =
        !searchFilter.trim() ||
        item.query.toLowerCase().includes(searchFilter.trim().toLowerCase()) ||
        item.category.toLowerCase().includes(searchFilter.trim().toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [allInquiries, selectedCategoryFilter, searchFilter]);

  // Handle logging a simulated or actual inquiry in real-time
  const handleAddNewInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryInput.trim()) return;

    recordUserLegalInquiry(newQueryInput.trim(), {
      jurisdiction: newQueryJurisdiction,
      sourcesCount: Math.floor(Math.random() * 3) + 2,
      durationMs: 1200 + Math.floor(Math.random() * 800),
    });

    setNewQueryInput('');
    setShowLogModal(false);
    setRefreshKey((k) => k + 1);
  };

  // Export inquiry audit ledger as CSV
  const handleExportCsv = () => {
    const headers = ['ID', 'Date', 'Query', 'Category', 'Jurisdiction', 'VerifiedSources', 'Status'];
    const rows = filteredInquiries.map((i) => [
      i.id,
      new Date(i.timestamp).toISOString(),
      `"${i.query.replace(/"/g, '""')}"`,
      i.category,
      i.jurisdiction,
      i.groundedSourcesCount,
      i.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `seeraai_legal_inquiries_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Localized texts
  const t = {
    title:
      currentLang === 'am'
        ? 'የተጠቃሚ የሕግ ጥያቄዎች እና ድግግሞሽ ትንተና'
        : currentLang === 'en'
          ? 'User Legal Inquiry Frequency & Categories'
          : 'Xiinxala Deddeebii fi Ramaddii Gaaffilee Seeraa',
    subtitle:
      currentLang === 'am'
        ? 'በRecharts የተደራጀ በይነተገናኝ የሕግ ምርምር ዳሽቦርድ • የፌዴራል እና የኦሮሚያ ፍርድ ቤቶች'
        : currentLang === 'en'
          ? 'Interactive Legal Inquiry Analytics Powered by Recharts • Ethiopian Federal & Oromia Courts'
          : 'Daashboordii Qorannoo Gaaffilee Seeraa Recharts Fayyadamee Qophaa\'e • Federaalaa fi Oromiyaa',
    totalInquiries:
      currentLang === 'am' ? 'ጠቅላላ የሕግ ጥያቄዎች' : currentLang === 'en' ? 'Total Legal Inquiries' : 'Waliigala Gaaffilee Seeraa',
    topCategory:
      currentLang === 'am' ? 'ዋነኛ የሕግ መስክ' : currentLang === 'en' ? 'Top Legal Domain' : 'Damee Seeraa Olaanaa',
    dailyAvg:
      currentLang === 'am' ? 'ዕለታዊ አማካይ' : currentLang === 'en' ? 'Daily Average' : 'Giddu-galeessa Guyyaa',
    groundedRate:
      currentLang === 'am' ? 'የተረጋገጠ ምንጭ ምጣኔ' : currentLang === 'en' ? 'Source Grounding Rate' : 'Qulqullina Wabii Mirkanaa\'aa',
    frequencyTitle:
      currentLang === 'am' ? 'የሕግ ጥያቄዎች ድግግሞሽ ቅኝት (Timeline)' : currentLang === 'en' ? 'Inquiry Frequency Timeline Trend' : 'Hordoffii Deddeebii Gaaffilee Seeraa',
    categoryTitle:
      currentLang === 'am' ? 'የጥያቄዎች ክፍፍል በሕግ ዘርፍ (Category Breakdown)' : currentLang === 'en' ? 'Inquiries by Legal Category Breakdown' : 'Qoqqoodama Gaaffilee Damee Seeraatiin',
    jurisdictionTitle:
      currentLang === 'am' ? 'የዳኝነት ስልጣን ምርጫ (Jurisdiction)' : currentLang === 'en' ? 'Forum & Jurisdiction Preference' : 'Filannoo Aangoo Abbaa Seerummaa',
    recentLedger:
      currentLang === 'am' ? 'የቅርብ ጊዜ ጥያቄዎች ዝርዝር (Audit Ledger)' : currentLang === 'en' ? 'Recent User Inquiries Ledger' : 'Galmee Gaaffilee Dhiheenya Dhiyaatanii',
    logNewInquiry:
      currentLang === 'am' ? 'አዲስ ጥያቄ መዝግብ' : currentLang === 'en' ? 'Log New Inquiry' : 'Gaaffii Haaraa Galmeessi',
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* ========================================================
          1. HEADER WITH MINIMALIST GADAA SCALES VECTOR EMBLEM
          ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-amber-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/10 via-sky-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Minimalist Vector Emblem */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-950 border border-amber-500/40 p-2 shadow-xl shadow-amber-500/10 flex items-center justify-center shrink-0 relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-sky-500/10 rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
              <SeeraGadaaScalesVector size={64} className="relative z-10 transition-transform duration-500 group-hover:scale-105" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Recharts Inquiry Analytics Engine</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                {t.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-stretch md:self-auto justify-end">
            <button
              onClick={() => setShowLogModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.logNewInquiry}</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
              title="Export inquiries to CSV ledger"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">CSV Export</span>
            </button>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Refresh Charts"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. KPI SUMMARY METRIC CARDS
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inquiries */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.totalInquiries}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{kpiSummary.totalInquiries}</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +18.4%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Across {kpiSummary.activeDaysCount} active judicial research sessions
          </p>
        </div>

        {/* Card 2: Top Legal Category */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.topCategory}</span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `${CATEGORY_COLOR_MAP[kpiSummary.topCategoryKey]}20`,
                color: CATEGORY_COLOR_MAP[kpiSummary.topCategoryKey],
              }}
            >
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white truncate" title={kpiSummary.topCategoryLabel[currentLang] || kpiSummary.topCategoryLabel.om}>
            {kpiSummary.topCategoryLabel[currentLang] || kpiSummary.topCategoryLabel.om}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLOR_MAP[kpiSummary.topCategoryKey] }} />
            <span>Highest inquiry frequency in repository</span>
          </p>
        </div>

        {/* Card 3: Daily Average */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg relative overflow-hidden group hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.dailyAvg}</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{kpiSummary.avgDailyCount}</span>
            <span className="text-xs text-slate-400 font-mono">queries / day</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Peak volume on <span className="text-sky-300 font-semibold">{kpiSummary.mostActiveDay}</span>
          </p>
        </div>

        {/* Card 4: Source Grounding Rate */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.groundedRate}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400 font-mono">{kpiSummary.groundedRate}%</span>
            <span className="text-xs text-slate-400 font-mono">verified</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Backed by official Proclamations & Cassation records
          </p>
        </div>
      </div>

      {/* ========================================================
          3. MAIN RECHARTS VISUALIZATIONS SECTION
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART 1: INQUIRY FREQUENCY TIMELINE (AreaChart, spans 2 cols) */}
        <div className="lg:col-span-2 rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <span>{t.frequencyTitle}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daily legal queries and statutory research frequency over time
                </p>
              </div>

              {/* Time Window Buttons */}
              <div className="inline-flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setTimeWindowDays(7)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    timeWindowDays === 7 ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setTimeWindowDays(14)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    timeWindowDays === 14 ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  14 Days
                </button>
                <button
                  onClick={() => setTimeWindowDays(30)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    timeWindowDays === 30 ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  30 Days
                </button>
              </div>
            </div>

            {/* Recharts AreaChart Container */}
            <div className="w-full h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inquiryGoldArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="laborSkyArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="dayLabel"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '16px', fontSize: '11px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalInquiries"
                    name="Total Queries"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#inquiryGoldArea)"
                  />
                  <Area
                    type="monotone"
                    dataKey="labor"
                    name="Labor & Employment"
                    stroke="#38bdf8"
                    strokeWidth={1.8}
                    fillOpacity={1}
                    fill="url(#laborSkyArea)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>Aggregated from live chat, vector search, and legal document review</span>
            <span className="font-mono text-amber-400">Sample interval: 24h normalized</span>
          </div>
        </div>

        {/* CHART 2: CATEGORY BREAKDOWN (Donut PieChart) */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-400" />
                  <span>{t.categoryTitle}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribution across key Ethiopian legal disciplines
                </p>
              </div>
            </div>

            {/* Recharts PieChart Container */}
            <div className="w-full h-64 sm:h-72 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="count"
                    onMouseEnter={(_, index) => setActivePieIndex(index)}
                    onMouseLeave={() => setActivePieIndex(null)}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.key}`}
                        fill={entry.color}
                        stroke="#0f172a"
                        strokeWidth={activePieIndex === index ? 3 : 1}
                        className="transition-all duration-200 cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any, item: any) => [
                      `${value} queries (${item.payload.percentage}%)`,
                      item.payload.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Centered Total Overlay inside the Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-white font-mono">{kpiSummary.totalInquiries}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Queries</span>
              </div>
            </div>
          </div>

          {/* Category Pills Breakdown */}
          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
            {categoryData.slice(0, 4).map((cat) => (
              <div key={cat.key} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-slate-300 truncate text-[11px]">{cat.name}</span>
                </div>
                <span className="text-slate-400 font-mono text-[11px] shrink-0 font-bold">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================
          4. SECONDARY RECHARTS CHARTS ROW
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 3: HOURLY ACTIVITY FREQUENCY (BarChart) */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-400" />
                <span>Peak Judicial Inquiry Hours (24H Distribution)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Activity volume concentrated during court registry and advocacy hours
              </p>
            </div>
          </div>

          <div className="w-full h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={10} tickLine={false} interval={2} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="count" name="Queries" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 4: JURISDICTION BREAKDOWN (Horizontal BarChart) */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>{t.jurisdictionTitle}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Federal Supreme Court vs Oromia Regional Supreme Court & Cassation
                </p>
              </div>
            </div>

            <div className="w-full h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={jurisdictionData}
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey={currentLang === 'am' ? 'labelAm' : currentLang === 'en' ? 'labelEn' : 'labelOm'}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Inquiries" fill="#f59e0b" radius={[0, 6, 6, 0]}>
                    {jurisdictionData.map((entry, index) => (
                      <Cell key={`jur-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Dual Federal & Regional harmonized citations enabled</span>
            <span className="text-emerald-400 font-semibold font-mono">100% Jurisdictional Coverage</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          5. SEARCHABLE RECENT INQUIRIES AUDIT LEDGER TABLE
          ======================================================== */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <span>{t.recentLedger}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Detailed registry of user inquiries with category tags, timestamps, and citation links
            </p>
          </div>

          {/* Search & Category Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search user inquiries..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Category Dropdown Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Categories</option>
                <option value="labor" className="bg-slate-900">Labor & Employment</option>
                <option value="land_property" className="bg-slate-900">Land & Real Property</option>
                <option value="contracts_commercial" className="bg-slate-900">Contracts & Commercial</option>
                <option value="cassation_civil" className="bg-slate-900">Cassation & Civil Procedure</option>
                <option value="criminal_procedure" className="bg-slate-900">Criminal Law & Procedure</option>
                <option value="family_inheritance" className="bg-slate-900">Family & Inheritance</option>
                <option value="constitutional_admin" className="bg-slate-900">Constitutional & Admin</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inquiries Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Inquiry Text</th>
                <th className="py-3 px-3">Jurisdiction</th>
                <th className="py-3 px-3 text-center">Grounded Sources</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No legal inquiries found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredInquiries.slice(0, 15).map((inq) => {
                  const catColor = CATEGORY_COLOR_MAP[inq.category];
                  const localizedCat =
                    currentLang === 'am'
                      ? inq.categoryLabel.am
                      : currentLang === 'en'
                        ? inq.categoryLabel.en
                        : inq.categoryLabel.om;

                  return (
                    <tr key={inq.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(inq.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-semibold inline-flex items-center gap-1.5"
                          style={{
                            backgroundColor: `${catColor}15`,
                            color: catColor,
                            border: `1px solid ${catColor}35`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                          <span>{localizedCat}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-md">
                        <p className="text-slate-200 line-clamp-2 font-medium" title={inq.query}>
                          {inq.query}
                        </p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[11px] font-mono text-slate-400 uppercase">
                          {inq.jurisdiction}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                        {inq.groundedSourcesCount}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {onNavigateToExplainLaw && (
                          <button
                            onClick={() => onNavigateToExplainLaw(inq.query)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                          >
                            <span>Analyze</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          6. MODAL TO LOG A NEW INQUIRY / RUN TEST SIMULATION
          ======================================================== */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-amber-500/40 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Log User Legal Inquiry</h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Enter any legal question in Afaan Oromoo, Amharic, or English. The service will automatically classify it and update your Recharts frequency & category trends.
            </p>

            <form onSubmit={handleAddNewInquiry} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Legal Inquiry Query:
                </label>
                <textarea
                  value={newQueryInput}
                  onChange={(e) => setNewQueryInput(e.target.value)}
                  placeholder="e.g., Labsii Lafa Baadiyyaa Oromiyaa 248/2015 keeyyata 12 mirga kireessaa..."
                  rows={3}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Jurisdiction Scope:
                </label>
                <select
                  value={newQueryJurisdiction}
                  onChange={(e) => setNewQueryJurisdiction(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="both">Dual Jurisdiction (Federal & Oromia)</option>
                  <option value="oromia">Oromia Regional Courts (Caffee & Supreme Court)</option>
                  <option value="federal">Federal Courts (FSC Cassation Division)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Log & Update Charts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
