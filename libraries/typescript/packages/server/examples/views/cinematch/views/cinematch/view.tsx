import { useMemo, useState } from "react";
import {
  ThemeProvider,
  useCallTool,
  useToolContext,
  useViewTheme,
  ViewControls,
} from "mcp-use/react";

import "./view.css";

interface Movie {
  id: string;
  title: string;
  year: number;
  genre: string;
  mood: string;
  runtimeMinutes: number;
  rating: number;
  director: string;
  cast: string[];
  synopsis: string;
  streamingPlatforms: string[];
  showtimes: string[];
  tagline: string;
  posterGradient: [string, string];
}

const FALLBACK_MOVIES: Movie[] = [
  {
    id: "arrival",
    title: "Arrival",
    year: 2016,
    genre: "Sci-Fi",
    mood: "Mind-Bending",
    runtimeMinutes: 116,
    rating: 7.9,
    director: "Denis Villeneuve",
    cast: ["Amy Adams", "Jeremy Renner", "Forest Whitaker"],
    synopsis: "A linguist is recruited by the military to communicate with alien lifeforms.",
    streamingPlatforms: ["Paramount+", "Prime Video"],
    showtimes: ["19:15", "21:40"],
    tagline: "Why are they here?",
    posterGradient: ["#1a2a6c", "#b21f1f"],
  },
  {
    id: "inception",
    title: "Inception",
    year: 2010,
    genre: "Sci-Fi",
    mood: "Mind-Bending",
    runtimeMinutes: 148,
    rating: 8.8,
    director: "Christopher Nolan",
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt"],
    synopsis: "A thief steals secrets through dream-sharing technology.",
    streamingPlatforms: ["Max", "Netflix"],
    showtimes: ["18:30", "21:30"],
    tagline: "Your mind is the scene of the crime.",
    posterGradient: ["#0f2027", "#203a43"],
  },
  {
    id: "spider-verse",
    title: "Spider-Man: Into the Spider-Verse",
    year: 2018,
    genre: "Animation",
    mood: "Adrenaline",
    runtimeMinutes: 117,
    rating: 8.4,
    director: "Bob Persichetti",
    cast: ["Shameik Moore", "Jake Johnson"],
    synopsis: "Miles Morales becomes the new Spider-Man across parallel dimensions.",
    streamingPlatforms: ["Netflix"],
    showtimes: ["17:45", "20:15"],
    tagline: "More than one wears the mask.",
    posterGradient: ["#8e2de2", "#4a00e0"],
  },
  {
    id: "grand-budapest",
    title: "The Grand Budapest Hotel",
    year: 2014,
    genre: "Comedy",
    mood: "Feel-Good",
    runtimeMinutes: 99,
    rating: 8.1,
    director: "Wes Anderson",
    cast: ["Ralph Fiennes", "Tony Revolori"],
    synopsis: "A writer encounters the owner of an aging high-class hotel.",
    streamingPlatforms: ["Hulu", "Disney+"],
    showtimes: ["18:00", "20:30"],
    tagline: "A luxurious caper of friendship.",
    posterGradient: ["#f12711", "#f5af19"],
  },
];

const GENRES = ["All", "Sci-Fi", "Comedy", "Animation", "Drama", "Mystery", "Thriller", "Horror"];
const MOODS = ["All", "Mind-Bending", "Feel-Good", "Adrenaline", "Intense", "Whimsical"];
const DURATIONS = [
  { label: "Any", max: 0 },
  { label: "< 100m", max: 100 },
  { label: "< 120m", max: 120 },
  { label: "< 150m", max: 150 },
];

