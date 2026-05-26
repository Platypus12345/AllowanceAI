import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import html2canvas from 'html2canvas';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { formatRupee } from '../utils/formatters';
import { ChartSkeleton } from './ui/Skeleton';

const CATEGORY_COLORS = {
  'Food': 'var(--color-secondary)',
  'Transport': 'var(--color-primary)',
  'Shopping': 'var(--color-primary-container)',
  'Entertainment': 'var(--color-tertiary)',
  'Health': 'var(--color-secondary-container)',
  'Other': 'var(--color-tertiary-container)',
};

const ReportCard = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await api.get('/budget/report');
        setReport(res.data);
      } catch (err) {
        console.error('Failed to load report', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  const downloadReport = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#020617',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `AllowanceAI_Report_${report.month}_${report.year}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to download report', err);
    }
  };

  if (loading || !report) {
    return <ChartSkeleton />;
  }

  const chartData = Object.entries(report.categoryBreakdown).map(([name, value]) => ({
    name,
    value
  })).filter(item => item.value > 0);

  const getGradeConfig = (grade) => {
    switch(grade) {
      case 'A': return { color: 'secondary', glow: 'glow-secondary', label: 'EXCELLENT' };
      case 'B': return { color: 'primary', glow: 'glow-primary', label: 'GOOD' };
      case 'C': return { color: 'tertiary', glow: 'glow-tertiary', label: 'AVERAGE' };
      case 'D': return { color: 'error', glow: 'glow-error', label: 'POOR' };
      case 'F': return { color: 'error', glow: 'glow-error', label: 'FAILED' };
      default: return { color: 'outline', glow: '', label: 'N/A' };
    }
  };

  const gradeConfig = getGradeConfig(report.grade);
  const isBetter = report.previousMonthComparison.difference <= 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center px-4 flex-wrap gap-3">
        <h3 className="text-display-sm font-plus font-black text-on-surface">Monthly Report</h3>
        <div className="flex gap-2">
        <button type="button" onClick={() => navigate('/wrapped')} className="glass-card px-4 py-2 rounded-xl text-sm font-bold text-primary-container">
          See Wrapped Version 🎁
        </button>
        <button 
          type="button"
          onClick={downloadReport}
          className="btn-primary-container flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-xl">download</span>
          <span>Download Image</span>
        </button>
        </div>
      </div>

      <div ref={reportRef} className="glass-card p-10 rounded-[3rem] border border-white/10 relative overflow-hidden bg-surface">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] -ml-64 -mb-64" />
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
            <div>
              <p className="text-display-md font-plus font-black text-on-surface leading-tight">
                {new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long' })}
              </p>
              <p className="text-headline-sm font-space font-bold text-outline tracking-widest">{report.year}</p>
            </div>
            
            <div className="flex flex-col items-center md:items-end">
              <div className={`w-32 h-32 rounded-[2.5rem] border-4 border-${gradeConfig.color} flex items-center justify-center relative ${gradeConfig.glow} bg-surface shadow-2xl`}>
                <span className={`text-6xl font-plus font-black text-${gradeConfig.color}`}>{report.grade}</span>
                <div className={`absolute -bottom-3 px-4 py-1 rounded-full bg-${gradeConfig.color} text-on-${gradeConfig.color} text-[10px] font-plus font-black tracking-widest`}>
                  {gradeConfig.label}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="glass-card p-8 rounded-[2rem] border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary">payments</span>
                <p className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest">Total Spent</p>
              </div>
              <p className="text-headline-md font-space font-bold text-on-surface mb-2">{formatRupee(report.totalSpent)}</p>
              <div className={`flex items-center text-xs font-plus font-bold ${isBetter ? 'text-secondary' : 'text-error'}`}>
                <span className="material-symbols-outlined text-sm mr-1">{isBetter ? 'trending_down' : 'trending_up'}</span>
                <span>{formatRupee(Math.abs(report.previousMonthComparison.difference))} vs last month</span>
              </div>
            </div>
            
            <div className="glass-card p-8 rounded-[2rem] border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-secondary">savings</span>
                <p className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest">Total Saved</p>
              </div>
              <p className="text-headline-md font-space font-bold text-secondary mb-2">{formatRupee(report.savingsAmount)}</p>
              <p className="text-xs font-plus font-bold text-on-surface-variant opacity-60">{report.savingsPercent.toFixed(1)}% of allowance</p>
            </div>

            <div className="glass-card p-8 rounded-[2rem] border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-tertiary">speed</span>
                <p className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest">Daily Average</p>
              </div>
              <p className="text-headline-md font-space font-bold text-tertiary mb-2">{formatRupee(Math.round(report.dailyAverageSpend))}</p>
              <p className="text-xs font-plus font-bold text-on-surface-variant opacity-60">{report.daysOverLimit} days over limit</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h4 className="text-headline-sm font-plus font-black text-on-surface">Category Spending</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Plus Jakarta Sans', fontWeight: 700 }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="glass-card p-3 border-white/10 shadow-2xl">
                              <p className="font-space font-bold text-on-surface">{formatRupee(payload[0].value)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || 'var(--color-outline)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-headline-sm font-plus font-black text-on-surface">Financial Highlights</h4>
              
              <div className="space-y-4">
                {report.bestCategory && (
                  <div className="flex items-center p-6 rounded-[1.5rem] bg-secondary/10 border border-secondary/20">
                    <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary mr-6 shadow-lg shadow-secondary/10">
                      <span className="material-symbols-outlined filled">award_star</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-plus font-black text-secondary uppercase tracking-widest mb-1">Lowest Spend</p>
                      <p className="text-lg font-plus font-extrabold text-on-surface">{report.bestCategory}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="font-space font-bold text-secondary">{formatRupee(report.categoryBreakdown[report.bestCategory])}</p>
                    </div>
                  </div>
                )}
                
                {report.worstCategory && (
                  <div className="flex items-center p-6 rounded-[1.5rem] bg-error/10 border border-error/20">
                    <div className="w-12 h-12 rounded-xl bg-error/20 flex items-center justify-center text-error mr-6 shadow-lg shadow-error/10">
                      <span className="material-symbols-outlined filled">trending_up</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-plus font-black text-error uppercase tracking-widest mb-1">Highest Spend</p>
                      <p className="text-lg font-plus font-extrabold text-on-surface">{report.worstCategory}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="font-space font-bold text-error">{formatRupee(report.categoryBreakdown[report.worstCategory])}</p>
                    </div>
                  </div>
                )}

                {report.biggestExpense && (
                  <div className="flex items-center p-6 rounded-[1.5rem] bg-white/[0.03] border border-white/10 group hover:border-primary/30 transition-all">
                    <div className="flex-1">
                      <p className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest mb-1">Biggest Transaction</p>
                      <p className="text-lg font-plus font-extrabold text-on-surface truncate pr-4">{report.biggestExpense.description || report.biggestExpense.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-space font-black text-on-surface text-lg">{formatRupee(report.biggestExpense.amount)}</p>
                      <p className="text-[10px] font-plus font-bold text-on-surface-variant uppercase">{new Date(report.biggestExpense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 opacity-40">
             <div className="flex items-center gap-2">
               <span className="material-symbols-outlined text-primary filled">verified</span>
               <p className="text-[10px] font-plus font-black tracking-widest uppercase">Verified by AllowanceAI</p>
             </div>
             <p className="text-[10px] font-plus font-bold uppercase tracking-widest">Digital Statement ID: AA-{report.year}-{report.month}-772</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCard;
