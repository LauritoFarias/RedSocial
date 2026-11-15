import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PostItem } from '../../models/post.model';

@Component({
  selector: 'app-post-card',
  imports: [DatePipe],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
  template: `
    <article class="post-card">
      <header class="post-header">
        <div class="autor-info">
          <img 
            [src]="post().autor.fotoPerfil || 'assets/default-avatar.png'" 
            [alt]="post().autor.username" 
            class="avatar" 
          />
          <div>
            <span class="username">@{{ post().autor.username }}</span>
            <time class="fecha">{{ post().createdAt | date:'dd/MM/yyyy HH:mm' }}</time>
          </div>
        </div>

        @if (esPropietario()) {
          <button 
            type="button" 
            class="btn-delete" 
            (click)="onDelete()" 
            title="Eliminar publicación">
            Eliminar
          </button>
        }
      </header>

      <div class="post-body">
        <h3 class="post-title">{{ post().titulo }}</h3>
        <p class="post-desc">{{ post().descripcion }}</p>

        @if (post().imagenUrl) {
          <div class="post-image-container">
            <img [src]="post().imagenUrl" [alt]="post().titulo" class="post-image" loading="lazy" />
          </div>
        }
      </div>

      <footer class="post-footer">
        <button 
          type="button" 
          class="btn-like" 
          [class.liked]="dioLike()"
          (click)="onToggleLike()">
          <span>{{ dioLike() ? '❤️' : '🤍' }}</span>
          <span>{{ post().likesCount }} Me gusta</span>
        </button>
      </footer>
    </article>
  `,
})
export class PostCard {
  post = input.required<PostItem>();
  currentUserId = input.required<string>();

  likeToggled = output<string>();
  deleted = output<string>();

  dioLike = computed(() => this.post().likes.includes(this.currentUserId()));

  esPropietario = computed(() => this.post().autor._id === this.currentUserId());

  onToggleLike(): void {
    this.likeToggled.emit(this.post()._id);
  }

  onDelete(): void {
    if (confirm('¿Estás seguro de que quieres eliminar esta publicación?')) {
      this.deleted.emit(this.post()._id);
    }
  }
}
