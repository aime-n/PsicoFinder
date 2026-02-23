import React, { useState, useMemo } from 'react';
import { Search, Loader2, ExternalLink, Filter, ArrowUpDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Psychologist {
  name: string;
  url: string;
  price: number;
  tdah: boolean;
  tcc: boolean;
  tea: boolean;
}

export default function App() {
  const [data, setData] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [regexFilter, setRegexFilter] = useState('');
  const [pages, setPages] = useState(2);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterTdah, setFilterTdah] = useState(false);
  const [filterTcc, setFilterTcc] = useState(false);
  const [filterTea, setFilterTea] = useState(false);

  const handleScrape = async () => {
    setLoading(true);
    setData([]);
    setProgress({ current: 0, total: 0, name: 'Initializing...' });
    
    try {
      const response = await fetch(`/api/scrape?pages=${pages}&tdah=${filterTdah}&tcc=${filterTcc}&tea=${filterTea}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '');
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'start') {
                setProgress(prev => ({ ...prev, total: event.total }));
              } else if (event.type === 'progress') {
                setProgress({ current: event.current, total: event.total, name: event.name });
              } else if (event.type === 'complete') {
                setData(event.data);
                setLoading(false);
              } else if (event.type === 'error') {
                console.error('Scrape error:', event.message);
                setLoading(false);
              }
            } catch (e) {
              console.error('Failed to parse event:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to scrape:', error);
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let filtered = data;
    
    if (regexFilter) {
      try {
        const re = new RegExp(regexFilter, 'i');
        filtered = filtered.filter(item => re.test(item.name) || re.test(item.url));
      } catch (e) {
        // Ignore invalid regex
      }
    }

    if (filterTdah) {
      filtered = filtered.filter(item => item.tdah);
    }

    if (filterTcc) {
      filtered = filtered.filter(item => item.tcc);
    }

    if (filterTea) {
      filtered = filtered.filter(item => item.tea);
    }

    return filtered;
  }, [data, regexFilter, filterTdah, filterTcc, filterTea]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
    });
  }, [filteredData, sortOrder]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-6xl font-bold tracking-tighter mb-2">PsicoFinder</h1>
            <p className="text-lg opacity-60 italic font-serif">Ultra-fast Doctoralia psychologist scraper & filter</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Pages to Scrape</label>
              <input 
                type="number" 
                value={pages} 
                onChange={(e) => setPages(Number(e.target.value))}
                className="bg-white border border-black/10 rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-black/5"
                min="1"
                max="10"
              />
            </div>
            <button
              onClick={handleScrape}
              disabled={loading}
              className="bg-[#141414] text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-black/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed h-[46px]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Scraping...' : 'Start Search'}
            </button>
          </div>
        </header>

        {/* Progress Bar */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-1">Scraping Progress</h3>
                    <p className="text-lg font-bold truncate max-w-md">
                      {progress.name || 'Fetching doctor list...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-mono font-bold">
                      {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                    </span>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-50">
                      {progress.current} / {progress.total} Doctors
                    </p>
                  </div>
                </div>
                
                <div className="h-4 bg-[#F5F5F0] rounded-full overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-[#141414]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="bg-white rounded-3xl p-6 mb-8 shadow-sm border border-black/5">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 w-full">
              <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-widest font-bold opacity-50">
                <Filter className="w-3 h-3" />
                Regex Filter (Optional)
              </div>
              <input
                type="text"
                placeholder="e.g. ^Ana|Maria|.*terapia.*"
                value={regexFilter}
                onChange={(e) => setRegexFilter(e.target.value)}
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10 font-mono text-sm"
              />
            </div>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setFilterTdah(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all border ${
                  filterTdah 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                    : 'bg-[#F5F5F0] border-transparent hover:bg-black/5'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${filterTdah ? 'bg-emerald-500' : 'bg-black/20'}`} />
                <span className="text-sm font-medium">TDAH Only</span>
              </button>

              <button 
                onClick={() => setFilterTcc(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all border ${
                  filterTcc 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                    : 'bg-[#F5F5F0] border-transparent hover:bg-black/5'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${filterTcc ? 'bg-emerald-500' : 'bg-black/20'}`} />
                <span className="text-sm font-medium">TCC Only</span>
              </button>

              <button 
                onClick={() => setFilterTea(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all border ${
                  filterTea 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                    : 'bg-[#F5F5F0] border-transparent hover:bg-black/5'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${filterTea ? 'bg-emerald-500' : 'bg-black/20'}`} />
                <span className="text-sm font-medium">TEA Only</span>
              </button>

              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F5F5F0] hover:bg-black/5 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="text-sm font-medium">Price: {sortOrder === 'asc' ? 'Low to High' : 'High to Low'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-black/5 bg-[#F5F5F0]/50">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold opacity-50">Name</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold opacity-50">Price</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold opacity-50 text-center">TDAH</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold opacity-50 text-center">TCC</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold opacity-50 text-center">TEA</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold opacity-50">Profile</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {sortedData.length > 0 ? (
                    sortedData.map((item, idx) => (
                      <motion.tr
                        key={item.url}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group border-b border-black/5 hover:bg-[#F5F5F0]/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold">{item.name}</td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-lg">
                            {item.price > 0 ? `R$ ${item.price}` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            {item.tdah ? (
                              <div className="bg-emerald-100 text-emerald-700 p-1 rounded-full"><Check className="w-4 h-4" /></div>
                            ) : (
                              <div className="bg-red-50 text-red-300 p-1 rounded-full"><X className="w-4 h-4" /></div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            {item.tcc ? (
                              <div className="bg-emerald-100 text-emerald-700 p-1 rounded-full"><Check className="w-4 h-4" /></div>
                            ) : (
                              <div className="bg-red-50 text-red-300 p-1 rounded-full"><X className="w-4 h-4" /></div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            {item.tea ? (
                              <div className="bg-emerald-100 text-emerald-700 p-1 rounded-full"><Check className="w-4 h-4" /></div>
                            ) : (
                              <div className="bg-red-50 text-red-300 p-1 rounded-full"><X className="w-4 h-4" /></div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium opacity-40 group-hover:opacity-100 transition-opacity"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center opacity-40 italic">
                        {loading ? 'Fetching data from Doctoralia...' : 'No results found. Click "Start Search" to begin.'}
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Footer info */}
        <footer className="mt-8 flex justify-between items-center text-[10px] uppercase tracking-widest font-bold opacity-30">
          <div>Total Results: {sortedData.length}</div>
          <div>Doctoralia Scraper v1.0</div>
        </footer>
      </div>
    </div>
  );
}