function CineMatchContent() {
  const context = useToolContext<"discover_movies">();
  const theme = useViewTheme();

  // Load movies from tool context output or fallback
  const moviesData: Movie[] = useMemo(() => {
    if (context.status === "ready" && context.toolOutput?.movies) {
      return context.toolOutput.movies as Movie[];
    }
    return FALLBACK_MOVIES;
  }, [context]);

  // Initial watchlist
  const initialWatchlistIds = useMemo(() => {
    if (context.status === "ready" && context.toolOutput?.userWatchlistIds) {
      return context.toolOutput.userWatchlistIds;
    }
    return [];
  }, [context]);

  const [activeTab, setActiveTab] = useState<"catalog" | "watchlist">("catalog");
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [selectedMood, setSelectedMood] = useState<string>("All");
  const [selectedMaxRuntime, setSelectedMaxRuntime] = useState<number>(0);
  const [watchlistIds, setWatchlistIds] = useState<string[]>(initialWatchlistIds);
  const [expandedMovieId, setExpandedMovieId] = useState<string | null>(null);

  // CallTool to persist watchlist back to server
  const manageWatchlistCall = useCallTool("manage_watchlist");

  const toggleWatchlist = (movie: Movie) => {
    const isSaved = watchlistIds.includes(movie.id);
    const updated = isSaved
      ? watchlistIds.filter((id) => id !== movie.id)
      : [...watchlistIds, movie.id];

    setWatchlistIds(updated);

    try {
      void manageWatchlistCall.callTool({
        movieId: movie.id,
        action: isSaved ? "remove" : "add",
      });
    } catch {
      // Ignored if offline/preview
    }
  };

  // Filter movies
  const displayedMovies = useMemo(() => {
    let list = moviesData;

    if (activeTab === "watchlist") {
      list = list.filter((m) => watchlistIds.includes(m.id));
    }

    return list.filter((m) => {
      if (selectedGenre !== "All" && m.genre.toLowerCase() !== selectedGenre.toLowerCase()) {
        return false;
      }
      if (selectedMood !== "All" && m.mood.toLowerCase() !== selectedMood.toLowerCase()) {
        return false;
      }
      if (selectedMaxRuntime > 0 && m.runtimeMinutes > selectedMaxRuntime) {
        return false;
      }
      return true;
    });
  }, [moviesData, activeTab, watchlistIds, selectedGenre, selectedMood, selectedMaxRuntime]);

  return (
    <div className={`cinematch-root ${theme === "light" ? "cm-light" : "cm-dark"}`}>
      {/* Header */}
      <header className="cm-header">
        <div className="cm-title-group">
          <h1>🎬 CineMatch</h1>
          <p className="cm-tagline">Movie night recommendations & personalized watchlist</p>
        </div>
        <nav className="cm-nav-tabs">
          <button
            type="button"
            className={`cm-tab-btn ${activeTab === "catalog" ? "active" : ""}`}
            onClick={() => setActiveTab("catalog")}
          >
            Catalog ({moviesData.length})
          </button>
          <button
            type="button"
            className={`cm-tab-btn ${activeTab === "watchlist" ? "active" : ""}`}
            onClick={() => setActiveTab("watchlist")}
          >
            ❤️ Watchlist ({watchlistIds.length})
          </button>
        </nav>
      </header>

      {/* Filter Rail */}
      <section className="cm-filters" aria-label="Filters">
        <div className="cm-filter-row">
          <span className="cm-filter-label">Genre:</span>
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              className={`cm-pill ${selectedGenre === g ? "selected" : ""}`}
              onClick={() => setSelectedGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="cm-filter-row">
          <span className="cm-filter-label">Mood:</span>
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              className={`cm-pill ${selectedMood === m ? "selected" : ""}`}
              onClick={() => setSelectedMood(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="cm-filter-row">
          <span className="cm-filter-label">Duration:</span>
          {DURATIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              className={`cm-pill ${selectedMaxRuntime === d.max ? "selected" : ""}`}
              onClick={() => setSelectedMaxRuntime(d.max)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      {/* Movie Cards Grid */}
      {displayedMovies.length === 0 ? (
        <div className="cm-empty">
          <h4>No movies found</h4>
          <p>
            {activeTab === "watchlist"
              ? "Your watchlist is currently empty. Explore the catalog and click '+ Watchlist' to save movies."
              : "No movies matched your filter combination. Try selecting 'All' or a longer duration."}
          </p>
        </div>
      ) : (
        <ul className="cm-movie-grid">
          {displayedMovies.map((movie) => {
            const isSaved = watchlistIds.includes(movie.id);
            const isExpanded = expandedMovieId === movie.id;
            const gradientStyle = {
              background: `linear-gradient(135deg, ${movie.posterGradient[0]} 0%, ${movie.posterGradient[1]} 100%)`,
            };

            return (
              <li key={movie.id} className="cm-movie-card">
                <div className="cm-card-art" style={gradientStyle}>
                  <div className="cm-art-top">
                    <span className="cm-rating-badge">★ {movie.rating.toFixed(1)}</span>
                    <span className="cm-runtime-badge">⏱ {movie.runtimeMinutes}m</span>
                  </div>
                  <div className="cm-art-bottom">
                    <h3>{movie.title}</h3>
                  </div>
                </div>

                <div className="cm-card-body">
                  <div className="cm-tags">
                    <span className="cm-tag">{movie.year}</span>
                    <span className="cm-tag">{movie.genre}</span>
                    <span className="cm-tag mood">{movie.mood}</span>
                  </div>

                  <p className="cm-synopsis">{movie.synopsis}</p>

                  {isExpanded && (
                    <div style={{ fontSize: "0.75rem", color: "var(--cm-text-secondary)", marginTop: "0.5rem" }}>
                      <div><strong>Cast:</strong> {movie.cast.join(", ")}</div>
                      <div><strong>Streaming:</strong> {movie.streamingPlatforms.join(", ")}</div>
                      <div><strong>Showtimes:</strong> {movie.showtimes.join(", ")}</div>
                    </div>
                  )}

                  <div className="cm-card-footer">
                    <span
                      className="cm-director"
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => setExpandedMovieId(isExpanded ? null : movie.id)}
                    >
                      {isExpanded ? "Hide details" : "More details"}
                    </span>
                    <button
                      type="button"
                      className={`cm-watchlist-btn ${isSaved ? "saved" : ""}`}
                      onClick={() => toggleWatchlist(movie)}
                    >
                      {isSaved ? "❤️ Saved" : "+ Watchlist"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function CineMatchView() {
  return (
    <ThemeProvider>
      <ViewControls debugger>
        <CineMatchContent />
      </ViewControls>
    </ThemeProvider>
  );
}
