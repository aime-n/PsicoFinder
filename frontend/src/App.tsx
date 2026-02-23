import {
  Building2,
  Languages,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Video,
} from 'lucide-react';
import { FormEvent, ReactElement, useEffect, useState } from 'react';

type Therapist = {
  id: number;
  slug: string;
  full_name: string;
  is_clinic: boolean;
  headline: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  remote_available: boolean;
  price_min: number | null;
  price_max: number | null;
  approaches: string[];
  specialties: string[];
  languages: string[];
  profile_url: string;
  updated_at: string;
};

type TherapistResponse = {
  items: Therapist[];
  total: number;
};

type FacetOption = {
  label: string;
  value: string;
  count: number;
};

type ApproachFacetResponse = {
  items: FacetOption[];
};

type SpecialtyFacetResponse = {
  items: FacetOption[];
};

type CityFacetResponse = {
  items: FacetOption[];
};

type LanguageFacetResponse = {
  items: FacetOption[];
};

type TherapistMetadataResponse = {
  latest_scraped_at: string | null;
  active_count: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const PAGE_SIZE = 15;

type TherapistFilters = {
  query: string;
  cities: string[];
  specialties: string[];
  approaches: string[];
  language: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
  remoteOnly: boolean;
  includeClinics: boolean;
};

type FacetSearchFieldProps = {
  title: string;
  icon: ReactElement;
  query: string;
  selectedOptions: FacetOption[];
  options: FacetOption[];
  loading: boolean;
  placeholder: string;
  emptyText: string;
  onQueryChange: (value: string) => void;
  onToggle: (option: FacetOption) => void;
  onRemove: (value: string) => void;
  onClearAll: () => void;
};

function FacetSearchField({
  title,
  icon,
  query,
  selectedOptions,
  options,
  loading,
  placeholder,
  emptyText,
  onQueryChange,
  onToggle,
  onRemove,
  onClearAll,
}: FacetSearchFieldProps) {
  return (
    <section className="facet-group facet-search-group">
      <label className="field">
        <span>
          {icon}
          {title}
        </span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
        />
      </label>

      {selectedOptions.length > 0 ? (
        <div className="selected-facet-row">
          <span className="selected-facet-label">Selected</span>
          {selectedOptions.map((option) => (
            <button
              className="selected-facet-pill"
              type="button"
              key={option.value}
              onClick={() => onRemove(option.value)}
            >
              <span>{option.label}</span>
              <small>Remove</small>
            </button>
          ))}
          <button className="ghost-button selected-facet-clear" type="button" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="facet-results-box">
        <div className="facet-header">
          <span>{query.trim() ? 'Matches' : 'Popular'}</span>
          {loading ? <small className="facet-loading">Loading...</small> : null}
        </div>
        <div className="pill-grid facet-result-grid">
          {options.length > 0 ? (
            options.map((option) => {
              const isActive = selectedOptions.some((selected) => selected.value === option.value);
              return (
                <button
                  key={option.value}
                  className={`pill-filter ${isActive ? 'pill-filter-active' : ''}`}
                  type="button"
                  onClick={() => onToggle(option)}
                >
                  <span>{option.label}</span>
                  <small>{option.count}</small>
                </button>
              );
            })
          ) : (
            <p className="facet-empty">{emptyText}</p>
          )}
        </div>
      </div>
    </section>
  );
}

const fallbackTherapists: Therapist[] = [
  {
    id: 1,
    slug: 'amanda-silva-sao-paulo',
    full_name: 'Amanda Silva',
    is_clinic: false,
    headline: 'Psicologa clinica com foco em ansiedade, TCC e atendimentos online.',
    bio: 'Atendimento com base em escuta ativa, psicoeducacao e planos objetivos para ansiedade, TDAH e estresse.',
    city: 'Sao Paulo',
    state: 'SP',
    remote_available: true,
    price_min: 180,
    price_max: 220,
    approaches: ['TCC'],
    specialties: ['Ansiedade', 'TDAH'],
    languages: ['Portuguese'],
    profile_url: '',
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    slug: 'bruna-costa-belo-horizonte',
    full_name: 'Bruna Costa',
    is_clinic: false,
    headline: 'Terapia afirmativa para adultos e casais com acolhimento e estrutura.',
    bio: 'Trabalho voltado para relacoes, autoestima e suporte emocional com uma abordagem acolhedora e pratica.',
    city: 'Belo Horizonte',
    state: 'MG',
    remote_available: true,
    price_min: 150,
    price_max: 180,
    approaches: ['Humanista'],
    specialties: ['Relacionamentos', 'Depressao'],
    languages: ['Portuguese', 'English'],
    profile_url: '',
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    slug: 'carla-oliveira-curitiba',
    full_name: 'Carla Oliveira',
    is_clinic: false,
    headline: 'Especialista em autismo, familia e desenvolvimento infantil.',
    bio: 'Acompanhamento infantil e familiar com foco em desenvolvimento, regulação e suporte aos cuidadores.',
    city: 'Curitiba',
    state: 'PR',
    remote_available: false,
    price_min: 200,
    price_max: 260,
    approaches: ['ABA', 'Integrativa'],
    specialties: ['TEA', 'Familia'],
    languages: ['Portuguese'],
    profile_url: '',
    updated_at: new Date().toISOString(),
  },
];

export default function App() {
  const [query, setQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState<FacetOption[]>([]);
  const [specialtyQuery, setSpecialtyQuery] = useState('');
  const [specialties, setSpecialties] = useState<FacetOption[]>([]);
  const [approachQuery, setApproachQuery] = useState('');
  const [approaches, setApproaches] = useState<FacetOption[]>([]);
  const [language, setLanguage] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('updated_desc');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [includeClinics, setIncludeClinics] = useState(false);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Therapist[]>(fallbackTherapists);
  const [total, setTotal] = useState(fallbackTherapists.length);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(true);
  const [latestScrape, setLatestScrape] = useState<TherapistMetadataResponse | null>(null);
  const [cityOptions, setCityOptions] = useState<FacetOption[]>([]);
  const [approachOptions, setApproachOptions] = useState<FacetOption[]>([]);
  const [specialtyOptions, setSpecialtyOptions] = useState<FacetOption[]>([]);
  const [languageOptions, setLanguageOptions] = useState<FacetOption[]>([]);
  const [specialtyModalTherapist, setSpecialtyModalTherapist] = useState<Therapist | null>(null);

  useEffect(() => {
    void fetchTherapists(0);
    void fetchMetadata();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchCityFacets(cityQuery);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [cityQuery, includeClinics]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchSpecialtyFacets(specialtyQuery);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [specialtyQuery, includeClinics]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchApproachFacets(approachQuery);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [approachQuery, includeClinics]);

  useEffect(() => {
    void fetchLanguageFacets();
  }, [includeClinics]);

  function buildTherapistFilters(overrides: Partial<TherapistFilters> = {}): TherapistFilters {
    return {
      query,
      cities: cities.map((option) => option.value),
      specialties: specialties.map((option) => option.value),
      approaches: approaches.map((option) => option.value),
      language,
      minPrice,
      maxPrice,
      sort,
      remoteOnly,
      includeClinics,
      ...overrides,
    };
  }

  async function fetchTherapists(nextPage: number, overrides: Partial<TherapistFilters> = {}) {
    setLoading(true);
    const filters = buildTherapistFilters(overrides);

    const params = new URLSearchParams();
    if (filters.query.trim()) params.set('q', filters.query.trim());
    filters.cities.forEach((value) => params.append('city', value));
    filters.specialties.forEach((value) => params.append('specialty', value));
    filters.approaches.forEach((value) => params.append('approach', value));
    if (filters.language.trim()) params.set('language', filters.language.trim());
    if (filters.remoteOnly) params.set('remote_only', 'true');
    if (filters.includeClinics) params.set('include_clinics', 'true');
    if (filters.minPrice.trim()) params.set('min_price', filters.minPrice.trim());
    if (filters.maxPrice.trim()) params.set('max_price', filters.maxPrice.trim());
    params.set('sort', filters.sort);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(nextPage * PAGE_SIZE));

    try {
      const response = await fetch(`${API_BASE_URL}/therapists?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as TherapistResponse;
      setItems(payload.items);
      setTotal(payload.total);
      setUsingFallback(false);
      setPage(nextPage);
    } catch {
      setItems(fallbackTherapists);
      setTotal(fallbackTherapists.length);
      setUsingFallback(true);
      setPage(0);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCityFacets(search = cityQuery) {
    try {
      const params = new URLSearchParams();
      if (includeClinics) params.set('include_clinics', 'true');
      if (search.trim()) params.set('q', search.trim());
      params.set('limit', '12');
      const response = await fetch(`${API_BASE_URL}/therapists/cities?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as CityFacetResponse;
      setCityOptions(payload.items);
    } catch {
      setCityOptions([]);
    }
  }

  async function fetchApproachFacets(search = approachQuery) {
    try {
      const params = new URLSearchParams();
      if (includeClinics) params.set('include_clinics', 'true');
      if (search.trim()) params.set('q', search.trim());
      params.set('limit', '12');
      const response = await fetch(`${API_BASE_URL}/therapists/approaches?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApproachFacetResponse;
      setApproachOptions(payload.items);
    } catch {
      setApproachOptions([]);
    }
  }

  async function fetchSpecialtyFacets(search = specialtyQuery) {
    try {
      const params = new URLSearchParams();
      if (includeClinics) params.set('include_clinics', 'true');
      if (search.trim()) params.set('q', search.trim());
      params.set('limit', '12');
      const response = await fetch(`${API_BASE_URL}/therapists/specialties?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as SpecialtyFacetResponse;
      setSpecialtyOptions(payload.items);
    } catch {
      setSpecialtyOptions([]);
    }
  }

  async function fetchLanguageFacets() {
    try {
      const params = new URLSearchParams();
      if (includeClinics) params.set('include_clinics', 'true');
      params.set('limit', '16');
      const response = await fetch(`${API_BASE_URL}/therapists/languages?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as LanguageFacetResponse;
      setLanguageOptions(payload.items);
    } catch {
      setLanguageOptions([]);
    }
  }

  async function fetchMetadata() {
    try {
      const response = await fetch(`${API_BASE_URL}/therapists/metadata`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as TherapistMetadataResponse;
      setLatestScrape(payload);
    } catch {
      setLatestScrape(null);
    }
  }

  useEffect(() => {
    if (!specialtyModalTherapist) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSpecialtyModalTherapist(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [specialtyModalTherapist]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void fetchTherapists(0);
  }

  function toggleSelection(current: FacetOption[], option: FacetOption) {
    const exists = current.some((item) => item.value === option.value);
    return exists
      ? current.filter((item) => item.value !== option.value)
      : [...current, option];
  }

  function removeSelection(
    current: FacetOption[],
    value: string,
    setter: (next: FacetOption[]) => void,
  ) {
    setter(current.filter((item) => item.value !== value));
  }

  function clearSelections(setter: (next: FacetOption[]) => void) {
    setter([]);
  }

  function resetFilters() {
    setQuery('');
    setCityQuery('');
    setCities([]);
    setSpecialtyQuery('');
    setSpecialties([]);
    setApproachQuery('');
    setApproaches([]);
    setLanguage('');
    setMinPrice('');
    setMaxPrice('');
    setSort('updated_desc');
    setRemoteOnly(false);
    setIncludeClinics(false);
    setSpecialtyModalTherapist(null);
    void fetchTherapists(0, {
      query: '',
      cities: [],
      specialties: [],
      approaches: [],
      language: '',
      minPrice: '',
      maxPrice: '',
      sort: 'updated_desc',
      remoteOnly: false,
      includeClinics: false,
    });
  }

  function selectCity(option: FacetOption) {
    const next = toggleSelection(cities, option);
    setCities(next);
    setCityQuery('');
    void fetchTherapists(0, {
      cities: next.map((item) => item.value),
    });
  }

  function removeCity(value: string) {
    const next = cities.filter((item) => item.value !== value);
    setCities(next);
    void fetchTherapists(0, {
      cities: next.map((item) => item.value),
    });
  }

  function clearCities() {
    clearSelections(setCities);
    setCityQuery('');
    void fetchTherapists(0, { cities: [] });
  }

  function selectSpecialty(option: FacetOption) {
    const next = toggleSelection(specialties, option);
    setSpecialties(next);
    setSpecialtyQuery('');
    void fetchTherapists(0, {
      specialties: next.map((item) => item.value),
    });
  }

  function removeSpecialty(value: string) {
    const next = specialties.filter((item) => item.value !== value);
    setSpecialties(next);
    void fetchTherapists(0, {
      specialties: next.map((item) => item.value),
    });
  }

  function clearSpecialties() {
    clearSelections(setSpecialties);
    setSpecialtyQuery('');
    void fetchTherapists(0, { specialties: [] });
  }

  function selectApproach(option: FacetOption) {
    const next = toggleSelection(approaches, option);
    setApproaches(next);
    setApproachQuery('');
    void fetchTherapists(0, {
      approaches: next.map((item) => item.value),
    });
  }

  function removeApproach(value: string) {
    const next = approaches.filter((item) => item.value !== value);
    setApproaches(next);
    void fetchTherapists(0, {
      approaches: next.map((item) => item.value),
    });
  }

  function clearApproaches() {
    clearSelections(setApproaches);
    setApproachQuery('');
    void fetchTherapists(0, { approaches: [] });
  }

  function selectLanguage(option: FacetOption) {
    setLanguage(option.value);
    void fetchTherapists(0, {
      language: option.value,
    });
  }

  function clearLanguage() {
    setLanguage('');
    void fetchTherapists(0, {
      language: '',
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalProfiles = latestScrape?.active_count ?? total;

  return (
    <div className="app-shell table-layout">
      <section className="top-summary">
        <div className="top-summary-title">
          <h1>PsicoFinder</h1>
          <p className="hero-text">National therapist directory scrapped from Doctoralia.</p>
        </div>

        <div className="top-summary-stats">
          <div className="summary-stat">
            <span>Last scrape</span>
            <strong>
              {latestScrape?.latest_scraped_at
                ? new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(latestScrape.latest_scraped_at))
                : 'Pending'}
            </strong>
          </div>
          <div className="summary-stat">
            <span>Total profiles</span>
            <strong>{totalProfiles}</strong>
          </div>
        </div>
      </section>

      <div className="workspace">
        <aside className="filter-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filters</p>
              <h2>Refine results</h2>
            </div>
            <div className="panel-actions">
              <button className="ghost-button" type="button" onClick={resetFilters}>
                Reset
              </button>
            </div>
          </div>

          <form className="filter-form" onSubmit={handleSearch}>
            <label className="field field-select">
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="updated_desc">Recently updated</option>
                <option value="price_asc">Lowest price</option>
                <option value="price_desc">Highest price</option>
                <option value="name_asc">Name A-Z</option>
              </select>
            </label>

            <label className="field">
              <span>
                <Search size={16} />
                Search
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Anxiety, autism, TDAH..."
              />
            </label>

            <FacetSearchField
              title="City"
              icon={<MapPin size={16} />}
              query={cityQuery}
              selectedOptions={cities}
              options={cityOptions}
              loading={false}
              placeholder="Type a city..."
              emptyText="Type to search among the city facets."
              onQueryChange={setCityQuery}
              onToggle={selectCity}
              onRemove={removeCity}
              onClearAll={clearCities}
            />

            <FacetSearchField
              title="Specialty"
              icon={<Search size={16} />}
              query={specialtyQuery}
              selectedOptions={specialties}
              options={specialtyOptions}
              loading={false}
              placeholder="Type a specialty..."
              emptyText="Type to search among the specialty facets."
              onQueryChange={setSpecialtyQuery}
              onToggle={selectSpecialty}
              onRemove={removeSpecialty}
              onClearAll={clearSpecialties}
            />

            <FacetSearchField
              title="Approach"
              icon={<SlidersHorizontal size={16} />}
              query={approachQuery}
              selectedOptions={approaches}
              options={approachOptions}
              loading={false}
              placeholder="Type an approach..."
              emptyText="Type to search among the approach facets."
              onQueryChange={setApproachQuery}
              onToggle={selectApproach}
              onRemove={removeApproach}
              onClearAll={clearApproaches}
            />

            <section className="facet-group">
              <div className="facet-header">
                <span>
                  <Languages size={16} />
                  Language
                </span>
              </div>
              <div className="selected-facet-row">
                <button
                  className={`pill-filter ${language === '' ? 'pill-filter-active' : ''}`}
                  type="button"
                  onClick={clearLanguage}
                >
                  <span>All</span>
                  <small>{languageOptions.reduce((total, option) => total + option.count, 0)}</small>
                </button>
              </div>
              <div className="pill-grid">
                {languageOptions.length > 0 ? (
                  languageOptions.map((option) => {
                    const isActive = language === option.value;
                    return (
                      <button
                        key={option.value}
                        className={`pill-filter ${isActive ? 'pill-filter-active' : ''}`}
                        type="button"
                        onClick={() => selectLanguage(option)}
                      >
                        <span>{option.label}</span>
                        <small>{option.count}</small>
                      </button>
                    );
                  })
                ) : (
                  <p className="facet-empty">No language facets available yet.</p>
                )}
              </div>
            </section>

            <section className="price-range-group">
              <div className="facet-header">
                <span>Price range</span>
              </div>
              <div className="price-range-bar">
                <label className="price-range-end">
                  <span>Min</span>
                  <input
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                    inputMode="numeric"
                    placeholder="150"
                  />
                </label>

                <div className="price-range-divider" aria-hidden="true" />

                <label className="price-range-end">
                  <span>Max</span>
                  <input
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    inputMode="numeric"
                    placeholder="300"
                  />
                </label>
              </div>
            </section>

            <label className="toggle toggle-card">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(event) => setRemoteOnly(event.target.checked)}
              />
              <span>
                <Video size={16} />
                Online only
              </span>
            </label>

            <label className="toggle toggle-card">
              <input
                type="checkbox"
                checked={includeClinics}
                onChange={(event) => setIncludeClinics(event.target.checked)}
              />
              <span>
                <Building2 size={16} />
                Include clinics
              </span>
            </label>

            <button className="primary-button" type="submit" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              {loading ? 'Searching...' : 'Apply filters'}
            </button>
          </form>
        </aside>

        <main className="results-panel">
          <section className="results-header results-header-table">
            <div>
              <p className="eyebrow">Daily Doctoralia Import</p>
              <h2>Therapists</h2>
            </div>
            <div className="results-metrics">
              <div className="summary-stat summary-stat-compact">
                <span>Total matches</span>
                <strong>{total}</strong>
              </div>
              <p className="helper-text">
                {usingFallback
                  ? 'Showing sample entries until the FastAPI service is reachable.'
                  : `Showing page ${page + 1} of ${totalPages} from the daily imported database.`}
              </p>
            </div>
          </section>

          <section className="table-shell">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Specialties</th>
                  <th>Approach</th>
                  <th>Languages</th>
                  <th>Price</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((therapist) => {
                  const hasSourceUrl = therapist.profile_url.startsWith('http');

                  return (
                    <tr key={therapist.id}>
                      <td>
                        <div className="table-primary">
                          <strong>{therapist.full_name}</strong>
                          <span>{therapist.headline ?? 'Profile enrichment in progress.'}</span>
                          {therapist.is_clinic ? (
                            <span className="badge badge-clinic table-badge-inline">
                              <Building2 size={14} />
                              Clinic
                            </span>
                          ) : null}
                          <button
                            className="table-link specialty-trigger"
                            type="button"
                            onClick={() => setSpecialtyModalTherapist(therapist)}
                          >
                            View full profile
                          </button>
                        </div>
                      </td>
                      <td>{[therapist.city, therapist.state].filter(Boolean).join(', ') || 'Pending'}</td>
                      <td>
                        <div className="specialty-cell">
                          <span className="specialty-preview">
                            {therapist.specialties.slice(0, 3).join(', ') || 'Pending'}
                            {therapist.specialties.length > 3 ? '...' : ''}
                          </span>
                          {therapist.specialties.length > 3 ? (
                            <button
                              className="table-link specialty-trigger"
                              type="button"
                              onClick={() => setSpecialtyModalTherapist(therapist)}
                            >
                              Open profile
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="specialty-cell">
                          <span className="specialty-preview">
                            {therapist.approaches.slice(0, 3).join(', ') || 'Pending'}
                            {therapist.approaches.length > 3 ? '...' : ''}
                          </span>
                          {therapist.approaches.length > 3 ? (
                            <button
                              className="table-link specialty-trigger"
                              type="button"
                              onClick={() => setSpecialtyModalTherapist(therapist)}
                            >
                              Open profile
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td>{therapist.languages.join(', ') || 'Pending'}</td>
                      <td>
                        {therapist.price_min
                          ? `R$ ${therapist.price_min}${therapist.price_max ? `-${therapist.price_max}` : ''}`
                          : 'Pending'}
                      </td>
                      <td>
                        {hasSourceUrl ? (
                          <a
                            className="table-link"
                            href={therapist.profile_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View source
                          </a>
                        ) : (
                          <span className="table-link table-link-disabled">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="pagination-bar">
            <button
              className="secondary-button"
              type="button"
              disabled={loading || page === 0 || usingFallback}
              onClick={() => void fetchTherapists(page - 1)}
            >
              Previous
            </button>
            <span className="page-indicator">
              Page {page + 1} of {totalPages}
            </span>
            <button
              className="secondary-button"
              type="button"
              disabled={loading || usingFallback || page + 1 >= totalPages}
              onClick={() => void fetchTherapists(page + 1)}
            >
              Next
            </button>
          </section>
        </main>
      </div>

      {specialtyModalTherapist ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSpecialtyModalTherapist(null)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="specialty-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Full profile</p>
                <h3 id="specialty-modal-title">{specialtyModalTherapist.full_name}</h3>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSpecialtyModalTherapist(null)}
              >
                Close
              </button>
            </div>
            <section className="modal-profile-grid">
              <div className="modal-profile-block">
                <span className="selected-facet-label">Overview</span>
                <p className="modal-text">
                  {specialtyModalTherapist.headline ?? 'Profile enrichment in progress.'}
                </p>
                <p className="modal-text">
                  {specialtyModalTherapist.bio ?? 'No biography has been scraped yet for this profile.'}
                </p>
              </div>

              <div className="modal-profile-block">
                <span className="selected-facet-label">Details</span>
                <div className="modal-detail-grid">
                  <div className="modal-detail-item">
                    <strong>Location</strong>
                    <span>
                      {[specialtyModalTherapist.city, specialtyModalTherapist.state]
                        .filter(Boolean)
                        .join(', ') || 'Pending'}
                    </span>
                  </div>
                  <div className="modal-detail-item">
                    <strong>Price</strong>
                    <span>
                      {specialtyModalTherapist.price_min
                        ? `R$ ${specialtyModalTherapist.price_min}${
                            specialtyModalTherapist.price_max ? `-${specialtyModalTherapist.price_max}` : ''
                          }`
                        : 'Pending'}
                    </span>
                  </div>
                  <div className="modal-detail-item">
                    <strong>Website</strong>
                    <span>
                      {specialtyModalTherapist.profile_url ? (
                        <a
                          className="modal-action-button"
                          href={specialtyModalTherapist.profile_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source profile
                        </a>
                      ) : (
                        'Unavailable'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-profile-block">
                <span className="selected-facet-label">Specialties</span>
                <div className="modal-pill-grid">
                  {specialtyModalTherapist.specialties.length > 0 ? (
                    specialtyModalTherapist.specialties.map((specialtyItem) => (
                      <span key={specialtyItem} className="modal-pill">
                        {specialtyItem}
                      </span>
                    ))
                  ) : (
                    <p className="facet-empty">No specialties available for this profile.</p>
                  )}
                </div>
              </div>

              <div className="modal-profile-block">
                <span className="selected-facet-label">Approaches</span>
                <div className="modal-pill-grid">
                  {specialtyModalTherapist.approaches.length > 0 ? (
                    specialtyModalTherapist.approaches.map((approachItem) => (
                      <span key={approachItem} className="modal-pill">
                        {approachItem}
                      </span>
                    ))
                  ) : (
                    <p className="facet-empty">No approaches available for this profile.</p>
                  )}
                </div>
              </div>

              <div className="modal-profile-block">
                <span className="selected-facet-label">Languages</span>
                <div className="modal-pill-grid">
                  {specialtyModalTherapist.languages.length > 0 ? (
                    specialtyModalTherapist.languages.map((languageItem) => (
                      <span key={languageItem} className="modal-pill">
                        {languageItem}
                      </span>
                    ))
                  ) : (
                    <p className="facet-empty">No languages available for this profile.</p>
                  )}
                </div>
              </div>

              <div className="modal-profile-block">
                <span className="selected-facet-label">Freshness</span>
                <p className="modal-text">
                  Updated {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(specialtyModalTherapist.updated_at))}
                </p>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
