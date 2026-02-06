import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Loader2, LogOut, Settings, Save, 
  Landmark, Wallet, TrendingUp, X,
  TrendingDown, Minus, Banknote, LayoutDashboard
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

const STORAGE_KEY_API = 'sudhana_family_finance_api';
const STORAGE_KEY_TITLE = 'sudhana_family_title';
const CURRENT_VERSION = "修心之道家庭資產記帳本 V1.3 (Desktop Optimized)";

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
  if (['husband', '老公', '爸爸'].includes(s)) return 'husband';
  if (['wife', '老婆', '媽媽'].includes(s)) return 'wife';
  return 'family';
};

const normalizeType = (typeStr: string) => {
  const s = String(typeStr || '').toLowerCase();
  if (s === 'stock' || s.includes('投資')) return 'stock';
  if (s === 'debt' || s.includes('負債')) return 'debt';
  return 'cash'; 
};

const getOwnerDisplayName = (key: string) => {
  if (key === 'husband') return '老公';
  if (key === 'wife') return '老婆';
  return '全家';
};

const formatMoney = (val: number) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(val || 0);

// --- 子組件 ---
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

// 🌟 全新自訂 Tooltip 組件 (解決數量限制與 0 元顯示問題)
const CustomTooltip = ({ active, payload, label, selectedOwner }: any) => {
  if (active && payload && payload.length) {
    // 1. 排序：金額大的在上面
    const sorted = [...payload].sort((a: any, b: any) => b.value - a.value);
    
    // 2. 格式化名稱
    const formatName = (name: string) => {
        if (name === 'totalValue') return '當月總計';
        const match = name.match(/(.*)\s\((.*)\)/);
        if (match && selectedOwner === 'all') {
            return `${getOwnerDisplayName(match[2].toLowerCase())} - ${match[1]}`;
        }
        return name.split('(')[0];
    };

    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-100 rounded-xl shadow-xl text-xs max-h-64 overflow-y-auto custom-scrollbar">
        <p className="font-bold text-slate-700 mb-2 border-b pb-1">{label}月</p>
        <div className="space-y-1">
          {sorted.map((entry: any, index: number) => {
             const isTotal = entry.name === 'totalValue';
             // 如果不是總計，且金額為 0，顯示灰色
             const isZero = entry.value === 0;
             if (isZero && isTotal) return null; // 總計為 0 不用特別顯示

             return (
              <div key={index} className={`flex justify-between gap-4 ${isTotal ? 'font-black text-slate-800 border-t pt-1 mt-1' : ''} ${isZero ? 'opacity-50' : ''}`}>
                <span style={{ color: isTotal ? '#0f172a' : entry.fill }} className="truncate max-w-[120px]">
                    {formatName(entry.name)}
                </span>
                <span className="font-mono">
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
        {data.some((d: any) => d.totalValue > 0) ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{top: 5, right: 2, left: 2, bottom: 0}}>
              {/* 應用自訂 Tooltip */}
              <Tooltip content={<CustomTooltip selectedOwner={selectedOwner} />} cursor={{fill: '#f1f5f9'}} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#cbd5e1'}} />
              {assetKeys.map((key: string, index: number) => (
                <Bar key={key} dataKey={key} stackId="a" fill={getColor(index)} barSize={16} radius={index === assetKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
              <Line type="monotone" dataKey="totalValue" stroke={config.barColor} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <div className="h-full flex items-center justify-center text-xs text-slate-300">尚無數據</div>}
      </div>
    </div>
  );
};

const DashboardView = ({ accounts, plans, rates, selectedOwner, displayCurrency, onEditAsset, historyData }: any) => {
  const { totalMonthlyIncome, totalMonthlyExpense } = useMemo(() => {
    let inc = 0, exp = 0;
    const displayRate = rates[displayCurrency] || 1;
    plans.forEach((p: Plan) => {
      const amt = (Number(p.amount || 0) * (rates[p.currency.toUpperCase()] || 1)) / displayRate;
      const monthly = amt / (FREQUENCY_OPTS[p.frequency.toLowerCase()]?.divisor || 1);
      if (String(p.type).toLowerCase().includes('income')) inc += monthly; else exp += monthly;
    });
    return { totalMonthlyIncome: inc, totalMonthlyExpense: exp };
  }, [plans, rates, displayCurrency]);

  const monthlyBalance = totalMonthlyIncome - totalMonthlyExpense;

  const { trends, totals } = useMemo(() => {
    const res: any = { cash: { data: [], keys: new Set() }, stock: { data: [], keys: new Set() }, debt: { data: [], keys: new Set() } };
    const curTotals: any = { cash: 0, stock: 0, debt: 0 };
    const displayRate = rates[displayCurrency] || 1;

    accounts.forEach((acc: Asset) => {
      const val = (Number(acc.amount || acc.balance || 0) * (rates[acc.currency.toUpperCase()] || 1)) / displayRate;
      const cat = ASSET_TYPES[normalizeType(acc.type)]?.category;
      if (cat) curTotals[cat] += val;
    });

    if (historyData) {
      historyData.slice(-12).forEach((record: any) => {
        const monthLabel = record.month.split('-')[1];
        ['cash', 'stock', 'debt'].forEach(cat => {
            const entry: any = { name: monthLabel, totalValue: 0 };
            Object.keys(record).forEach(key => {
                if (key === 'month' || key === 'meta') return;
                const m = record.meta?.[key];
                if (!m || (selectedOwner !== 'all' && normalizeOwner(m.owner) !== selectedOwner)) return;
                
                // 過濾掉空名稱或 undefined 的項目
                if(!m.displayName || m.displayName.trim() === '') return;

                if (ASSET_TYPES[normalizeType(m.type)]?.category === cat) {
                    const converted = (Number(record[key]) * (rates[m.currency.toUpperCase()] || 1)) / displayRate;
                    entry.totalValue += converted;
                    entry[m.displayName] = converted;
                    res[cat].keys.add(m.displayName);
                }
            });
            res[cat].data.push(entry);
        });
      });
    }
    return { trends: res, totals: curTotals };
  }, [historyData, selectedOwner, accounts, rates, displayCurrency]);

  return (
    <div className="pb-24 space-y-6 animate-in fade-in duration-500">
      
      {/* 1. 電腦版 Grid 佈局 (md:grid-cols-3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['cash', 'stock', 'debt'].map(k => (
          <TrendBlock key={k} title={ASSET_TYPES[k].label} typeKey={k} data={trends[k].data} assetKeys={Array.from(trends[k].keys).sort()} currentTotal={totals[k]} selectedOwner={selectedOwner} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 左欄：收支概況 */}
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
        </div>

        {/* 右欄：資產明細 (電腦版顯示) */}
        <div className="space-y-3">
            <div className="flex justify-between items-end px-1"><h3 className="font-bold text-slate-700 text-sm">資產明細 ({getOwnerDisplayName(selectedOwner)})</h3></div>
            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {accounts.map((acc: Asset) => {
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
    if (isOpen) setFormData(data ? { ...data, currency: data.currency || 'TWD', owner: data.owner || 'husband', amount: data.amount || '', frequency: data.frequency || 'monthly' } : { owner: 'husband', type: type === 'plan' ? 'expense' : 'cash', currency: 'TWD', amount: '', frequency: 'monthly' });
  }, [isOpen, data, type]);

  if (!isOpen) return null;
  const isPlan = type === 'plan';
  const handleSave = () => { if(!formData.name || formData.amount === '') return; onSave({ ...formData, amount: Number(formData.amount) }); };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex justify-between items-center border-b pb-4"><h3 className="text-lg font-black text-slate-800">{formData.id ? '編輯' : '新增'}{isPlan ? '收支' : '資產'}</h3><button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button></div>
        <div className="space-y-4">
          <div className="flex gap-3">
             <div className="flex-1 space-y-1"><label className="text-xs font-bold text-slate-400">歸屬人</label><select className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold text-slate-700" value={normalizeOwner(formData.owner)} onChange={e => setFormData({...formData, owner: e.target.value})}><option value="husband">老公</option><option value="wife">老婆</option><option value="family">全家</option></select></div>
             <div className="flex-1 space-y-1"><label className="text-xs font-bold text-slate-400">類型</label><select className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold text-slate-700" value={normalizeType(formData.type)} onChange={e => setFormData({...formData, type: e.target.value})}>{isPlan ? (<><option value="expense">支出</option><option value="income">收入</option></>) : Object.entries(ASSET_TYPES).map(([k, v]: [string, any]) => (<option key={k} value={k}>{v.label}</option>))}</select></div>
          </div>
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
    setData({ ...data, [listKey]: newList });
    setEditModal({ ...editModal, isOpen: false });
    try { await fetch(apiUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: editModal.type === 'plan' ? 'update_plan' : 'update_asset', date: new Date().toISOString().split('T')[0], ...formData, owner: String(formData.owner).toUpperCase(), type: String(formData.type).toUpperCase(), currency: String(formData.currency).toUpperCase(), note: formData.amount === 0 ? 'DELETE' : '' }) }); } catch(e) {}
  };

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

  const filteredAssets = data.assets.filter(a => (selectedOwner === 'all' || normalizeOwner(a.owner) === selectedOwner));
  const currentNetWorth = filteredAssets.reduce((total, a) => {
    const val = (Number(a.amount || a.balance || 0) * (DEFAULT_RATES[a.currency.toUpperCase()] || 1)) / (DEFAULT_RATES[displayCurrency] || 1);
    return normalizeType(a.type) === 'debt' ? total - val : total + val;
  }, 0);

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
        <DashboardView accounts={filteredAssets} plans={data.plans.filter((p: any) => (selectedOwner === 'all' || normalizeOwner(p.owner) === selectedOwner) && Number(p.amount || 0) !== 0)} rates={DEFAULT_RATES} selectedOwner={selectedOwner} displayCurrency={displayCurrency} onEditAsset={(item: any) => setEditModal({ isOpen: true, type: 'asset', data: item })} historyData={data.history} />
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
          <button onClick={() => setEditModal({ isOpen: true, type: 'plan', data: null })} className="w-12 h-12 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center hover:scale-110 active:scale-90 transition-transform"><Banknote size={22}/></button>
          <button onClick={() => setEditModal({ isOpen: true, type: 'asset', data: null })} className="w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-90 transition-transform"><Landmark size={24}/></button>
        </div>
      </div>
      <div className="text-center text-[10px] text-slate-300 pb-6">{CURRENT_VERSION}</div>
    </div>
  );
}