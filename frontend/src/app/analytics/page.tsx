'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [agg, setAgg] = useState<'mean' | 'median'>('mean');
  const [perM2, setPerM2] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<Array<{date:string, value:number, z:number}>>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedDistrict) params.district = selectedDistrict;
      params.agg = agg;
      const { data } = await predictionsAPI.getAnalytics(params);
      setAnalytics(data);
      computeAnomalies(data);
    } catch (err) {
      console.error('Analytics load error', err);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const computeAnomalies = useCallback((data: Analytics | null) => {
    if (!data) return setAnomalies([]);
    const ts = (Array.isArray(data.timeseries_with_ma) && data.timeseries_with_ma.length>0) ? data.timeseries_with_ma : data.timeseries ?? [];
    const vals = ts.map((t:any)=>t.avg ?? 0);
    if (vals.length < 3) return setAnomalies([]);
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
    const sd = Math.sqrt(vals.reduce((a,b)=>a+(b-mean)*(b-mean),0)/vals.length);
    const found = ts.map((t:any)=>({date:t.date, value:t.avg, z: sd>0 ? (t.avg-mean)/sd : 0})).filter(x=>Math.abs(x.z) > 2);
    setAnomalies(found);
  }, []);

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

  // filtered views
  const filteredByDistrict = useMemo(() => {
    if (!analytics) return [];
    return analytics.by_district.map(d => ({...d, avg_price: Number(d.avg_price)})).filter(d=>d.count > 0);
  }, [analytics]);

  // Custom tooltip shows value and count if present
  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    return (
      <div className="recharts-default-tooltip p-3 text-sm">
        <div className="font-medium text-white">{label}</div>
        <div className="text-slate-300">{item.name}: {typeof item.value === 'number' ? formatRub(Number(item.value)) : item.value}</div>
        {item.payload && item.payload.count !== undefined && (
          <div className="text-slate-400 text-xs">Count: {item.payload.count}</div>
        )}
      </div>
    );
  }

  // Export current analytics subset to CSV (timeseries + by_district)
  function exportCSV() {
    const rows: string[] = [];
    function q(v:any){ if (v===null||v===undefined) return ''; const s = String(v); return s.includes(',')||s.includes('"') ? '"'+s.replaceAll('"','""')+'"' : s; }
    rows.push(`Analytics export,${new Date().toISOString()}`);
    rows.push('');

    // timeseries
    const ts = (analytics?.timeseries_with_ma && analytics.timeseries_with_ma.length>0) ? analytics.timeseries_with_ma : analytics?.timeseries ?? [];
    rows.push('Timeseries');
    rows.push('date,avg,count');
    if (ts.length) {
      ts.forEach((t:any) => rows.push(`${q(t.date)},${q(t.avg)},${q(t.count)}`));
    } else {
      rows.push('No timeseries data');
    }
    rows.push('');

    // by_district
    rows.push('By District (average price)');
    rows.push('district,avg_price,count');
    if (analytics?.by_district && analytics.by_district.length) {
      analytics.by_district.forEach((d:any) => rows.push(`${q(d.district)},${q(d.avg_price)},${q(d.count)}`));
    } else {
      rows.push('No district data');
    }
    rows.push('');

    // price histogram
    rows.push('Price Histogram');
    rows.push('label,count');
    if (analytics?.price_histogram && analytics.price_histogram.length) {
      analytics.price_histogram.forEach((b:any)=> rows.push(`${q(b.label)},${q(b.count)}`));
    } else rows.push('No histogram data');
    rows.push('');

    // recent predictions
    rows.push('Recent Predictions');
    rows.push('id,date,predicted_price');
    if (analytics?.recent_predictions && analytics.recent_predictions.length) {
      analytics.recent_predictions.forEach((r:any)=> rows.push(`${q(r.id)},${q(r.date)},${q(r.predicted_price)}`));
    } else rows.push('No recent predictions');
    rows.push('');

    // percentiles
    rows.push('Percentiles');
    rows.push('p10,p25,p50,p75,p90');
    rows.push(`${q(analytics?.percentiles?.p10)},${q(analytics?.percentiles?.p25)},${q(analytics?.percentiles?.p50)},${q(analytics?.percentiles?.p75)},${q(analytics?.percentiles?.p90)}`);
    rows.push('');

    // top districts
    rows.push('Top Districts by avg price');
    rows.push('district,avg_price,count');
    if (analytics?.top_districts && analytics.top_districts.length) {
      analytics.top_districts.filter((d:any)=>d.district && d.district!=='Unknown').forEach((d:any)=> rows.push(`${q(d.district)},${q(d.avg_price)},${q(d.count)}`));
    } else rows.push('No top districts');

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isAnyLoading) {
    return (
      <div className="min-h-screen bg-[#02030d] flex items-center justify-center text-white">
        <div className="text-2xl">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-[#02030d] flex items-center justify-center text-white">
        <div className="text-2xl">No data available</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02030d] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-60px] h-72 w-72 -translate-x-1/2 rounded-full bg-[#3b82f6]/12 blur-3xl" />
        <div className="absolute right-[-100px] top-36 h-96 w-96 rounded-full bg-[#8b5cf6]/12 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 pt-24">
        <h1 className="text-4xl font-bold text-white mb-6">Analytics</h1>

        <p className="text-sm text-slate-300 mb-6">Overview of your predictions — average, min/max, distribution by district.</p>

        {/* Time Series */}
        <div className="flex items-center gap-4 mb-4">
          <div className="glass-card p-3 flex items-center gap-3">
            <label className="text-sm text-slate-300">From</label>
            <input type="date" value={startDate ?? ''} onChange={(e)=>setStartDate(e.target.value||null)} className="bg-white/5 rounded px-2 py-1 text-sm text-white" />
            <label className="text-sm text-slate-300">To</label>
            <input type="date" value={endDate ?? ''} onChange={(e)=>setEndDate(e.target.value||null)} className="bg-white/5 rounded px-2 py-1 text-sm text-white" />
            <button onClick={()=>{ setLoading(true); loadAnalytics(); }} className="ml-2 inline-flex items-center rounded-full bg-gradient-to-r from-[#3b82f6] via-[#6366f1] to-[#a78bfa] px-3 py-1 text-sm font-semibold text-white">Apply</button>
          </div>

          <div className="glass-card p-3 flex items-center gap-3">
            <label className="text-sm text-slate-300">Aggregation</label>
            <select value={agg} onChange={(e)=>setAgg(e.target.value as any)} className="bg-white/5 rounded px-2 py-1 text-sm text-white">
              <option value="mean">Mean</option>
              <option value="median">Median</option>
            </select>
            <label className="text-sm text-slate-300">Per m²</label>
            <input type="checkbox" checked={perM2} onChange={(e)=>setPerM2(e.target.checked)} />
            <button onClick={()=>exportCSV()} className="ml-2 inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-sm text-white">Export CSV</button>
          </div>
        </div>

        <div className="glass-card p-6 mb-8">
          <h2 className="text-xl font-bold mb-2 text-white">Average Price Over Time</h2>
          <p className="text-sm text-slate-300 mb-4">Daily average of predicted prices (last {timeseries.length} days)</p>
          {timeseries.length === 0 ? (
            <div className="text-gray-600">No historical data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeseries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatRub(Number(v))} />
                <Tooltip content={<CustomTooltip />} />
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
          <div className="glass-card p-6 flex flex-col">
            <div className="text-slate-300 text-sm">Total Predictions</div>
            <div className="mt-2 text-3xl font-bold text-[#93c5fd]">{analytics.total_predictions ?? 0}</div>
            <div className="text-xs text-slate-400 mt-2">As of now</div>
          </div>

          <div className="glass-card p-6 flex flex-col">
            <div className="text-slate-300 text-sm">Average Price</div>
            <div className="mt-2 text-3xl font-bold text-green-400">{formatRub(Number(priceStats.avg_price ?? 0))}</div>
            <div className="text-xs text-slate-400 mt-2">Median: {formatRub(Number(priceStats.median_price ?? 0))}</div>
          </div>

          <div className="glass-card p-6 flex flex-col">
            <div className="text-slate-300 text-sm">Std Dev</div>
            <div className="mt-2 text-3xl font-bold text-indigo-400">{formatRub(Number(priceStats.std_dev ?? 0))}</div>
            <div className="text-xs text-slate-400 mt-2">Price volatility (σ)</div>
          </div>

          <div className="glass-card p-6 flex flex-col">
            <div className="text-slate-300 text-sm">Growth (period)</div>
            <div className="mt-2 text-3xl font-bold text-teal-400">{typeof analytics.growth_pct === 'number' ? `${analytics.growth_pct.toFixed(1)}%` : '—'}</div>
            <div className="text-xs text-slate-400 mt-2">Change over selected range</div>
          </div>

          <div className="glass-card p-6 flex flex-col">
            <div className="text-slate-300 text-sm">Min Price</div>
            <div className="mt-2 text-3xl font-bold text-yellow-400">{formatRub(Number(priceStats.min_price ?? 0))}</div>
            <div className="text-xs text-slate-400 mt-2">Lowest predicted</div>
          </div>

          <div className="glass-card p-6 flex flex-col">
            <div className="text-slate-300 text-sm">Max Price</div>
            <div className="mt-2 text-3xl font-bold text-red-400">{formatRub(Number(priceStats.max_price ?? 0))}</div>
            <div className="text-xs text-slate-400 mt-2">Highest predicted</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* District Distribution */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold mb-2 text-white">Average Price by District</h2>
            <p className="text-sm text-slate-300 mb-3">Average predicted price per district (click a bar to drill down).</p>
            {filteredByDistrict.length === 0 ? (
              <div className="text-slate-300">No district data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={filteredByDistrict} margin={{ top: 5, right: 20, bottom: 5, left: -10 }} onClick={(e)=>{ if(e && (e as any).activeLabel){ setSelectedDistrict((e as any).activeLabel); setLoading(true); loadAnalytics(); } }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="district" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatRub(Number(v))} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avg_price" fill="#3B82F6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {selectedDistrict && (
              <div className="mt-3 text-sm text-slate-300">Showing data for <strong className="text-white">{selectedDistrict}</strong>. Click again to clear.</div>
            )}
          </div>

          {/* Count by District */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold mb-4 text-white">Number of Predictions by District</h2>
            <p className="text-sm text-slate-300 mb-3">How many predictions were made per district (useful to gauge sample size).</p>
            {byDistrict.length === 0 ? (
              <div className="text-slate-300">No district data available</div>
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
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-2 text-white">Price Distribution (Histogram)</h3>
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
              <div className="text-slate-300">No histogram data</div>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-2 text-white">Recent Predictions</h3>
            {Array.isArray(analytics.recent_predictions) && analytics.recent_predictions.length > 0 ? (
              <ul className="text-sm text-slate-300 space-y-2">
                {analytics.recent_predictions.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <div>{new Date(r.date).toLocaleString()}</div>
                    <div className="font-bold">{formatRub(Number(r.predicted_price))}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-slate-300">No recent predictions</div>
            )}
          </div>
        </div>

        {/* Percentiles and Top Districts */}
        <div className="grid md:grid-cols-2 gap-8 mt-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-2 text-white">Percentiles (price distribution)</h3>
            <p className="text-sm text-slate-300 mb-3">Percentiles show the price below which the given percentage of predictions fall (e.g., p50 is the median).</p>
            <div className="grid grid-cols-3 gap-2 text-sm text-slate-300">
              <div>p10: {formatRub(Number(analytics.percentiles?.p10 ?? 0))}</div>
              <div>p25: {formatRub(Number(analytics.percentiles?.p25 ?? 0))}</div>
              <div>p50 (median): {formatRub(Number(analytics.percentiles?.p50 ?? 0))}</div>
              <div>p75: {formatRub(Number(analytics.percentiles?.p75 ?? 0))}</div>
              <div>p90: {formatRub(Number(analytics.percentiles?.p90 ?? 0))}</div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-2 text-white">Top Districts by Average Price</h3>
            <p className="text-sm text-slate-300 mb-3">Districts with the highest average predicted prices (only districts with sufficient samples shown).</p>
            {Array.isArray(analytics.top_districts) && analytics.top_districts.filter(d=>d.district && d.district !== 'Unknown').length > 0 ? (
              <ul className="text-sm text-slate-300 space-y-2">
                {analytics.top_districts.filter(d=>d.district && d.district !== 'Unknown').map((d, idx) => (
                  <li key={d.district} className="flex justify-between">
                    <span>{idx + 1}. {d.district} <span className="text-xs text-slate-400">({d.count ?? '—'} samples)</span></span>
                    <span className="font-bold">{formatRub(Number(d.avg_price))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-slate-300">No district breakdown available (data missing or anonymous).</div>
            )}
          </div>
        </div>

        {/* Footer note */}
        {/* Anomalies / Top movers */}
        {anomalies.length > 0 && (
          <div className="mt-6 glass-card p-4">
            <h4 className="text-white font-semibold">Detected anomalies</h4>
            <ul className="text-sm text-slate-300 mt-2">
              {anomalies.map(a => (
                <li key={a.date}>{a.date}: {formatRub(a.value)} (z={a.z.toFixed(2)})</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">Data is computed from your saved predictions. If you recently made a prediction, allow a few seconds for metrics to update. Last update: {analytics.last_update ?? '—'}</div>
      </div>
    </div>
  );
}
