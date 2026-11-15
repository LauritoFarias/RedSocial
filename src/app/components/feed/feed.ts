import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PostsService } from '../../services/posts';
import { AuthService } from '../../services/auth';
import { PostItem } from '../../models/post.model';
import { PostCard } from '../../components/post-card/post-card';

@Component({
  selector: 'app-feed',
  imports: [PostCard],
  templateUrl: './feed.html',
  styleUrl: './feed.scss',
})
export class Feed implements OnInit {
  private postsService = inject(PostsService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  posts = signal<PostItem[]>([]);
  sortBy = signal<'fecha' | 'likes'>('fecha');
  currentPage = signal<number>(1);
  limit = signal<number>(5);
  totalPages = signal<number>(1);
  cargando = signal<boolean>(false);

  // Reactivo al Signal currentUser de AuthService (actualizado por login y por el authGuard)
  currentUserId = computed(() => this.authService.currentUser()?._id ?? '');
  esAdmin = computed(() => this.authService.currentUser()?.perfil === 'admin');

  ngOnInit(): void {
    // Evita hacer la petición sin token durante el SSR en el servidor
    if (isPlatformBrowser(this.platformId)) {
      this.cargarPublicaciones();
    }
  }

  cargarPublicaciones(): void {
    this.cargando.set(true);
    this.postsService.getPosts(this.sortBy(), this.currentPage(), this.limit()).subscribe({
      next: (res) => {
        this.posts.set(res.data);
        this.totalPages.set(res.meta.totalPages || 1);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar publicaciones:', err);
        this.cargando.set(false);
      },
    });
  }

  cambiarOrden(nuevoOrden: 'fecha' | 'likes'): void {
    if (this.sortBy() === nuevoOrden) return;
    this.sortBy.set(nuevoOrden);
    this.currentPage.set(1);
    this.cargarPublicaciones();
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina < 1 || nuevaPagina > this.totalPages()) return;
    this.currentPage.set(nuevaPagina);
    this.cargarPublicaciones();
  }

  manejarLike(postId: string): void {
    this.postsService.toggleLike(postId).subscribe({
      next: (postActualizado) => {
        this.posts.update((lista) =>
          lista.map((p) => (p._id === postId ? postActualizado : p)),
        );
      },
    });
  }

  manejarEliminacion(postId: string): void {
    this.postsService.deletePost(postId).subscribe({
      next: () => {
        if (this.posts().length === 1 && this.currentPage() > 1) {
          this.currentPage.update((p) => p - 1);
        }
        this.cargarPublicaciones();
      },
    });
  }
}