export interface Autor {
  _id: string;
  username: string;
  nombre?: string;
  apellido?: string;
  imagenUrl?: string;
  fotoPerfil?: string;
}

export interface CommentItem {
  _id: string;
  postId: string;
  autor: Autor;
  texto: string;
  editado: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginatedComments {
  data: CommentItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PostItem {
  _id: string;
  titulo: string;
  descripcion: string;
  imagenUrl?: string;
  autor: Autor;
  likes: string[];
  likesCount: number;
  commentsCount?: number;
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