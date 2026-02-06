import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Loader2, LogOut, Settings, Save, 
  Receipt, CreditCard, Landmark, Wallet, Pencil, 
  Coins, TrendingUp, X, ChevronRight, TrendingDown, Minus, Banknote, LayoutDashboard
} from 'lucide-react';
import { 
  ComposedChart, Line, Bar, XAxis, Tooltip, ResponsiveContainer
} from 'recharts';

// ==========================================
// 1. 類型定義
// ==========================================
interface Asset {
  id: string; owner: string; type: string; name: string;
  currency: string; amount: number; balance?: number;
  lastUpdate?: string; note?: string;
}

interface Plan {
  id: string; owner: string; type: string; name: string;
  amount: number; currency: string; frequency: string; note?: string;
}

interface HistoryRecord {
  month: string;
  meta: Record<string, any>;
  [key: string]: any; 
}

interface AppData {
  assets: Asset[];
  plans: Plan[];
  history: HistoryRecord[];
}

// ==========================================
// 2. 設定與常數
// ==========================================
const STORAGE_KEY_API = 'sudhana_family_finance_api';
const STORAGE_KEY_TITLE = 'sudhana_family_title';
const CURRENT_VERSION = "修心之道家庭資產記帳本 V1.3";

const CURRENCY_LIST = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'AUD', 'CAD', 'CHF', 'GBP', 'HKD', 'KRW', 'SGD', 'VND'];

const DEFAULT_RATES: Record<string, number> = { 
  'TWD': 1, 'USD': 31.58, 'JPY': 0.20, 'EUR': 37.24, 'CNY': 4.55,
  'AUD': 22.11, 'CAD': 23.10, 'GBP': 43.18, 'HKD': 4.04, 'KRW': 0.02, 
  'SGD': 24.84, 'VND': 0.0013, 'MYR': 8.03, 'NZD': 19.05, 'THB': 1.0, 'ZAR': 1.98, 'SEK': 3.54
};

