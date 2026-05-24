'use client';

import { useEffect, useState, useMemo } from 'react';
import { predictionsAPI } from '@/services/api';
import { Analytics } from '@/types';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function formatRub(value: number) {
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `₽${Math.round(value)}`;
  }
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const { data } = await predictionsAPI.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Analytics load error', err);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const priceStats = useMemo(() => analytics?.price_stats ?? { avg_price: 0, min_price: 0, max_price: 0, median_price: 0, count: 0 }, [analytics]);
  const byDistrict = useMemo(() => (Array.isArray(analytics?.by_district) ? analytics!.by_district.map(d => ({ district: d.district ?? 'Unknown', avg_price: Number(d.avg_price ?? 0), count: Number(d.count ?? 0) })) : []), [analytics]);

  // Use analytics.timeseries from backend (with optional moving averages). Fallback to empty.
  const isAnyLoading = loading;

  const timeseries = useMemo(() => {
    if (!analytics) return [];
    if (Array.isArray(analytics.timeseries_with_ma) && analytics.timeseries_with_ma.length > 0) {
      return analytics.timeseries_with_ma.map((t) => ({ date: t.date, avg: t.avg, count: t.count, ma7: t.ma7 ?? undefined, ma30: t.ma30 ?? undefined }));
    }
    if (Array.isArray(analytics.timeseries) && analytics.timeseries.length > 0) {
      return analytics.timeseries.map((t) => ({ date: t.date, avg: t.avg, count: t.count }));
    }
    return [];
  }, [analytics]);

  if (isAnyLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-2xl text-gray-600">No data available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">Analytics</h1>

        <p className="text-sm text-gray-500 mb-6">Overview of your predictions — average, min/max, distribution by district.</p>

        {/* Time Series */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-2">Average Price Over Time</h2>
          <p className="text-sm text-gray-500 mb-4">Daily average of predicted prices (last {timeseries.length} days)</p>
          {timeseries.length === 0 ? (
            <div className="text-gray-600">No historical data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeseries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatRub(Number(v))} />
                <Tooltip formatter={(value: number) => formatRub(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="avg" stroke="#10B981" strokeWidth={2} dot={false} name="Daily Avg" />
                {/* moving averages if present */}
                {timeseries[0] && Object.prototype.hasOwnProperty.call(timeseries[0], 'ma7') && (
                  <Line type="monotone" dataKey="ma7" stroke="#3B82F6" strokeWidth={2} dot={false} strokeDasharray="4 2" name="MA 7" />
                )}
                {timeseries[0] && Object.prototype.hasOwnProperty.call(timeseries[0], 'ma30') && (
                  <Line type="monotone" dataKey="ma30" stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="2 2" name="MA 30" />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <div className="text-gray-600 text-sm">Total Predictions</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">{analytics.total_predictions ?? 0}</div>
            <div className="text-xs text-gray-400 mt-2">As of now</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <div className="text-gray-600 text-sm">Average Price</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{formatRub(Number(priceStats.avg_price ?? 0))}</div>
            <div className="text-xs text-gray-400 mt-2">Median: {formatRub(Number(priceStats.median_price ?? 0))}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <div className="text-gray-600 text-sm">Std Dev</div>
            <div className="mt-2 text-3xl font-bold text-indigo-600">{formatRub(Number(priceStats.std_dev ?? 0))}</div>
            <div className="text-xs text-gray-400 mt-2">Price volatility (σ)</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <div className="text-gray-600 text-sm">Growth (period)</div>
            <div className="mt-2 text-3xl font-bold text-teal-600">{typeof analytics.growth_pct === 'number' ? `${analytics.growth_pct.toFixed(1)}%` : '—'}</div>
            <div className="text-xs text-gray-400 mt-2">Change over selected range</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <div className="text-gray-600 text-sm">Min Price</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">{formatRub(Number(priceStats.min_price ?? 0))}</div>
            <div className="text-xs text-gray-400 mt-2">Lowest predicted</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <div className="text-gray-600 text-sm">Max Price</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{formatRub(Number(priceStats.max_price ?? 0))}</div>
            <div className="text-xs text-gray-400 mt-2">Highest predicted</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* District Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">By District</h2>
            {byDistrict.length === 0 ? (
              <div className="text-gray-600">No district data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={byDistrict} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="district" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatRub(Number(v))} />
                  <Tooltip formatter={(value: number) => formatRub(Number(value))} />
                  <Bar dataKey="avg_price" fill="#3B82F6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Count by District */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Predictions by District</h2>
            {byDistrict.length === 0 ? (
              <div className="text-gray-600">No district data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={byDistrict} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="district" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => Number(value)} />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Histogram and Recent Predictions */}
        <div className="grid md:grid-cols-2 gap-8 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-2">Price Distribution (Histogram)</h3>
            {Array.isArray(analytics.price_histogram) && analytics.price_histogram.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.price_histogram} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => Number(value)} />
                  <Bar dataKey="count" fill="#6366F1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-600">No histogram data</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-2">Recent Predictions</h3>
            {Array.isArray(analytics.recent_predictions) && analytics.recent_predictions.length > 0 ? (
              <ul className="text-sm text-gray-700 space-y-2">
                {analytics.recent_predictions.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <div>{new Date(r.date).toLocaleString()}</div>
                    <div className="font-bold">{formatRub(Number(r.predicted_price))}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-600">No recent predictions</div>
            )}
          </div>
        </div>

        {/* Percentiles and Top Districts */}
        <div className="grid md:grid-cols-2 gap-8 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-2">Percentiles</h3>
            <div className="grid grid-cols-3 gap-2 text-sm text-gray-700">
              <div>p10: {formatRub(Number(analytics.percentiles?.p10 ?? 0))}</div>
              <div>p25: {formatRub(Number(analytics.percentiles?.p25 ?? 0))}</div>
              <div>p50 (median): {formatRub(Number(analytics.percentiles?.p50 ?? 0))}</div>
              <div>p75: {formatRub(Number(analytics.percentiles?.p75 ?? 0))}</div>
              <div>p90: {formatRub(Number(analytics.percentiles?.p90 ?? 0))}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-2">Top Districts</h3>
            {Array.isArray(analytics.top_districts) && analytics.top_districts.length > 0 ? (
              <ul className="text-sm text-gray-700 space-y-2">
                {analytics.top_districts.map((d, idx) => (
                  <li key={d.district} className="flex justify-between">
                    <span>{idx + 1}. {d.district}</span>
                    <span className="font-bold">{formatRub(Number(d.avg_price))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-600">No district data</div>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-sm text-gray-500">Data is computed from your saved predictions. If you recently made a prediction, allow a few seconds for metrics to update. Last update: {analytics.last_update ?? '—'}</div>
      </div>
    </div>
  );
}
