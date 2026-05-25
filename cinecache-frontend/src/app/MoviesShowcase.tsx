"use client";

import React, { useState, useEffect } from 'react';

interface Movie {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  tagline: string;
  release_date: string;
  status: string;
  runtime?: number;
  popularity: number;
  vote_average: number;
  vote_count: number;
  budget: number;
  revenue: number;
  adult: boolean;
  video: boolean;
  homepage: string;
  poster_path: string;
  imdb_id: string;
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path?: string;
    backdrop_path?: string;
  };
  director?: {
    id: number;
    name: string;
  };
  genres?: Array<{
    id: number;
    name: string;
  }>;
}

interface Genre {
  id: number;
  name: string;
}

interface CastMember {
  order: number;
  name: string;
}

interface ActorInfo {
  id: number;
  name: string;
}

export default function MoviesShowcase({ initialGenres }: { initialGenres: Genre[] }) {
  // UI & Data States
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>(initialGenres); // Initialize with server pre-fetched genres!
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [movieCast, setMovieCast] = useState<CastMember[]>([]);
  
  // Status States
  const [loading, setLoading] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState<string>(''); // Title text search
  const [searchYear, setSearchYear] = useState<string>('');   // Release year search
  const [selectedGenre, setSelectedGenre] = useState<string>(''); // Selected genre filter
  
  // Actor Autocomplete States
  const [actorSearchInput, setActorSearchInput] = useState<string>('');
  const [actorSuggestions, setActorSuggestions] = useState<ActorInfo[]>([]);
  const [selectedActor, setSelectedActor] = useState<ActorInfo | null>(null);
  
  // Rating State
  const [ratingValue, setRatingValue] = useState<number>(7.0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchGenres = async () => {
    try {
      const res = await fetch('/api/movies-api/api/genres');
      if (res.ok) {
        const data = await res.json();
        setGenres(data || []);
      }
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  // Handle actor autocomplete input typing changes
  const handleActorInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setActorSearchInput(val);
    setSelectedActor(null); // Clear selected actor if typing changes

    if (val.trim().length >= 2) {
      try {
        const res = await fetch(`/api/movies-api/api/actors/search?q=${encodeURIComponent(val.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setActorSuggestions(data || []);
        }
      } catch (error) {
        console.error('Error searching actors:', error);
      }
    } else {
      setActorSuggestions([]);
    }
  };

  // Select actor from autocomplete suggestion list
  const handleSelectActor = (actor: ActorInfo) => {
    setSelectedActor(actor);
    setActorSearchInput(actor.name);
    setActorSuggestions([]);
    // Clear other filters for simplicity
    setSelectedGenre('');
  };

  // Perform search from backend APIs (Year, Genre, Actor, or combination)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSelectedMovie(null);
    setMovieCast([]);

    const yearQuery = searchYear.trim();

    try {
      let res;
      let moviesList: Movie[] = [];

      if (selectedActor) {
        // Case A: Actor filter active
        res = await fetch(`/api/movies-api/api/actors/${selectedActor.id}`);
        if (res.ok) {
          const data = await res.json();
          const actorMovies = data.movies || [];
          
          // If year filter is also active, filter actor's movies locally
          if (yearQuery !== '') {
            moviesList = actorMovies.filter((m: any) => m.release_date && m.release_date.startsWith(yearQuery));
          } else {
            moviesList = actorMovies;
          }
        }
      } else if (selectedGenre !== '' && yearQuery !== '') {
        // Case B: Both Genre and Year are selected.
        res = await fetch(`/api/movies-api/api/genres/${encodeURIComponent(selectedGenre)}/movies`);
        if (res.ok) {
          const data = await res.json();
          const genreMovies = Array.isArray(data) ? data : (data.movies || []);
          moviesList = genreMovies.filter((m: Movie) => m.release_date && m.release_date.startsWith(yearQuery));
        }
      } else if (yearQuery !== '') {
        // Case C: Only Year is entered.
        res = await fetch(`/api/movies-api/api/movies/query/year/${encodeURIComponent(yearQuery)}`);
        if (res.ok) {
          const data = await res.json();
          moviesList = Array.isArray(data) ? data : (data.movies || []);
        }
      } else if (selectedGenre !== '') {
        // Case D: Only Genre is selected.
        res = await fetch(`/api/movies-api/api/genres/${encodeURIComponent(selectedGenre)}/movies`);
        if (res.ok) {
          const data = await res.json();
          moviesList = Array.isArray(data) ? data : (data.movies || []);
        }
      } else {
        // Case E: All filters empty
        showToast('Please select a filter or enter a search query', 'error');
        setLoading(false);
        return;
      }

      setMovies(moviesList);
      
      if (moviesList.length === 0) {
        showToast('No movies found matching your filters', 'error');
      }
    } catch (error) {
      console.error('Search error:', error);
      showToast('Failed to perform search', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load Movie Details dynamically
  const selectMovie = async (movie: Movie) => {
    setDetailLoading(true);
    setSelectedMovie(null);
    setMovieCast([]);
    
    try {
      const res = await fetch(`/api/movies-api/api/movies/${movie.id}`);
      if (res.ok) {
        const detailed = await res.json();
        setSelectedMovie(detailed);
      } else {
        setSelectedMovie(movie);
        showToast('Failed to load movie details', 'error');
      }

      const castRes = await fetch(`/api/movies-api/api/movies/${movie.id}/cast`);
      if (castRes.ok) {
        const castData = await castRes.json();
        setMovieCast(castData || []);
      }
    } catch (error) {
      setSelectedMovie(movie);
      console.error('Error loading details/cast:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle submitting user rating
  const handleRateSubmit = async () => {
    if (!selectedMovie) return;
    setSubmittingRating(true);

    try {
      const res = await fetch(`/api/movies-api/api/movies/${selectedMovie.id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 99, // Simulated authenticated User ID
          rating: ratingValue,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        showToast(`Rating of ${ratingValue} submitted successfully!`, 'success');

        // Dynamically update locally cached rating value for UI feel from server source of truth
        setSelectedMovie(prev => {
          if (!prev) return null;
          return {
            ...prev,
            vote_average: result.vote_average,
            vote_count: result.vote_count
          };
        });

        // Update the catalog movie item in the list
        setMovies(prevMovies => 
          prevMovies.map(m => m.id === selectedMovie.id ? { ...m, vote_average: result.vote_average, vote_count: result.vote_count } : m)
        );
      } else {
        const errInfo = await res.json();
        showToast(errInfo.error || 'Failed to submit rating', 'error');
      }
    } catch (error) {
      showToast('Network error while rating', 'error');
    } finally {
      setSubmittingRating(false);
    }
  };

  // Reset search criteria to return to initial empty list state
  const handleReset = () => {
    setSearchQuery('');
    setSearchYear('');
    setSelectedGenre('');
    setSelectedActor(null);
    setActorSearchInput('');
    setActorSuggestions([]);
    setMovies([]); // Show empty list
    setSelectedMovie(null);
    setMovieCast([]);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Filter movies locally by text query
  const filteredMovies = movies.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.original_title && m.original_title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Helper formatting
  const formatCurrency = (value: number) => {
    if (value === 0) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo">
          Cine<span>Cache</span>
          <div className="badge">Memorystore Active</div>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Go Backend Serverless Demo
        </div>
      </header>

      {/* Hero Search Section */}
      <section className="search-section">
        <h1 className="search-title">Discover Your Next Cinematic Masterpiece</h1>
        <p className="search-subtitle">
          Search by year, filter by genre, or type to select an actor. Backed by Google Cloud Run & high-speed Memorystore caching.
        </p>

        <form className="search-form" onSubmit={handleSearchSubmit}>
          {/* Select Genre */}
          <select
            value={selectedGenre}
            onChange={(e) => {
              setSelectedGenre(e.target.value);
              setSelectedActor(null);
              setActorSearchInput('');
            }}
            onFocus={() => {
              if (genres.length === 0) fetchGenres();
            }}
            className="search-input"
            style={{ maxWidth: '250px', paddingLeft: '1rem', cursor: 'pointer' }}
          >
            <option value="">All Genres</option>
            {genres.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {/* Actor Autocomplete Type-ahead Filter */}
          <div className="search-input-wrapper" style={{ position: 'relative', maxWidth: '320px' }}>
            <input
              type="text"
              placeholder="Search by actor name..."
              value={actorSearchInput}
              onChange={handleActorInputChange}
              className="search-input"
              style={{ paddingLeft: '1rem' }}
            />
            {actorSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '105%',
                left: 0,
                width: '100%',
                background: 'rgba(15, 15, 25, 0.95)',
                backdropFilter: 'var(--glass-blur)',
                border: '1px solid var(--card-border)',
                borderRadius: '12px',
                zIndex: 100,
                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {actorSuggestions.map(actor => (
                  <div
                    key={actor.id}
                    onClick={() => handleSelectActor(actor)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      fontSize: '0.9rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {actor.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search Year Input */}
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <svg className="search-icon" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="number"
              placeholder="Enter release year (e.g. 2012, 1999)"
              value={searchYear}
              onChange={(e) => {
                setSearchYear(e.target.value);
              }}
              className="search-input"
              min="1800"
              max="2100"
            />
          </div>

          <button type="submit" className="search-button">
            Search
          </button>

          {(searchYear || selectedGenre || searchQuery || selectedActor || actorSearchInput) && (
            <button
              type="button"
              onClick={handleReset}
              className="search-button"
              style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'none', color: 'var(--text-primary)' }}
            >
              Reset
            </button>
          )}
        </form>
      </section>

      {/* Main Content Panel */}
      <div className="main-content" style={{ display: 'block' }}>
        {toast && !selectedMovie && (
          <div className={`toast toast-${toast.type}`} style={{ marginBottom: '1.5rem' }}>
            {toast.type === 'success' ? '✓ ' : '✗ '}
            {toast.message}
          </div>
        )}

        {!selectedMovie ? (
          /* Panel A: Movie Catalogue Results List (Full Width) */
          <div className="results-container" style={{ width: '100%', animation: 'fadeIn 0.25s ease' }}>
            <div className="section-header">
              <h2 className="section-title">
                {selectedActor ? `Movies featuring ${selectedActor.name}` : searchYear ? `Movies from ${searchYear}` : selectedGenre ? 'Genre Catalog' : 'Browse Movies'}
                <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                  ({filteredMovies.length} matches)
                </span>
              </h2>

              {/* Quick Local Search Filter */}
              <input
                type="text"
                placeholder="Quick title filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ maxWidth: '220px', padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.9rem' }}
              />
            </div>

            {loading ? (
              <div className="movie-list">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="movie-card skeleton" style={{ height: '320px' }} />
                ))}
              </div>
            ) : movies.length === 0 ? (
              <div className="detail-placeholder" style={{ gridColumn: '1/-1', padding: '4rem 2rem' }}>
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c.132 0 .263 0 .393.007a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
                </svg>
                <h3>No filters active</h3>
                <p style={{ fontSize: '0.9rem' }}>Enter a release year, select a genre, or search by actor name above to query the Memorystore movie catalog.</p>
              </div>
            ) : filteredMovies.length === 0 ? (
              <div className="detail-placeholder" style={{ gridColumn: '1/-1', padding: '4rem 2rem' }}>
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                </svg>
                <h3>No matching movies found</h3>
                <p style={{ fontSize: '0.9rem' }}>Try checking for a different year, selecting another genre, or resetting filters.</p>
              </div>
            ) : (
              <div className="movie-list">
                {filteredMovies.map((movie) => (
                  <div
                    key={movie.id}
                    className="movie-card"
                    onClick={() => selectMovie(movie)}
                  >
                    <div className="movie-poster-placeholder" style={{ padding: 0, overflow: 'hidden' }}>
                      {movie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/original${movie.poster_path}`}
                          alt={movie.title}
                          className="movie-card-poster"
                        />
                      ) : (
                        <>
                          <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                          </svg>
                          <div style={{ fontWeight: 'bold', fontSize: '0.9rem', padding: '0 0.5rem', textAlign: 'center' }}>{movie.title}</div>
                        </>
                      )}
                      <div className="rating-badge">
                        ★ {movie.vote_average ? movie.vote_average.toFixed(1) : '0.0'}
                      </div>
                    </div>
                    <div className="movie-card-body">
                      <div className="movie-card-title">{movie.title}</div>
                      <div className="movie-card-meta">
                        <span>Lang: {movie.original_language.toUpperCase()}</span>
                        <span>Votes: {movie.vote_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Panel B: Movie Detail Screen (Full Width) */
          <aside className="detail-panel" style={{ width: '100%', position: 'relative', top: 0, animation: 'fadeIn 0.25s ease' }}>
            {toast && (
              <div className={`toast toast-${toast.type}`} style={{ marginBottom: '1rem' }}>
                {toast.type === 'success' ? '✓ ' : '✗ '}
                {toast.message}
              </div>
            )}

            {detailLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem 0' }}>
                <div className="skeleton" style={{ height: '40px', width: '200px', marginBottom: '1rem' }} />
                <div className="skeleton" style={{ height: '250px', width: '100%' }} />
                <div className="skeleton" style={{ height: '35px', width: '80%', marginTop: '1.5rem' }} />
                <div className="skeleton" style={{ height: '80px', width: '100%' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Back to search results button */}
                <button
                  onClick={() => setSelectedMovie(null)}
                  className="rating-btn"
                  style={{
                    alignSelf: 'flex-start',
                    width: 'auto',
                    padding: '0.6rem 1.25rem',
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid var(--card-border)',
                    boxShadow: 'none',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.95rem'
                  }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to search result
                </button>

                {selectedMovie.poster_path && (
                  <div className="detail-poster-wrapper" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--card-border)', aspectRatio: '21/9', background: '#000' }}>
                    <img
                      src={`https://image.tmdb.org/t/p/original${selectedMovie.poster_path}`}
                      alt={selectedMovie.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
                    />
                  </div>
                )}

                <div className="detail-header">
                  <h2 className="detail-title" style={{ fontSize: '2.5rem' }}>{selectedMovie.title}</h2>
                  {selectedMovie.tagline && (
                    <p className="detail-tagline">"{selectedMovie.tagline}"</p>
                  )}
                </div>

                <div className="detail-meta-grid">
                  <div className="meta-item">
                    <span className="meta-label">Release Date</span>
                    <span className="meta-value">{selectedMovie.release_date || 'N/A'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Runtime</span>
                    <span className="meta-value">{selectedMovie.runtime ? `${selectedMovie.runtime} mins` : 'N/A'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Budget</span>
                    <span className="meta-value">{formatCurrency(selectedMovie.budget)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Revenue</span>
                    <span className="meta-value">{formatCurrency(selectedMovie.revenue)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Vote Average</span>
                    <span className="meta-value">★ {selectedMovie.vote_average ? selectedMovie.vote_average.toFixed(1) : '0.0'} / 10</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Vote Count</span>
                    <span className="meta-value">{selectedMovie.vote_count}</span>
                  </div>
                </div>

                {/* Director Metadata */}
                {selectedMovie.director && (
                  <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                    <span className="meta-label">Director</span>
                    <div style={{ fontWeight: '700', fontSize: '1.25rem', color: '#a5b4fc', marginTop: '0.25rem' }}>
                      {selectedMovie.director.name}
                    </div>
                  </div>
                )}

                {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                  <div className="detail-genres">
                    {selectedMovie.genres.map(g => (
                      <span key={g.id} className="genre-tag">{g.name}</span>
                    ))}
                  </div>
                )}

                <div className="detail-overview">
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>Overview</h3>
                  <p style={{ fontSize: '1.05rem' }}>{selectedMovie.overview || 'No plot overview available.'}</p>
                </div>

                {selectedMovie.belongs_to_collection && (
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                    <span className="meta-label">Collection</span>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                      {selectedMovie.belongs_to_collection.name}
                    </div>
                  </div>
                )}

                {/* Top Billing Cast Ordered via ZRANGE */}
                {movieCast && movieCast.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>Top Billing Cast</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                      {movieCast.map((actor, idx) => (
                        <div key={idx} style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>{actor.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Billing #{actor.order + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit Rating Interaction */}
                <div className="rating-section" style={{ marginTop: '1rem' }}>
                  <div className="rating-title">
                    <span>Share Your Rating</span>
                    <span className="rating-value-display">★ {ratingValue.toFixed(1)}</span>
                  </div>
                  <div className="rating-slider-container">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.1"
                      value={ratingValue}
                      onChange={(e) => setRatingValue(parseFloat(e.target.value))}
                      className="rating-slider"
                    />
                  </div>
                  <button
                    onClick={handleRateSubmit}
                    disabled={submittingRating}
                    className="rating-btn"
                  >
                    {submittingRating ? 'Submitting...' : 'Submit Rating'}
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