const ASSET_TYPES: Record<string, any> = {
  'cash':  { label: '存款', category: 'cash', icon: Wallet, color: 'text-emerald-600', bgColor: 'bg-emerald-50', barColor: '#10B981', palette: ['#10B981', '#34D399', '#6EE7B7', '#059669', '#064E3B', '#A7F3D0', '#D1FAE5'] },
  'stock': { label: '投資', category: 'stock', icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50', barColor: '#3B82F6', palette: ['#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#1E40AF', '#BFDBFE', '#DBEAFE'] },
  'debt':  { label: '債務', category: 'debt', icon: Banknote, color: 'text-red-600', bgColor: 'bg-red-50', barColor: '#EF4444', palette: ['#EF4444', '#F87171', '#FCA5A5', '#DC2626', '#991B1B', '#FECACA', '#FEE2E2'] },
};

const FREQUENCY_OPTS: Record<string, any> = {
  'monthly':   { label: '每月', divisor: 1 },
  'quarterly': { label: '每季', divisor: 3 },
  'yearly':    { label: '每年', divisor: 12 },
};

const normalizeOwner = (o: string) => {
  const s = String(o || '').toLowerCase();
  if (['husband', '老公', '爸爸', '老爸'].includes(s)) return 'husband';
  if (['wife', '老婆', '媽媽', '老媽'].includes(s)) return 'wife';
  return 'family';
};

const normalizeType = (typeStr: string) => {
  const s = String(typeStr || '').toLowerCase();
  if (s === 'stock' || s.includes('投資')) return 'stock';
  if (s === 'debt' || s.includes('負債')) return 'debt';
  if (s === 'expense' || s.includes('支出')) return 'expense';
  if (s === 'income' || s.includes('收入')) return 'income';
  return 'cash'; 
};

const getOwnerDisplayName = (key: string) => {
  if (key === 'husband') return '老公';
  if (key === 'wife') return '老婆';
  return '全家';
};

const formatMoney = (val: number) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(val || 0);

// ==========================================
// 3. 子組件
// ==========================================

const SettingsModal = ({ isOpen, onClose, currentCurrency, onCurrencyChange, onLogout }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><Settings size={18}/> 偏好設定</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-8">
          {CURRENCY_LIST.map(curr => (
            <button key={curr} onClick={() => onCurrencyChange(curr)} className={`text-[10px] font-bold py-2 rounded-lg ${currentCurrency === curr ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{curr}</button>
          ))}
        </div>
        <button onClick={onLogout} className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"><LogOut size={16}/> 登出系統</button>
      </div>
    </div>
  );
};

// 🌟 優化版 Tooltip：總計置頂 + 支援捲動
const CustomTooltip = ({ active, payload, label, selectedOwner }: any) => {
  if (active && payload && payload.length) {
    const totalItem = payload.find((p: any) => p.name === 'totalValue');
    const items = payload.filter((p: any) => p.name !== 'totalValue').sort((a: any, b: any) => b.value - a.value);
    
    const formatName = (name: string) => {
        const match = name.match(/(.*)\s\((.*)\)/);
        if (match && selectedOwner === 'all') {
            return `${getOwnerDisplayName(match[2].toLowerCase())} - ${match[1]}`;
        }
        return name.split('(')[0];
    };

    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-200 rounded-xl shadow-xl text-xs w-48">
        <p className="font-bold text-slate-500 mb-2 border-b pb-1 flex justify-between">
            <span>{label}月</span>
            {totalItem && <span className="text-slate-800 font-black">${formatMoney(totalItem.value)}</span>}
        </p>
        <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
          {items.map((entry: any, index: number) => {
             if (entry.value === 0) return null;
             return (
              <div key={index} className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.fill }}></div>
                    <span className="truncate text-slate-600">{formatName(entry.name)}</span>
                </div>
                <span className="font-mono font-medium text-slate-700">
                    ${formatMoney(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const TrendBlock = ({ title, typeKey, data, assetKeys, currentTotal, selectedOwner }: any) => {
  const config = ASSET_TYPES[typeKey];
  const Icon = config.icon;
  const len = data.length;
  const latest = len > 0 ? data[len - 1].totalValue : 0;
  const prev = len > 1 ? data[len - 2].totalValue : latest;
  const diff = latest - prev;
  const percent = prev !== 0 ? (diff / prev) * 100 : 0;
  
  const isUp = percent > 0;
  const TrendIcon = percent === 0 ? Minus : (isUp ? TrendingUp : TrendingDown);
  const trendColor = percent === 0 ? 'text-slate-400' : (isUp ? 'text-emerald-600' : 'text-orange-500'); 
  const getColor = (index: number) => config.palette[index % config.palette.length];

  const hasData = data.some((d: any) => d.totalValue > 0);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1"><div className={`p-1 rounded-md ${config.bgColor} ${config.color}`}><Icon size={14} /></div>{title}</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">${formatMoney(currentTotal)}</div>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-slate-50 ${trendColor}`}><TrendIcon size={14} />{Math.abs(percent).toFixed(1)}%</div>
      </div>
      <div className="h-40 w-full mt-auto">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{top: 5, right: 2, left: 2, bottom: 0}}>
              {/* ⚠️ 允許滑鼠進入 Tooltip 進行捲動 */}
              <Tooltip 
                 content={<CustomTooltip selectedOwner={selectedOwner} />} 
                 cursor={{fill: '#f8fafc'}}
                 wrapperStyle={{ pointerEvents: 'auto' }} 
              />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#cbd5e1'}} />
              {assetKeys.map((key: string, index: number) => (
                <Bar key={key} dataKey={key} stackId="a" fill={getColor(index)} barSize={16} radius={index === assetKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
              <Line type="monotone" dataKey="totalValue" stroke={config.barColor} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <div className="h-full flex items-center justify-center text-xs text-slate-300">尚無歷史數據</div>}
      </div>
    </div>
  );
};

const DashboardView = ({ accounts, plans, rates, selectedOwner, displayCurrency, onEditAsset, onEditPlan, historyData }: any) => {
  const { totalMonthlyIncome, totalMonthlyExpense } = useMemo(() => {
    let inc = 0, exp = 0;
    const displayRate = rates[displayCurrency] || 1;

    (plans || []).forEach((p: Plan) => {
      const curr = String(p.currency).toUpperCase();
      const itemRate = rates[curr] || 1;
      const amountConverted = (Number(p.amount || 0) * itemRate) / displayRate;
      const freqStr = String(p.frequency).toLowerCase();
      const freqKey = Object.keys(FREQUENCY_OPTS).find(k => freqStr.includes(k)) || 'monthly';
      const freq = FREQUENCY_OPTS[freqKey];
      
      const monthlyAmount = amountConverted / freq.divisor;
      const typeStr = String(p.type).toLowerCase();
      
      if (typeStr.includes('income')) {
        inc += monthlyAmount;
      } else if (typeStr.includes('expense')) {
        exp += monthlyAmount;
      }
    });

    return { totalMonthlyIncome: inc, totalMonthlyExpense: exp };
  }, [plans, rates, displayCurrency]);

  const monthlyBalance = totalMonthlyIncome - totalMonthlyExpense;

  const { trends, totals } = useMemo(() => {
    const initialTrend = { data: Array.from({length: 12}).map(() => ({ name: '', totalValue: 0 })), keys: new Set() };
    const result: any = {
      cash: { ...initialTrend, data: [...initialTrend.data.map((d: any)=>({...d}))], keys: new Set() },
      stock: { ...initialTrend, data: [...initialTrend.data.map((d: any)=>({...d}))], keys: new Set() },
      debt: { ...initialTrend, data: [...initialTrend.data.map((d: any)=>({...d}))], keys: new Set() },
    };
    
    const displayRate = rates[displayCurrency] || 1;

    const currentTotals: any = { cash: 0, stock: 0, debt: 0 };
    (accounts || []).forEach((acc: Asset) => {
      const curr = String(acc.currency).toUpperCase();
      const itemRate = rates[curr] || 1;
      const val = (Number(acc.amount || acc.balance || 0) * itemRate) / displayRate;
      const normalizedKey = normalizeType(acc.type);
      const config = ASSET_TYPES[normalizedKey] || ASSET_TYPES['cash'];
      if (config.category && currentTotals[config.category] !== undefined) {
        currentTotals[config.category] += val;
      }
    });

    if (!historyData || historyData.length === 0) {
      return { trends: result, totals: currentTotals };
    }

    const sliced = historyData.slice(-12);
    
    sliced.forEach((record: any, index: number) => {
      const monthLabel = record.month.split('-')[1];
      
      result.cash.data[index] = { name: monthLabel, totalValue: 0 };
      result.stock.data[index] = { name: monthLabel, totalValue: 0 };
      result.debt.data[index] = { name: monthLabel, totalValue: 0 };

      Object.keys(record).forEach(key => {
        if (['month', 'meta'].includes(key)) return;
        const meta = record.meta?.[key];
        if (!meta) return;
        if (selectedOwner !== 'all' && normalizeOwner(meta.owner) !== selectedOwner) return;
        
        if (!meta.displayName || meta.displayName.trim() === '') return;

        if (ASSET_TYPES[normalizeType(meta.type)]?.category) {
            const cat = ASSET_TYPES[normalizeType(meta.type)].category;
            const converted = (Number(record[key]) * (rates[meta.currency.toUpperCase()] || 1)) / displayRate;
            if (result[cat]) {
              result[cat].data[index].totalValue += converted;
              result[cat].data[index][meta.displayName] = converted;
              result[cat].keys.add(meta.displayName);
            }
        }
      });
    });

    return { trends: result, totals: currentTotals };

  }, [historyData, selectedOwner, accounts, rates, displayCurrency]);

  return (
    <div className="pb-24 space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['cash', 'stock', 'debt'].map(k => (
          <TrendBlock key={k} title={ASSET_TYPES[k].label} typeKey={k} data={trends[k].data} assetKeys={Array.from(trends[k].keys).sort()} currentTotal={totals[k]} selectedOwner={selectedOwner} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="text-xs text-slate-400 mb-1 font-bold">月均收入 (預估)</div>
                <div className="text-lg font-black text-emerald-600 tracking-tight">+${formatMoney(totalMonthlyIncome)}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="text-xs text-slate-400 mb-1 font-bold">月均支出 (預估)</div>
                <div className="text-lg font-black text-orange-600 tracking-tight">-${formatMoney(totalMonthlyExpense)}</div>
                </div>
            </div>
            <div className={`text-center text-xs font-bold py-2 rounded-xl ${monthlyBalance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                每月預估結餘：{monthlyBalance >= 0 ? '+' : ''}${formatMoney(monthlyBalance)}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <h3 className="text-sm font-bold text-slate-500 mb-3">固定收支明細</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {(plans || []).map((p: Plan) => {
                        const isExp = String(p.type).includes('expense');
                        const freq = FREQUENCY_OPTS[p.frequency.toLowerCase()]?.label || '每月';
                        return (
                            <div key={p.id} onClick={() => onEditPlan(p)} className="flex justify-between items-center text-xs p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-8 rounded-full ${isExp ? 'bg-orange-400' : 'bg-emerald-400'}`}></div>
                                    <div>
                                        <div className="font-bold text-slate-700">{selectedOwner === 'all' ? `${getOwnerDisplayName(p.owner)} - ${p.name}` : p.name}</div>
                                        <div className="text-[10px] text-slate-400">{freq}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${isExp ? 'text-orange-600' : 'text-emerald-600'}`}>{isExp ? '-' : '+'}${formatMoney(p.amount)}</div>
                                    <div className="text-[10px] text-slate-300">{p.currency}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>

        <div className="space-y-3">
            <div className="flex justify-between items-end px-1"><h3 className="font-bold text-slate-700 text-sm">資產明細 ({getOwnerDisplayName(selectedOwner)})</h3></div>
            <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {(accounts || []).map((acc: Asset) => {
                const cfg = ASSET_TYPES[normalizeType(acc.type)] || ASSET_TYPES['cash'];
                const isDebt = cfg.category === 'debt';
                const displayName = selectedOwner === 'all' ? `${getOwnerDisplayName(acc.owner)} - ${acc.name}` : acc.name;
                return (
                <div key={acc.id} onClick={() => onEditAsset(acc)} className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center cursor-pointer hover:border-slate-300 transition-all group ${isDebt ? 'border-l-4 border-l-red-400' : ''}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full ${cfg.bgColor} flex items-center justify-center ${cfg.color}`}><cfg.icon size={18} /></div>
                    <div><div className="font-bold text-slate-700 text-sm">{displayName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{acc.currency}</div></div></div>
                    <div className="font-bold text-slate-800">{isDebt ? '-' : ''}${formatMoney(acc.amount || acc.balance || 0)}</div>
                </div>
                );
            })}
            </div>
        </div>
      </div>
    </div>
  );
};

const EditModal = ({ isOpen, onClose, data, type, onSave }: any) => {
  const [formData, setFormData] = useState<any>({});
  
  useEffect(() => { 
    if (isOpen && data) {
        setFormData({
            ...data,
            type: data.type || (type === 'plan' ? 'expense' : 'cash'),
            currency: data.currency || 'TWD',
            owner: data.owner || 'husband',
            amount: data.amount || '',
            frequency: data.frequency || 'monthly'
        });
    } else if (isOpen) {
        setFormData({
            owner: 'husband',
            type: type === 'plan' ? 'expense' : 'cash',
            currency: 'TWD',
            amount: '',
            frequency: 'monthly'
        });
    }
  }, [isOpen, data, type]);

  if (!isOpen) return null;
  const isPlan = type === 'plan';
  const showFreq = normalizeType(formData.type) === 'expense' || normalizeType(formData.type) === 'income';
  const handleSave = () => { if(!formData.name || formData.amount === '') return; onSave({ ...formData, amount: Number(formData.amount) }); };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom-10">
        <div className="flex justify-between items-center border-b pb-4"><h3 className="text-lg font-black text-slate-800">{formData.id ? '編輯' : '新增'}{isPlan ? '收支' : '資產'}</h3><button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button></div>
        <div className="space-y-4">
          <div className="flex gap-3">
             <div className="flex-1 space-y-1"><label className="text-xs font-bold text-slate-400">歸屬人</label><select className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold text-slate-700" value={normalizeOwner(formData.owner)} onChange={e => setFormData({...formData, owner: e.target.value})}><option value="husband">老公</option><option value="wife">老婆</option><option value="family">全家</option></select></div>
             <div className="flex-1 space-y-1"><label className="text-xs font-bold text-slate-400">類型</label><select className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold text-slate-700" value={normalizeType(formData.type)} onChange={e => setFormData({...formData, type: e.target.value})}>{isPlan ? (<><option value="expense">固定支出</option><option value="income">固定收入</option></>) : Object.entries(ASSET_TYPES).map(([k, v]: [string, any]) => (<option key={k} value={k}>{v.label}</option>))}</select></div>
          </div>
          {showFreq && (<div className="space-y-1"><label className="text-xs font-bold text-slate-400">頻率 (自動換算月均)</label><div className="flex bg-slate-50 p-1 rounded-xl">{Object.entries(FREQUENCY_OPTS).map(([k, v]: [string, any]) => (<button key={k} onClick={() => setFormData({...formData, frequency: k})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${String(formData.frequency).toLowerCase().includes(k) ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>{v.label}</button>))}</div></div>)}
          <div className="space-y-1"><label className="text-xs font-bold text-slate-400">名稱</label><input type="text" className="w-full bg-slate-50 rounded-xl p-3 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
          <div className="flex gap-3">
             <div className="w-1/3 space-y-1"><label className="text-xs font-bold text-slate-400">幣別</label><select className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>{CURRENCY_LIST.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
             <div className="flex-1 space-y-1"><label className="text-xs font-bold text-slate-400">金額</label><input type="number" className="w-full bg-slate-50 rounded-xl p-3 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
          </div>
        </div>
        <button onClick={() => onSave({...formData, amount: Number(formData.amount)})} className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold shadow-lg flex justify-center items-center gap-2"><Save size={18}/> 儲存變更</button>
      </div>
    </div>
  );
};

export default function App() {
  const [apiUrl, setApiUrl] = useState('');
  const [appTitle, setAppTitle] = useState('家庭資產記帳本');
  const [isConfigured, setIsConfigured] = useState(false);
  const [data, setData] = useState<AppData>({ assets: [], plans: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [selectedOwner, setSelectedOwner] = useState('all'); 
  const [displayCurrency, setDisplayCurrency] = useState('TWD');
  const [showSettings, setShowSettings] = useState(false);
  const [editModal, setEditModal] = useState<{isOpen: boolean, type: string, data: any}>({ isOpen: false, type: 'asset', data: null });

  useEffect(() => {
    const u = localStorage.getItem(STORAGE_KEY_API), t = localStorage.getItem(STORAGE_KEY_TITLE), c = localStorage.getItem('sudhana_currency');
    if (t) setAppTitle(t); if (c) setDisplayCurrency(c);
    if (u) { setApiUrl(u); setIsConfigured(true); refreshData(u); } else setLoading(false);
  }, []);

  const refreshData = async (url: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${url}?t=${Date.now()}`);
      const json = await res.json();
      if (json.status === 'success') setData(json); else throw new Error();
    } catch (e) { setData({ assets: [], plans: [], history: [] }); } 
    finally { setLoading(false); }
  };

  const handleSaveItem = async (formData: any) => {
    const listKey = (editModal.type === 'plan' ? 'plans' : 'assets') as keyof AppData;
    const newList = formData.amount === 0 ? data[listKey].filter((i: any) => i.id !== formData.id) : (data[listKey].findIndex((i: any) => i.id === formData.id) >= 0 ? data[listKey].map((i: any) => i.id === formData.id ? formData : i) : [...data[listKey], {...formData, id: 'tmp_'+Date.now()}]);
    
    const newHistory = [...data.history];
    if (newHistory.length > 0) {
        const lastIdx = newHistory.length - 1;
        const lastRecord = { ...newHistory[lastIdx], meta: { ...newHistory[lastIdx].meta } }; 
        const ownerUpper = String(formData.owner).toUpperCase();
        const uniqueKey = `${formData.name} (${ownerUpper})`;
        
        lastRecord[uniqueKey] = Number(formData.amount); 
        lastRecord.meta[uniqueKey] = {
            name: formData.name,
            owner: ownerUpper,
            type: String(formData.type).toUpperCase(),
            currency: String(formData.currency).toUpperCase(),
            displayName: uniqueKey
        };
        newHistory[lastIdx] = lastRecord;
    }

    setData({ ...data, [listKey]: newList, history: newHistory });
    setEditModal({ ...editModal, isOpen: false });
    try { await fetch(apiUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: editModal.type === 'plan' ? 'update_plan' : 'update_asset', date: new Date().toISOString().split('T')[0], ...formData, amount: Number(formData.amount), owner: String(formData.owner).toUpperCase(), type: String(formData.type).toUpperCase(), currency: String(formData.currency).toUpperCase(), note: formData.amount === 0 ? 'DELETE' : '' }) }); } catch(e) {}
  };

  const currentNetWorth = useMemo(() => {
    const displayRate = DEFAULT_RATES[displayCurrency] || 1;
    let total = 0;
    data.assets.filter(a => (selectedOwner === 'all' || normalizeOwner(a.owner) === selectedOwner)).forEach((a: Asset) => {
       const val = (Number(a.amount || a.balance || 0) * (DEFAULT_RATES[a.currency.toUpperCase()] || 1)) / displayRate;
       if (normalizeType(a.type) === 'debt') total -= val; else total += val;
    });
    return total;
  }, [data.assets, selectedOwner, displayCurrency]);

  if (!isConfigured) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600"><Building2 size={32}/></div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">歡迎回家</h1>
        <input id="urlInput" type="text" placeholder="貼上您的 GAS URL" className="w-full bg-slate-50 border p-4 rounded-xl mb-4 text-xs font-mono outline-none" />
        <button onClick={() => { const val = (document.getElementById('urlInput') as HTMLInputElement)?.value.trim(); if(val?.includes('/exec')) { localStorage.setItem(STORAGE_KEY_API, val); setApiUrl(val); setIsConfigured(true); refreshData(val); } }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">連結系統</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto bg-white min-h-screen relative font-sans text-slate-900">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} currentCurrency={displayCurrency} onCurrencyChange={(c: string) => { setDisplayCurrency(c); localStorage.setItem('sudhana_currency', c); }} onLogout={() => { localStorage.removeItem(STORAGE_KEY_API); window.location.reload(); }} />
      <EditModal isOpen={editModal.isOpen} onClose={() => setEditModal({ ...editModal, isOpen: false })} data={editModal.data} type={editModal.type} onSave={handleSaveItem} />
      {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80"><Loader2 className="animate-spin text-emerald-600"/></div>}
      <div className="bg-slate-900 pt-10 pb-6 rounded-b-[40px] relative overflow-hidden transition-all duration-500">
        <div className="relative z-20 px-6 flex justify-between items-start mb-6">
          <div className="flex-1"><div className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] uppercase tracking-widest mb-1"><LayoutDashboard size={14}/> Family Finance</div><h1 className="text-white font-bold text-lg">{appTitle}</h1></div>
          <button onClick={() => setShowSettings(true)} className="bg-white/10 p-2 rounded-full text-white backdrop-blur-sm hover:bg-white/20 transition-all"><Settings size={18}/></button>
        </div>
        <div className="relative z-20 px-6 mb-4"><div><p className="text-slate-400 text-xs mb-1">{getOwnerDisplayName(selectedOwner)} 總淨值 ({displayCurrency})</p><h2 className="text-4xl font-black text-white tracking-tight"><span className="text-2xl opacity-50 mr-1">$</span>{formatMoney(currentNetWorth)}</h2></div></div>
      </div>
      <div className="px-5 -mt-4 relative z-30">
        <div className="bg-white p-1 rounded-xl shadow-lg border border-slate-100 flex mb-6">{['all', 'husband', 'wife'].map(o => (<button key={o} onClick={() => setSelectedOwner(o)} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${selectedOwner === o ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:bg-slate-50'}`}>{getOwnerDisplayName(o)}</button>))}</div>
        <DashboardView accounts={data.assets.filter(a => (selectedOwner === 'all' || normalizeOwner(a.owner) === selectedOwner))} plans={data.plans.filter(p => (selectedOwner === 'all' || normalizeOwner(p.owner) === selectedOwner))} rates={DEFAULT_RATES} selectedOwner={selectedOwner} displayCurrency={displayCurrency} onEditAsset={(item: any) => setEditModal({ isOpen: true, type: 'asset', data: item })} onEditPlan={(item: any) => setEditModal({ isOpen: true, type: 'plan', data: item })} historyData={data.history} />
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
          <button onClick={() => setEditModal({ isOpen: true, type: 'plan', data: null })} className="w-12 h-12 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center hover:scale-110 active:scale-90 transition-transform"><Banknote size={22}/></button>
          <button onClick={() => setEditModal({ isOpen: true, type: 'asset', data: null })} className="w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-90 transition-transform"><Landmark size={24}/></button>
        </div>
      </div>
      <div className="text-center text-[10px] text-slate-300 pb-6">{CURRENT_VERSION}</div>
    </div>
  );
}