import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaginatedPosts, PostItem } from '../models/post.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PostsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/posts`;

  getPosts(sortBy: 'fecha' | 'likes', page: number, limit: number): Observable<PaginatedPosts> {
    const params = new HttpParams()
      .set('sortBy', sortBy)
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PaginatedPosts>(this.apiUrl, { params });
  }

  toggleLike(postId: string): Observable<PostItem> {
    return this.http.post<PostItem>(`${this.apiUrl}/${postId}/like`, {});
  }

  deletePost(postId: string): Observable<{ deleted: boolean; postId: string }> {
    return this.http.delete<{ deleted: boolean; postId: string }>(`${this.apiUrl}/${postId}`);
  }
}