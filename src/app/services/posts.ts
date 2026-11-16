import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CommentItem,
  PaginatedComments,
  PaginatedPosts,
  PostItem,
} from '../models/post.model';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PostsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/posts`;

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return token
      ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
      : new HttpHeaders();
  }

  getPosts(sortBy: 'fecha' | 'likes', page: number, limit = 10): Observable<PaginatedPosts> {
    const params = new HttpParams()
      .set('sortBy', sortBy)
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PaginatedPosts>(this.apiUrl, {
      params,
      headers: this.getHeaders(),
    });
  }

  getPostsByUser(userId: string, limit = 3): Observable<PaginatedPosts> {
    const params = new HttpParams()
      .set('sortBy', 'fecha')
      .set('page', '1')
      .set('limit', limit.toString())
      .set('userId', userId);

    return this.http.get<PaginatedPosts>(this.apiUrl, {
      params,
      headers: this.getHeaders(),
    });
  }

  createPost(formData: FormData): Observable<PostItem> {
    return this.http.post<PostItem>(this.apiUrl, formData, {
      headers: this.getHeaders(),
    });
  }

  toggleLike(postId: string): Observable<PostItem> {
    return this.http.post<PostItem>(
      `${this.apiUrl}/${postId}/like`,
      {},
      { headers: this.getHeaders() },
    );
  }

  deletePost(postId: string): Observable<{ deleted: boolean; postId: string }> {
    return this.http.delete<{ deleted: boolean; postId: string }>(
      `${this.apiUrl}/${postId}`,
      { headers: this.getHeaders() },
    );
  }

  // ================= COMENTARIOS =================

  getComments(postId: string, page = 1, limit = 10): Observable<PaginatedComments> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PaginatedComments>(`${this.apiUrl}/${postId}/comments`, {
      params,
      headers: this.getHeaders(),
    });
  }

  addComment(postId: string, texto: string): Observable<CommentItem> {
    return this.http.post<CommentItem>(
      `${this.apiUrl}/${postId}/comments`,
      { texto },
      { headers: this.getHeaders() },
    );
  }

  updateComment(commentId: string, texto: string): Observable<CommentItem> {
    return this.http.put<CommentItem>(
      `${this.apiUrl}/comments/${commentId}`,
      { texto },
      { headers: this.getHeaders() },
    );
  }

  getPostById(postId: string): Observable<PostItem> {
    return this.http.get<PostItem>(`${this.apiUrl}/${postId}`, {
      headers: this.getHeaders(),
    });
  }
}