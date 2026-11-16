import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, timer } from 'rxjs';
import { PostsService } from '../../services/posts';
import { AuthService } from '../../services/auth';
import { PostItem } from '../../models/post.model';
import { PostCard } from '../post-card/post-card';

@Component({
  selector: 'app-post-detail',
  imports: [PostCard, RouterLink],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.scss',
})
export class PostDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private postsService = inject(PostsService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  paginaLista = signal<boolean>(false);
  post = signal<PostItem | null>(null);
  errorNoEncontrado = signal<boolean>(false);

  // Estado del usuario y menú del header
  usuarioActual = computed(() => this.authService.currentUser());
  currentUserId = computed(() => this.authService.currentUserId());
  esAdmin = computed(() => this.authService.currentUser()?.perfil === 'admin');
  menuUsuarioAbierto = signal<boolean>(false);

  avatarUsuarioActual = computed(() => {
    const user = this.usuarioActual();
    if (user?.imagenUrl) return user.imagenUrl;
    const nombre = user?.username || user?.nombre || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=4f46e5&color=fff`;
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const postId = this.route.snapshot.paramMap.get('id');
    if (!postId) {
      this.errorNoEncontrado.set(true);
      this.paginaLista.set(true);
      return;
    }

    this.cargarDetalle(postId);
  }

  private cargarDetalle(postId: string): void {
    this.paginaLista.set(false);
    this.errorNoEncontrado.set(false);
    const inicio = Date.now();

    this.postsService.getPostById(postId).subscribe({
      next: async (postData) => {
        this.post.set(postData);

        // Solo precargamos la imagen del post si la publicación tiene imagen
        const urlsAPrecargar = [
          this.avatarUsuarioActual(),
          postData.autor?.imagenUrl || postData.autor?.fotoPerfil || '',
          postData.imagenUrl || '',
        ].filter((url) => !!url);

        await this.precargarImagenes(urlsAPrecargar);

        // Garantizamos al menos 600ms de spinner suave
        const restante = Math.max(0, 600 - (Date.now() - inicio));
        setTimeout(() => this.paginaLista.set(true), restante);
      },
      error: (err) => {
        console.error('Error al cargar la publicación:', err);
        this.errorNoEncontrado.set(true);
        this.paginaLista.set(true);
      },
    });
  }

  private precargarImagenes(urls: string[]): Promise<void> {
    const urlsUnicas = [...new Set(urls)];
    const promesas = urlsUnicas.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    );
    return Promise.all(promesas).then(() => undefined);
  }

  // ================= ACCIONES DE LA PUBLICACIÓN =================

  manejarLike(postId: string): void {
    this.postsService.toggleLike(postId).subscribe({
      next: (postActualizado) => {
        this.post.update((actual) =>
          actual
            ? { ...postActualizado, commentsCount: actual.commentsCount }
            : postActualizado,
        );
      },
    });
  }

  manejarEliminacion(postId: string): void {
    this.postsService.deletePost(postId).subscribe({
      next: () => {
        this.router.navigate(['/feed']);
      },
    });
  }

  // ================= MENÚ DE USUARIO (HEADER) =================

  toggleMenuUsuario(event: Event): void {
    event.stopPropagation();
    this.menuUsuarioAbierto.update((abierto) => !abierto);
  }

  cerrarMenuUsuario(): void {
    if (this.menuUsuarioAbierto()) {
      this.menuUsuarioAbierto.set(false);
    }
  }

  cerrarSesion(): void {
    this.menuUsuarioAbierto.set(false);
    this.authService.logout();
  }

}
