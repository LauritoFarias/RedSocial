import { Component, computed, inject, input, output, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommentItem, PostItem } from '../../models/post.model';
import { PostsService } from '../../services/posts';

@Component({
  selector: 'app-post-card',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCard implements OnInit {
  private postsService = inject(PostsService);

  post = input.required<PostItem>();
  currentUserId = input.required<string>();
  esAdmin = input<boolean>(false);
  
  modoDetalle = input<boolean>(false);
  abrirComentariosInicialmente = input<boolean>(false);

  likeToggled = output<string>();
  deleted = output<string>();

  comentariosAbiertos = signal<boolean>(false);
  comentarios = signal<CommentItem[]>([]);
  paginaComentarios = signal<number>(1);
  readonly limiteComentarios = 10;
  hayMasComentarios = signal<boolean>(false);
  totalComentarios = signal<number>(0);
  cargandoComentarios = signal<boolean>(false);

  nuevoComentarioTexto = signal<string>('');
  enviandoComentario = signal<boolean>(false);

  comentarioEditandoId = signal<string | null>(null);
  textoEdicion = signal<string>('');
  guardandoEdicion = signal<boolean>(false);

  dioLike = computed(() => this.post().likes.includes(this.currentUserId()));
  esPropietario = computed(() => this.post().autor._id === this.currentUserId());
  puedeEliminar = computed(() => this.esPropietario() || this.esAdmin());

  ngOnInit(): void {
    this.totalComentarios.set(this.post().commentsCount ?? 0);

    if (this.abrirComentariosInicialmente()) {
      this.comentariosAbiertos.set(true);
      this.cargarComentarios(1, false);
    }
  }

  onToggleLike(): void {
    this.likeToggled.emit(this.post()._id);
  }

  onDelete(): void {
    if (confirm('¿Estás seguro de que quieres eliminar esta publicación?')) {
      this.deleted.emit(this.post()._id);
    }
  }

  // ================= ABRIR / CERRAR Y PAGINAR COMENTARIOS =================

  toggleCajaComentarios(): void {
    if (this.comentariosAbiertos()) {
      // Si ya estaba abierta, la cerramos
      this.comentariosAbiertos.set(false);
      this.cancelarEdicion();
      return;
    }

    this.comentariosAbiertos.set(true);
    if (this.comentarios().length === 0) {
      this.cargarComentarios(1, false);
    }
  }

  cargarMasComentarios(): void {
    if (this.cargandoComentarios() || !this.hayMasComentarios()) return;
    this.cargarComentarios(this.paginaComentarios() + 1, true);
  }

  private cargarComentarios(pagina: number, concatenar: boolean): void {
    this.cargandoComentarios.set(true);
    this.postsService
      .getComments(this.post()._id, pagina, this.limiteComentarios)
      .subscribe({
        next: (res) => {
          this.comentarios.update((actuales) =>
            concatenar ? [...actuales, ...res.data] : res.data,
          );
          this.paginaComentarios.set(res.meta.page);
          this.hayMasComentarios.set(res.meta.hasMore);
          this.totalComentarios.set(res.meta.total);
          this.cargandoComentarios.set(false);
        },
        error: (err) => {
          console.error('Error al cargar comentarios:', err);
          this.cargandoComentarios.set(false);
        },
      });
  }

  enviarComentario(): void {
    const texto = this.nuevoComentarioTexto().trim();
    if (!texto || this.enviandoComentario()) return;

    this.enviandoComentario.set(true);
    this.postsService.addComment(this.post()._id, texto).subscribe({
      next: (nuevo) => {
        this.comentarios.update((lista) => [nuevo, ...lista]);
        this.totalComentarios.update((t) => t + 1);
        this.nuevoComentarioTexto.set('');
        this.enviandoComentario.set(false);
      },
      error: (err) => {
        console.error('Error al publicar comentario:', err);
        this.enviandoComentario.set(false);
      },
    });
  }

  // ================= EDITAR COMENTARIO PROPIO =================

  iniciarEdicion(comentario: CommentItem): void {
    this.comentarioEditandoId.set(comentario._id);
    this.textoEdicion.set(comentario.texto);
  }

  cancelarEdicion(): void {
    this.comentarioEditandoId.set(null);
    this.textoEdicion.set('');
  }

  guardarEdicion(commentId: string): void {
    const nuevoTexto = this.textoEdicion().trim();
    if (!nuevoTexto || this.guardandoEdicion()) return;

    this.guardandoEdicion.set(true);
    this.postsService.updateComment(commentId, nuevoTexto).subscribe({
      next: (comentarioActualizado) => {
        this.comentarios.update((lista) =>
          lista.map((c) => (c._id === commentId ? comentarioActualizado : c)),
        );
        this.guardandoEdicion.set(false);
        this.cancelarEdicion();
      },
      error: (err) => {
        console.error('Error al editar comentario:', err);
        this.guardandoEdicion.set(false);
      },
    });
  }
}