import React, { useState, useMemo } from 'react';
import { Search, Loader2, ExternalLink, Filter, ArrowUpDown, Check, X, Sparkles, HeartHandshake, ShieldCheck } from 'lucide-react';
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

  const activeFilters = [filterTdah, filterTcc, filterTea].filter(Boolean).length;
  const hasResults = sortedData.length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.82),_transparent_32%),radial-gradient(circle_at_80%_10%,_rgba(167,243,208,0.24),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(253,186,116,0.18),_transparent_30%),linear-gradient(180deg,_#f8f4ee_0%,_#f4efe7_46%,_#efe8de_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.028)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />
      <div className="pointer-events-none absolute left-[-6rem] top-24 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5rem] top-[22rem] h-80 w-80 rounded-full bg-amber-200/20 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="mb-6 rounded-[2rem] border border-white/60 bg-white/45 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6 lg:mb-8 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                PsicoFinder 2.0
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl">
                Encontre terapeutas com clareza, acolhimento e menos fricção.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Uma interface mais calma para explorar dados da Doctoralia. Mantemos a estrutura em que você confia, mas com uma experiência mais humana, moderna e fácil de ler.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/75 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
                  <HeartHandshake className="h-4 w-4 text-emerald-600" />
                  Descoberta de terapias
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/75 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-sky-600" />
                  Filtros precisos
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/75 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
                  <ArrowUpDown className="h-4 w-4 text-amber-600" />
                  Ordenação por preço
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-1">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Páginas para coletar
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={pages}
                    onChange={(e) => setPages(Number(e.target.value))}
                    className="h-12 w-28 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    min="1"
                    max="10"
                  />
                  <p className="text-sm leading-5 text-slate-500">
                    Mais páginas ampliam o alcance, mas a interface continua leve.
                  </p>
                </div>
              </div>

              <button
                onClick={handleScrape}
                disabled={loading}
                className="group inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 transition-transform group-hover:scale-110" />}
                {loading ? 'Buscando terapeutas...' : 'Iniciar busca'}
              </button>
            </div>
          </div>
        </header>

        {/* Progress Bar */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden lg:mb-8"
            >
              <div className="rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="mb-4 flex items-end justify-between gap-6">
                  <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Progresso da coleta</h3>
                    <p className="max-w-md truncate text-lg font-semibold text-slate-900">
                      {progress.name || 'Buscando lista de profissionais...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                      {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                    </span>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                      {progress.current} / {progress.total} profissionais
                    </p>
                  </div>
                </div>
                
                <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                  <motion.div 
                    className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#0f766e_50%,#14b8a6_100%)]"
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
        <div className="mb-6 rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:mb-8 lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.02em] text-slate-900">Refine sua busca</h2>
              <p className="mt-1 text-sm text-slate-500">
                Mantemos a mesma lógica, mas deixamos os controles mais claros e convidativos.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
              {activeFilters} filtros ativos
            </div>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex-1 w-full">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                <Filter className="h-3 w-3" />
                Filtro por regex (opcional)
              </div>
              <input
                type="text"
                placeholder="ex.: ^Ana|Maria|.*terapia.*"
                value={regexFilter}
                onChange={(e) => setRegexFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setFilterTdah(prev => !prev)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 transition-all ${
                  filterTdah 
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm' 
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${filterTdah ? 'bg-emerald-500' : 'bg-black/20'}`} />
                <span className="text-sm font-medium">Só TDAH</span>
              </button>

              <button 
                onClick={() => setFilterTcc(prev => !prev)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 transition-all ${
                  filterTcc 
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm' 
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${filterTcc ? 'bg-emerald-500' : 'bg-black/20'}`} />
                <span className="text-sm font-medium">Só TCC</span>
              </button>

              <button 
                onClick={() => setFilterTea(prev => !prev)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 transition-all ${
                  filterTea 
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm' 
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${filterTea ? 'bg-emerald-500' : 'bg-black/20'}`} />
                <span className="text-sm font-medium">Só TEA</span>
              </button>

              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 transition-all hover:border-slate-300 hover:bg-white"
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="text-sm font-medium">Preço: {sortOrder === 'asc' ? 'menor para maior' : 'maior para menor'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Nome</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Preço</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 text-center">TDAH</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 text-center">TCC</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 text-center">TEA</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Perfil</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {hasResults ? (
                    sortedData.map((item, idx) => (
                      <motion.tr
                        key={item.url}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group border-b border-slate-100 transition-colors hover:bg-emerald-50/35"
                      >
                        <td className="px-6 py-4 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-base font-semibold text-slate-800">
                            {item.price > 0 ? `R$ ${item.price}` : 's/ preço'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            {item.tdah ? (
                              <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-700 ring-1 ring-emerald-200"><Check className="w-4 h-4" /></div>
                            ) : (
                              <div className="rounded-full bg-slate-100 p-1.5 text-slate-300 ring-1 ring-slate-200"><X className="w-4 h-4" /></div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            {item.tcc ? (
                              <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-700 ring-1 ring-emerald-200"><Check className="w-4 h-4" /></div>
                            ) : (
                              <div className="rounded-full bg-slate-100 p-1.5 text-slate-300 ring-1 ring-slate-200"><X className="w-4 h-4" /></div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            {item.tea ? (
                              <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-700 ring-1 ring-emerald-200"><Check className="w-4 h-4" /></div>
                            ) : (
                              <div className="rounded-full bg-slate-100 p-1.5 text-slate-300 ring-1 ring-slate-200"><X className="w-4 h-4" /></div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            Ver perfil <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="mx-auto max-w-md rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-slate-500">
                          <p className="text-lg font-semibold text-slate-800">
                            {loading ? 'Buscando dados na Doctoralia...' : 'Nenhum resultado ainda'}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {loading
                              ? 'A lista vai aparecer aqui assim que a coleta terminar.'
                              : 'Clique em "Iniciar busca" para começar e trazer os terapeutas para a tabela abaixo.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Footer info */}
        <footer className="mt-6 flex flex-col gap-2 px-1 pb-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div>Total de resultados: {sortedData.length}</div>
          <div>Doctoralia Scraper v2.0</div>
        </footer>
      </div>
    </div>
  );
}
