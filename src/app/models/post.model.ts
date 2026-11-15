export interface Autor {
  _id: string;
  username: string;
  nombre?: string;
  apellido?: string;
  imagenUrl?: string;
}

export interface PostItem {
  _id: string;
  titulo: string;
  descripcion: string;
  imagenUrl?: string;
  autor: Autor;
  likes: string[];
  likesCount: number;
  createdAt: string;
}

export interface PaginatedPosts {
  data: PostItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}