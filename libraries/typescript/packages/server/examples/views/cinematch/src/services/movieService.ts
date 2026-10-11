import movieData from "../data/movies.json" with { type: "json" };

export interface Movie {
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

const catalog: Movie[] = movieData as Movie[];

// In-memory user watchlist store keyed by user subject (e.g. ChatGPT openai/subject)
const userWatchlists = new Map<string, Set<string>>();

export interface MovieSearchParams {
  query?: string | undefined;
  genre?: string | undefined;
  mood?: string | undefined;
  maxRuntimeMinutes?: number | undefined;
}

export function searchMovies(params: MovieSearchParams): Movie[] {
  return catalog.filter((movie) => {
    if (params.genre && params.genre.toLowerCase() !== "all") {
      if (movie.genre.toLowerCase() !== params.genre.toLowerCase()) {
        return false;
      }
    }

    if (params.mood && params.mood.toLowerCase() !== "all") {
      if (movie.mood.toLowerCase() !== params.mood.toLowerCase()) {
        return false;
      }
    }

    if (params.maxRuntimeMinutes && params.maxRuntimeMinutes > 0) {
      if (movie.runtimeMinutes > params.maxRuntimeMinutes) {
        return false;
      }
    }

    if (params.query) {
      const q = params.query.toLowerCase().trim();
      const matchesTitle = movie.title.toLowerCase().includes(q);
      const matchesDirector = movie.director.toLowerCase().includes(q);
      const matchesSynopsis = movie.synopsis.toLowerCase().includes(q);
      const matchesCast = movie.cast.some((c) => c.toLowerCase().includes(q));
      if (!matchesTitle && !matchesDirector && !matchesSynopsis && !matchesCast) {
        return false;
      }
    }

    return true;
  });
}

export function getMovieById(id: string): Movie | undefined {
  const normalized = id.toLowerCase().trim();
  return catalog.find(
    (m) =>
      m.id.toLowerCase() === normalized ||
      m.title.toLowerCase() === normalized
  );
}

export function getUserWatchlist(userId: string): Movie[] {
  const ids = userWatchlists.get(userId) ?? new Set<string>();
  return catalog.filter((m) => ids.has(m.id));
}

export function addToWatchlist(userId: string, movieId: string): { success: boolean; watchlist: Movie[] } {
  let list = userWatchlists.get(userId);
  if (!list) {
    list = new Set<string>();
    userWatchlists.set(userId, list);
  }
  const movie = getMovieById(movieId);
  if (movie) {
    list.add(movie.id);
  }
  return { success: true, watchlist: getUserWatchlist(userId) };
}

export function removeFromWatchlist(userId: string, movieId: string): { success: boolean; watchlist: Movie[] } {
  const list = userWatchlists.get(userId);
  if (list) {
    const movie = getMovieById(movieId);
    if (movie) {
      list.delete(movie.id);
    }
  }
  return { success: true, watchlist: getUserWatchlist(userId) };
}

export function getAllMovies(): Movie[] {
  return [...catalog];
}
