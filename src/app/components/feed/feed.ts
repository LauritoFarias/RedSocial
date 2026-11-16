import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, timer } from 'rxjs';
import { PostsService } from '../../services/posts';
import { AuthService } from '../../services/auth';
import { PostItem } from '../../models/post.model';
import { PostCard } from '../../components/post-card/post-card';

@Component({
  selector: 'app-feed',
  imports: [PostCard, ReactiveFormsModule, RouterLink],
  templateUrl: './feed.html',
  styleUrl: './feed.scss',
})
export class Feed implements OnInit {
  private postsService = inject(PostsService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);

  paginaLista = signal<boolean>(false);

  posts = signal<PostItem[]>([]);
  sortBy = signal<'fecha' | 'likes'>('fecha');
  currentPage = signal<number>(1);
  limit = signal<number>(10);
  totalPages = signal<number>(1);
  cargando = signal<boolean>(false);

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

  modalCrearAbierto = signal<boolean>(false);
  creandoPost = signal<boolean>(false);
  errorCreacion = signal<string>('');
  imagenArchivo = signal<File | null>(null);
  imagenPreview = signal<string | null>(null);

  postForm = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(120)]],
    descripcion: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cargaInicialCompleta();
    }
  }

  private cargaInicialCompleta(): void {
    this.paginaLista.set(false);
    const inicio = Date.now();

    this.postsService.getPosts(this.sortBy(), this.currentPage(), this.limit()).subscribe({
      next: async (res) => {
        this.posts.set(res.data);
        this.totalPages.set(res.meta.totalPages || 1);

        const urlsAPrecargar: string[] = [
          this.avatarUsuarioActual(),
          ...res.data.map((p) => p.autor?.imagenUrl || p.autor?.fotoPerfil || ''),
          ...res.data.map((p) => p.imagenUrl || ''),
        ].filter((url) => !!url);

        await this.precargarImagenes(urlsAPrecargar);

        const restante = Math.max(0, 800 - (Date.now() - inicio));
        setTimeout(() => this.paginaLista.set(true), restante);
      },
      error: (err) => {
        console.error('Error al cargar publicaciones:', err);
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

  cargarPublicaciones(): void {
    this.cargando.set(true);
    this.postsService.getPosts(this.sortBy(), this.currentPage(), this.limit()).subscribe({
      next: async (res) => {
        const urls = [
          ...res.data.map((p) => p.autor?.imagenUrl || p.autor?.fotoPerfil || ''),
          ...res.data.map((p) => p.imagenUrl || ''),
        ].filter((url) => !!url);

        await this.precargarImagenes(urls);
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
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

  // ================= MODAL DE NUEVA PUBLICACIÓN =================

  abrirModalCrear(): void {
    this.errorCreacion.set('');
    this.modalCrearAbierto.set(true);
  }

  cerrarModalCrear(): void {
    if (this.creandoPost()) return;
    this.modalCrearAbierto.set(false);
    this.postForm.reset();
    this.imagenArchivo.set(null);
    this.imagenPreview.set(null);
    this.errorCreacion.set('');
  }

  onImagenSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.imagenArchivo.set(file);
    const reader = new FileReader();
    reader.onload = () => this.imagenPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  quitarImagen(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.imagenArchivo.set(null);
    this.imagenPreview.set(null);
  }

  crearPublicacion(): void {
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }

    this.creandoPost.set(true);
    this.errorCreacion.set('');

    const { titulo, descripcion } = this.postForm.getRawValue();
    const formData = new FormData();
    formData.append('titulo', titulo.trim());
    formData.append('descripcion', descripcion.trim());

    const archivo = this.imagenArchivo();
    if (archivo) {
      formData.append('imagen', archivo);
    }

    this.postsService.createPost(formData).subscribe({
      next: () => {
        this.creandoPost.set(false);
        this.cerrarModalCrear();
        this.currentPage.set(1);
        this.cargarPublicaciones();
      },
      error: (err) => {
        this.creandoPost.set(false);
        this.errorCreacion.set(
          err?.error?.message || 'No se pudo publicar. Intentá nuevamente.',
        );
      },
    });
  }

  // ================= ACCIONES DE TARJETA =================

  manejarLike(postId: string): void {
    this.postsService.toggleLike(postId).subscribe({
      next: (postActualizado) => {
        this.posts.update((lista) =>
          lista.map((p) =>
            p._id === postId
              ? { ...postActualizado, commentsCount: p.commentsCount }
              : p,
          ),
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