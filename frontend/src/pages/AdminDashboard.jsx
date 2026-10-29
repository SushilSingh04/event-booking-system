import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import AdminNav from '../components/AdminNav';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  DollarSign,
  Ticket,
  Calendar,
  Users,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const CATEGORY_COLORS = [
  '#4f46e5', // Indigo
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f43f5e', // Rose
];

// Custom Tooltip for Revenue Bar Chart
const RevenueTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs">
        <p className="font-bold text-sm mb-1">{data.event_title}</p>
        <p className="text-slate-300">Category: <span className="font-semibold text-white">{data.category}</span></p>
        <p className="text-emerald-400 font-bold mt-1 text-sm">
          Revenue: ${Number(data.revenue).toFixed(2)}
        </p>
        <p className="text-slate-400 mt-0.5">
          {data.tickets_sold} tickets sold across {data.bookings_count} bookings
        </p>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Bookings Daily Line Chart
const DailyBookingsTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs">
        <p className="font-bold text-sm mb-1">Date: {data.date}</p>
        <p className="text-indigo-400 font-bold text-sm">
          Bookings: {data.bookings}
        </p>
        <p className="text-slate-300">Tickets Reserved: {data.tickets_sold}</p>
        <p className="text-emerald-400 mt-0.5">Daily Volume: ${Number(data.revenue).toFixed(2)}</p>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Category Donut Chart
const CategoryTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs">
        <p className="font-bold text-sm mb-1">{data.category}</p>
        <p className="text-emerald-400 font-bold text-sm">
          Revenue: ${Number(data.revenue).toFixed(2)}
        </p>
        <p className="text-indigo-300 font-semibold mt-0.5">
          Tickets Reserved: {data.tickets_sold}
        </p>
        <p className="text-slate-400 mt-0.5">
          {data.bookings_count} confirmed orders
        </p>
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryMetric, setCategoryMetric] = useState('revenue');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await client.get('/admin/stats');
      setStats(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const overview = stats?.overview || {
    total_users: 0,
    total_events: 0,
    total_bookings: 0,
    total_revenue: 0,
  };

  const revenueData = (stats?.revenue_per_event || []).map((item) => ({
    ...item,
    short_title:
      item.event_title.length > 18
        ? `${item.event_title.substring(0, 18)}...`
        : item.event_title,
  }));

  const dailyData = stats?.bookings_per_day || [];
  const topCategories = stats?.top_categories || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Admin Nav Subheader */}
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Header with Refresh button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 mb-6 border-b border-slate-200/80 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Business Intelligence & Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Aggregated real-time metrics, revenue performance, and reservation trends
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchStats}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Analytics
            </button>
            <Link
              to="/admin/events"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all"
            >
              Manage Events
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Loading & Error States */}
        {loading ? (
          <div className="py-24">
            <LoadingSpinner message="Calculating real-time analytics..." size="lg" />
          </div>
        ) : error ? (
          <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 text-center max-w-lg mx-auto">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">Failed to Load Admin Analytics</h3>
            <p className="text-xs mb-4">{error}</p>
            <button
              type="button"
              onClick={fetchStats}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Stat Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Total Revenue */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total Revenue
                  </span>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  ${Number(overview.total_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Confirmed bookings
                </div>
              </div>

              {/* Card 2: Confirmed Bookings */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Confirmed Bookings
                  </span>
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Ticket className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {overview.total_bookings}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Active customer ticket orders
                </div>
              </div>

              {/* Card 3: Total Events */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Catalog Events
                  </span>
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {overview.total_events}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Published and upcoming events
                </div>
              </div>

              {/* Card 4: Total Users */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Registered Users
                  </span>
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {overview.total_users}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Registered member accounts
                </div>
              </div>
            </div>

            {/* 2. Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bar Chart: Revenue Per Event */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Revenue per Event
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Top grossing events sorted by total ticket sales
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                    Top {revenueData.length}
                  </span>
                </div>

                <div className="w-full min-w-0" style={{ width: '100%', height: 320, minHeight: 320 }}>
                  {revenueData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No revenue data recorded yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320} initialDimension={{ width: 500, height: 320 }}>
                      <BarChart
                        data={revenueData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="short_title"
                          angle={-20}
                          textAnchor="end"
                          interval={0}
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          height={45}
                        />
                        <YAxis
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          tickFormatter={(value) => `$${value}`}
                          width={60}
                        />
                        <Tooltip content={<RevenueTooltip />} />
                        <Bar
                          dataKey="revenue"
                          fill="#4f46e5"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={45}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Line Chart: Bookings Per Day (30 days) */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <LineChartIcon className="w-5 h-5 text-emerald-600" />
                      Bookings per Day (Last 30 Days)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Daily confirmed booking volume over time
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                    Daily Trend
                  </span>
                </div>

                <div className="w-full min-w-0" style={{ width: '100%', height: 320, minHeight: 320 }}>
                  {dailyData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No bookings logged in the last 30 days.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320} initialDimension={{ width: 500, height: 320 }}>
                      <LineChart
                        data={dailyData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="date"
                          angle={-20}
                          textAnchor="end"
                          interval="preserveStartEnd"
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          height={45}
                        />
                        <YAxis
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          allowDecimals={false}
                          width={35}
                        />
                        <Tooltip content={<DailyBookingsTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="bookings"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#10b981', strokeWidth: 1, stroke: '#fff' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Top Categories Breakdown */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-purple-600" />
                    Top Performing Categories
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Category demand breakdown by revenue and ticket reservations
                  </p>
                </div>

                {topCategories.length > 0 && (
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setCategoryMetric('revenue')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        categoryMetric === 'revenue'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      By Revenue ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryMetric('tickets_sold')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        categoryMetric === 'tickets_sold'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      By Tickets Sold
                    </button>
                  </div>
                )}
              </div>

              {topCategories.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-xs">
                  No category metrics available yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* Category Donut / Pie Chart */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center">
                    <div className="w-full min-w-0" style={{ width: '100%', height: 300, minHeight: 300 }}>
                      <ResponsiveContainer width="100%" height={300} initialDimension={{ width: 350, height: 300 }}>
                        <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                          <Pie
                            data={topCategories}
                            dataKey={categoryMetric}
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={88}
                            paddingAngle={3}
                          >
                            {topCategories.map((entry, index) => (
                              <Cell
                                key={`cat-cell-${entry.category || index}`}
                                fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CategoryTooltip />} />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value) => (
                              <span className="text-xs font-medium text-slate-700 mx-1">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Category Detail Metric Cards */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {topCategories.map((cat, index) => {
                      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                      return (
                        <div
                          key={cat.category}
                          className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between hover:bg-slate-100/60 transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block"
                                style={{ backgroundColor: `${color}15`, color: color }}
                              >
                                {cat.category}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">
                                #{index + 1}
                              </span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 tracking-tight">
                              ${Number(cat.revenue).toFixed(2)}
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{cat.tickets_sold} tickets sold</span>
                            <span>{cat.bookings_count} orders</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
