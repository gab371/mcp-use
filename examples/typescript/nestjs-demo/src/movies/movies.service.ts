import { Injectable } from '@nestjs/common';

export interface Movie {
  id: string;
  title: string;
  year: number;
  genre: string;
  rating: number;
  description: string;
}

@Injectable()
export class MoviesService {
  private readonly movies: Movie[] = [
    {
      id: 'm-1',
      title: 'Inception',
      year: 2010,
      genre: 'Sci-Fi',
      rating: 8.8,
      description: 'A thief who steals corporate secrets through the use of dream-sharing technology.',
    },
    {
      id: 'm-2',
      title: 'Interstellar',
      year: 2014,
      genre: 'Sci-Fi',
      rating: 8.7,
      description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survival.',
    },
    {
      id: 'm-3',
      title: 'The Dark Knight',
      year: 2008,
      genre: 'Action',
      rating: 9.0,
      description: 'When the menace known as the Joker wreaks havoc on Gotham, Batman must accept one of the greatest tests.',
    },
  ];

  getAll(): Movie[] {
    return this.movies;
  }

  getById(id: string): Movie | undefined {
    return this.movies.find((m) => m.id === id);
  }

  search(query: string): Movie[] {
    const q = query.toLowerCase();
    return this.movies.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
    );
  }
}
