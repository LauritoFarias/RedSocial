import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioSesion {
  _id: string;
  nombre: string;
  apellido: string;
  correo: string;
  username: string;
  imagenUrl: string;
  descripcion: string;
  perfil: string;
}

export interface LoginResponse {
  access_token: string;
  usuario: UsuarioSesion;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = `${environment.apiUrl}/auth`;

  // Verifica si estamos ejecutando en el navegador antes de leer localStorage
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  currentUser = signal<UsuarioSesion | null>(this.obtenerUsuarioGuardado());
  currentUserId = computed(() => this.currentUser()?._id ?? '');
  isAuthenticated = computed(() => !!this.currentUser() && !!this.getToken());

  registrar(formData: FormData): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/registro`, formData);
  }

  login(credenciales: { identificador: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credenciales).pipe(
      tap((res) => this.guardarSesion(res)),
    );
  }

  logout(): void {
    this.limpiarSesion();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('token');
  }

  /**
   * Valida el token con GET /auth/me y actualiza el usuario en memoria/localStorage.
   * Ideal para usar dentro del AuthGuard.
   */
  verificarSesion(): Observable<boolean> {
    if (!this.isBrowser) {
      return of(false);
    }

    const token = this.getToken();
    if (!token) {
      this.limpiarSesion();
      return of(false);
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http
      .get<{ valido: boolean; usuario: UsuarioSesion }>(`${this.apiUrl}/me`, { headers })
      .pipe(
        tap((res) => {
          if (res.usuario) {
            this.currentUser.set(res.usuario);
            localStorage.setItem('usuario', JSON.stringify(res.usuario));
          }
        }),
        map((res) => res.valido),
        catchError(() => {
          this.limpiarSesion();
          return of(false);
        }),
      );
  }

  private guardarSesion(res: LoginResponse): void {
    if (this.isBrowser) {
      localStorage.setItem('token', res.access_token);
      localStorage.setItem('usuario', JSON.stringify(res.usuario));
    }
    this.currentUser.set(res.usuario);
  }

  private limpiarSesion(): void {
    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
    this.currentUser.set(null);
  }

  private obtenerUsuarioGuardado(): UsuarioSesion | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    const raw = localStorage.getItem('usuario');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UsuarioSesion;
    } catch {
      return null;
    }
  }
}