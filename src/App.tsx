import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Loader2, LogOut, Settings, Save, 
  Landmark, Wallet, TrendingUp, X,
  TrendingDown, Minus, Banknote
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
const CURRENT_VERSION = "修心之道家庭資產記帳本 V1.2";

const CURRENCY_LIST = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'AUD', 'CAD', 'CHF', 'GBP', 'HKD', 'KRW', 'SGD', 'VND'];

const DEFAULT_RATES: Record<string, number> = { 
  'TWD': 1, 'USD': 31.58, 'JPY': 0.20, 'EUR': 37.24, 'CNY': 4.55,
  'AUD': 22.11, 'CAD': 23.10, 'GBP': 43.18, 'HKD': 4.04, 'KRW': 0.02, 
  'SGD': 24.84, 'VND': 0.0013, 'MYR': 8.03, 'NZD': 19.05, 'THB': 1.0, 'ZAR': 1.98, 'SEK': 3.54
};

const ASSET_TYPES: Record<string, any> = {
  'cash':  { label: '存款', category: 'cash', icon: Wallet, color: 'text-emerald-600', bgColor: 'bg-emerald-50', barColor: '#10B981', palette: ['#10B981', '#34D399', '#6EE7B7', '#059669'] },
  'stock': { label: '投資', category: 'stock', icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50', barColor: '#3B82F6', palette: ['#3B82F6', '#60A5FA', '#93C5FD', '#2563EB'] },
  'debt':  { label: '債務', category: 'debt', icon: Banknote, color: 'text-red-600', bgColor: 'bg-red-50', barColor: '#EF4444', palette: ['#EF4444', '#F87171', '#FCA5A5', '#DC2626'] },
};

const normalizeOwner = (o: string) => {
  const s = String(o || '').toLowerCase();
  if (['husband', '老公', '爸爸'].includes(s)) return 'husband';
  if (['wife', '老婆', '媽媽'].includes(s)) return 'wife';
  return 'family';
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

const TrendBlock = ({ title, typeKey, data, assetKeys, currentTotal, selectedOwner }: any) => {
  const config = ASSET_TYPES[typeKey];
  const latest = data.length > 0 ? data[data.length - 1].totalValue : 0;
  const prev = data.length > 1 ? data[data.length - 2].totalValue : latest;
  const percent = prev !== 0 ? ((latest - prev) / prev) * 100 : 0;
  
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1"><div className={`p-1 rounded-md ${config.bgColor} ${config.color}`}><config.icon size={14} /></div>{title}</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">${formatMoney(currentTotal)}</div>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-slate-50 ${percent === 0 ? 'text-slate-400' : (percent > 0 ? 'text-emerald-600' : 'text-orange-500')}`}>{percent === 0 ? <Minus size={14}/> : (percent > 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>)}{Math.abs(percent).toFixed(1)}%</div>
      </div>
      <div className="h-32 w-full">
        {data.some((d: any) => d.totalValue > 0) ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{top: 5, right: 10, left: 10, bottom: 0}}>
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' } as any}
                 formatter={(val: any, name: any) => [Number(val) === 0 || name === 'totalValue' ? null : `$${formatMoney(val)}`, String(name).split('(')[0]]}
                 labelFormatter={(label) => `${label}月`}
              />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#cbd5e1'}} />
              {assetKeys.map((key: string, index: number) => (
                <Bar key={key} dataKey={key} stackId="a" fill={config.palette[index % config.palette.length]} barSize={16} radius={index === assetKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
              <Line type="monotone" dataKey="totalValue" stroke={config.barColor} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <div className="h-full flex items-center justify-center text-xs text-slate-300">尚無數據</div>}
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
      if (json.status === 'success') setData(json);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleSaveItem = async (formData: any) => {
    setEditModal({ ...editModal, isOpen: false });
    try { await fetch(apiUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: editModal.type === 'plan' ? 'update_plan' : 'update_asset', date: new Date().toISOString().split('T')[0], ...formData, amount: Number(formData.amount), owner: String(formData.owner).toUpperCase(), currency: String(formData.currency).toUpperCase() }) }); refreshData(apiUrl); } catch(e) {}
  };

  const currentNetWorth = useMemo(() => {
    const displayRate = DEFAULT_RATES[displayCurrency] || 1;
    return data.assets.filter(a => selectedOwner === 'all' || normalizeOwner(a.owner) === selectedOwner).reduce((total, a) => {
       const val = (Number(a.amount || 0) * (DEFAULT_RATES[a.currency.toUpperCase()] || 1)) / displayRate;
       return a.type.toLowerCase().includes('debt') ? total - val : total + val;
    }, 0);
  }, [data.assets, selectedOwner, displayCurrency]);

  if (!isConfigured) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full">
        <Building2 size={48} className="mx-auto text-emerald-600 mb-4"/>
        <h1 className="text-xl font-bold mb-4">連結資產系統</h1>
        <input id="urlInput" type="text" placeholder="貼上 GAS URL" className="w-full border p-3 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-emerald-500" />
        <button onClick={() => { const val = (document.getElementById('urlInput') as HTMLInputElement)?.value.trim(); if(val?.includes('/exec')) { localStorage.setItem(STORAGE_KEY_API, val); setApiUrl(val); setIsConfigured(true); refreshData(val); } }} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">登入</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen font-sans text-slate-900">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} currentCurrency={displayCurrency} onCurrencyChange={(c: string) => { setDisplayCurrency(c); localStorage.setItem('sudhana_currency', c); }} onLogout={() => { localStorage.removeItem(STORAGE_KEY_API); window.location.reload(); }} />
      {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60"><Loader2 className="animate-spin text-emerald-600"/></div>}
      
      <div className="bg-slate-900 p-6 pt-10 rounded-b-[40px] text-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex-1 text-sm opacity-60 flex items-center gap-2"><Building2 size={14}/> Family Finance</div>
          <button onClick={() => setShowSettings(true)} className="p-2 bg-white/10 rounded-full"><Settings size={18}/></button>
        </div>
        <p className="text-xs opacity-50 mb-1">{getOwnerDisplayName(selectedOwner)} 總淨值 ({displayCurrency})</p>
        <h2 className="text-4xl font-black tracking-tight">${formatMoney(currentNetWorth)}</h2>
      </div>

      <div className="px-5 -mt-6">
        <div className="bg-white p-1 rounded-xl shadow-lg flex mb-6 border border-slate-100">
          {['all', 'husband', 'wife'].map(o => (<button key={o} onClick={() => setSelectedOwner(o)} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${selectedOwner === o ? 'bg-slate-900 text-white shadow' : 'text-slate-400'}`}>{getOwnerDisplayName(o)}</button>))}
        </div>

        {['cash', 'stock', 'debt'].map(cat => {
            const keys = new Set<string>();
            const trendData = data.history.slice(-12).map(record => {
                const entry: any = { name: record.month.split('-')[1], totalValue: 0 };
                Object.keys(record).forEach(key => {
                    if (key === 'month' || key === 'meta') return;
                    const m = record.meta?.[key];
                    if (!m || (selectedOwner !== 'all' && normalizeOwner(m.owner) !== selectedOwner)) return;
                    if (ASSET_TYPES[m.type.toLowerCase()]?.category === cat || m.type.toLowerCase().includes(cat)) {
                        const val = (Number(record[key]) * (DEFAULT_RATES[m.currency.toUpperCase()] || 1)) / (DEFAULT_RATES[displayCurrency] || 1);
                        entry.totalValue += val;
                        entry[m.displayName] = val;
                        keys.add(m.displayName);
                    }
                });
                return entry;
            });
            const curTotal = data.assets.filter(a => (selectedOwner === 'all' || normalizeOwner(a.owner) === selectedOwner) && (ASSET_TYPES[a.type.toLowerCase()]?.category === cat || a.type.toLowerCase().includes(cat))).reduce((sum, a) => sum + (a.amount * (DEFAULT_RATES[a.currency.toUpperCase()] || 1) / (DEFAULT_RATES[displayCurrency] || 1)), 0);
            return <TrendBlock key={cat} title={ASSET_TYPES[cat].label} typeKey={cat} data={trendData} assetKeys={Array.from(keys)} currentTotal={curTotal} selectedOwner={selectedOwner} />
        })}

        <div className="mt-8 pb-24">
            <h3 className="text-sm font-bold text-slate-400 mb-3 px-1">資產明細</h3>
            {data.assets.filter(a => selectedOwner === 'all' || normalizeOwner(a.owner) === selectedOwner).map(acc => (
                <div key={acc.id} onClick={() => setEditModal({ isOpen: true, type: 'asset', data: acc })} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center mb-2 shadow-sm">
                   <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-slate-400`}><Wallet size={18}/></div>
                   <div><div className="font-bold text-slate-700 text-sm">{selectedOwner === 'all' ? `${getOwnerDisplayName(acc.owner)} - ${acc.name}` : acc.name}</div><div className="text-[10px] text-slate-300 uppercase">{acc.currency}</div></div></div>
                   <div className="font-bold text-slate-800">${formatMoney(acc.amount)}</div>
                </div>
            ))}
        </div>
      </div>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <button onClick={() => setEditModal({ isOpen: true, type: 'asset', data: null })} className="w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center active:scale-95"><Landmark size={24}/></button>
      </div>

      <div className="text-center text-[10px] text-slate-300 pb-6">{CURRENT_VERSION}</div>

      {/* 簡易新增 Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center"><h3 className="font-bold">編輯資產</h3><button onClick={() => setEditModal({...editModal, isOpen:false})}><X/></button></div>
                <input type="text" placeholder="名稱" className="w-full p-3 border rounded-xl" defaultValue={editModal.data?.name || ''} id="editName"/>
                <input type="number" placeholder="金額" className="w-full p-3 border rounded-xl" defaultValue={editModal.data?.amount || ''} id="editAmount"/>
                <button onClick={() => handleSaveItem({ ...editModal.data, name: (document.getElementById('editName') as HTMLInputElement).value, amount: (document.getElementById('editAmount') as HTMLInputElement).value, owner: editModal.data?.owner || 'husband', type: editModal.data?.type || 'cash', currency: editModal.data?.currency || 'TWD' })} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">儲存</button>
            </div>
        </div>
      )}
    </div>
  );
}