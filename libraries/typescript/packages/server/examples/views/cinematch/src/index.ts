/**
 * CineMatch — Reference MCP Server using mcp-use framework.
 *
 * Demonstrates:
 * 1. mcp-use MCPServer instantiation & tool registration with Zod schemas.
 * 2. ChatGPT client context extraction (openai/subject, openai/session, openai/locale) and logging.
 * 3. Mocked local JSON data with in-memory filtering and watchlist state.
 * 4. Interactive MCP Apps widget view (views/cinematch).
 */
import { MCPServer } from "mcp-use";
import { z } from "zod";

import {
  addToWatchlist,
  getAllMovies,
  getMovieById,
  getUserWatchlist,
  removeFromWatchlist,
  searchMovies,
} from "./services/movieService.js";
import { extractAndLogClientContext } from "./utils/clientContext.js";

const server = new MCPServer({
  name: "cinematch-mcp",
  version: "1.0.0",
  description: "CineMatch — Movie night planner, recommendation widget and personalized watchlist",
});

const movieSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number(),
  genre: z.string(),
  mood: z.string(),
  runtimeMinutes: z.number(),
  rating: z.number(),
  director: z.string(),
  cast: z.array(z.string()),
  synopsis: z.string(),
  streamingPlatforms: z.array(z.string()),
  showtimes: z.array(z.string()),
  tagline: z.string(),
  posterGradient: z.tuple([z.string(), z.string()]),
});

export const discoverMovies = server.tool(
  {
    name: "discover_movies",
    title: "Discover Movies",
    description:
      "Find movies based on genre, mood, maximum runtime, or keyword. Opens the interactive CineMatch planner view.",
    inputSchema: z.object({
      genre: z
        .string()
        .optional()
        .describe("Genre filter (e.g. 'Sci-Fi', 'Comedy', 'Animation', 'Drama', 'Thriller', 'Horror')"),
      mood: z
        .string()
        .optional()
        .describe("Mood filter (e.g. 'Mind-Bending', 'Feel-Good', 'Adrenaline', 'Intense', 'Whimsical')"),
      maxRuntimeMinutes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum movie duration in minutes (e.g. 120 for movies under 2 hours)"),
      query: z
        .string()
        .optional()
        .describe("Free-text query matching title, director, cast, or synopsis"),
    }),
    outputSchema: z.object({
      movies: z.array(movieSchema),
      matchedCount: z.number(),
      totalCatalogCount: z.number(),
      appliedFilters: z.object({
        genre: z.string().optional(),
        mood: z.string().optional(),
        maxRuntimeMinutes: z.number().optional(),
        query: z.string().optional(),
      }),
      userWatchlistIds: z.array(z.string()),
    }),
    view: {
      name: "cinematch",
      description: "Interactive CineMatch movie carousel, filter rail and watchlist planner",
      prefersBorder: true,
    },
  },
  async (params, ctx) => {
    const { subject, sessionId } = extractAndLogClientContext(
      ctx,
      "Executing discover_movies",
      params
    );

    const matches = searchMovies(params);
    const userWatchlist = getUserWatchlist(subject);
    const userWatchlistIds = userWatchlist.map((m) => m.id);

    const summaryText = matches.length > 0
      ? `Found ${matches.length} movie(s) matching your criteria:\n` +
        matches
          .slice(0, 5)
          .map(
            (m) =>
              `- **${m.title}** (${m.year}) — ${m.genre} / ${m.mood} | ⭐ ${m.rating} | ⏱️ ${m.runtimeMinutes} min`
          )
          .join("\n")
      : "No movies found matching those specific criteria. Try relaxing your filters.";

    return {
      content: [
        {
          type: "text",
          text: summaryText,
        },
      ],
      structuredContent: {
        movies: matches,
        matchedCount: matches.length,
        totalCatalogCount: getAllMovies().length,
        appliedFilters: params,
        userWatchlistIds,
      },
      _meta: {
        "com.cinematch/session": sessionId,
        "com.cinematch/user": subject,
      },
    };
  }
);

export const getMovieDetails = server.tool(
  {
    name: "get_movie_details",
    title: "Get Movie Details",
    description: "Look up comprehensive metadata, streaming availability, cast and showtimes for a specific movie.",
    inputSchema: z.object({
      movieId: z.string().describe("The ID or title of the movie (e.g. 'arrival', 'inception')"),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      movie: movieSchema.optional(),
      inUserWatchlist: z.boolean(),
    }),
  },
  async ({ movieId }, ctx) => {
    const { subject } = extractAndLogClientContext(
      ctx,
      "Executing get_movie_details",
      { movieId }
    );

    const movie = getMovieById(movieId);
    if (!movie) {
      return {
        content: [
          {
            type: "text",
            text: `Movie '${movieId}' not found in catalog.`,
          },
        ],
        structuredContent: {
          found: false,
          inUserWatchlist: false,
        },
      };
    }

    const watchlist = getUserWatchlist(subject);
    const inUserWatchlist = watchlist.some((m) => m.id === movie.id);

    const text = [
      `### ${movie.title} (${movie.year})`,
      `*${movie.tagline}*`,
      "",
      `- **Director:** ${movie.director}`,
      `- **Cast:** ${movie.cast.join(", ")}`,
      `- **Genre:** ${movie.genre} | **Mood:** ${movie.mood}`,
      `- **Runtime:** ${movie.runtimeMinutes} min | **Rating:** ⭐ ${movie.rating}/10`,
      `- **Synopsis:** ${movie.synopsis}`,
      `- **Available on:** ${movie.streamingPlatforms.join(", ")}`,
      `- **Tonight's Showtimes:** ${movie.showtimes.join(", ")}`,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        found: true,
        movie,
        inUserWatchlist,
      },
    };
  }
);

export const manageWatchlist = server.tool(
  {
    name: "manage_watchlist",
    title: "Manage Watchlist",
    description: "Add, remove, or list movies in the user's personal movie watchlist.",
    inputSchema: z.object({
      movieId: z
        .string()
        .optional()
        .describe("The ID of the movie to add or remove"),
      action: z
        .enum(["add", "remove", "get"])
        .default("add")
        .describe("Action to perform on the personal watchlist"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      action: z.string(),
      watchlistCount: z.number(),
      watchlist: z.array(movieSchema),
    }),
  },
  async ({ movieId, action }, ctx) => {
    const { subject } = extractAndLogClientContext(
      ctx,
      "Executing manage_watchlist",
      { movieId, action }
    );

    let updatedList;
    if (action === "add" && movieId) {
      const res = addToWatchlist(subject, movieId);
      updatedList = res.watchlist;
    } else if (action === "remove" && movieId) {
      const res = removeFromWatchlist(subject, movieId);
      updatedList = res.watchlist;
    } else {
      updatedList = getUserWatchlist(subject);
    }

    const text =
      action === "get"
        ? `You have ${updatedList.length} movie(s) in your watchlist.`
        : `Watchlist updated (${action}): ${updatedList.length} movie(s) saved.`;

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        success: true,
        action,
        watchlistCount: updatedList.length,
        watchlist: updatedList,
      },
    };
  }
);

export default server;

// Standalone execution when run directly via node
const isMain = process.argv[1]?.includes("cinematch");
if (isMain) {
  const port = Number(process.env.MCP_PORT || process.env.PORT) || 3000;
  const { url } = await server.listen(port);
  console.log(`🎬 CineMatch MCP Server listening on ${url}`);
}
