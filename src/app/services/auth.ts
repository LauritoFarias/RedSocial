import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';






export const TIEMPO_AVISO_MS = 60 * 1000; 
export const TIEMPO_GRACIA_SEGUNDOS = 30; 

export interface UsuarioSesion {
  _id: string;
  nombre: string;
  apellido: string;
  correo: string;
  username: string;
  imagenUrl?: string;
  fotoPerfil?: string;
  descripcion: string;
  fechaNacimiento?: string;
  perfil: string;
  createdAt?: string;
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

  private warningTimeoutId: any = null;
  private countdownIntervalId: any = null;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  currentUser = signal<UsuarioSesion | null>(this.obtenerUsuarioGuardado());
  currentUserId = computed(() => this.currentUser()?._id ?? '');
  isAuthenticated = computed(() => !!this.currentUser() && !!this.getToken());

  
  mostrarModalExpiracion = signal<boolean>(false);
  segundosRestantes = signal<number>(TIEMPO_GRACIA_SEGUNDOS);
  refrescandoToken = signal<boolean>(false);

  
  registrar(formData: FormData): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/registro`, formData).pipe(
      tap((res) => this.guardarSesion(res)),
    );
  }

  
  login(credenciales: { identificador: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credenciales).pipe(
      tap((res) => this.guardarSesion(res)),
    );
  }

  
  extenderSesion(): void {
    if (!this.isBrowser || this.refrescandoToken()) return;

    const token = this.getToken();
    if (!token) {
      this.logout();
      return;
    }

    this.refrescandoToken.set(true);
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.post<LoginResponse>(`${this.apiUrl}/refresh`, {}, { headers }).subscribe({
      next: (res) => {
        this.refrescandoToken.set(false);
        this.guardarSesion(res); 
      },
      error: () => {
        this.refrescandoToken.set(false);
        this.logout();
      },
    });
  }

  logout(): void {
    this.detenerTemporizadores();
    this.limpiarSesion();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('token');
  }

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
            
            if (!this.warningTimeoutId && !this.mostrarModalExpiracion()) {
              this.iniciarTemporizadorSesion();
            }
          }
        }),
        map((res) => res.valido),
        catchError(() => {
          this.limpiarSesion();
          return of(false);
        }),
      );
  }

  

  iniciarTemporizadorSesion(): void {
    if (!this.isBrowser) return;
    this.detenerTemporizadores();

    
    this.warningTimeoutId = setTimeout(() => {
      this.segundosRestantes.set(TIEMPO_GRACIA_SEGUNDOS);
      this.mostrarModalExpiracion.set(true);

      
      this.countdownIntervalId = setInterval(() => {
        const actual = this.segundosRestantes() - 1;
        if (actual <= 0) {
          
          this.logout();
        } else {
          this.segundosRestantes.set(actual);
        }
      }, 1000);
    }, TIEMPO_AVISO_MS);
  }

  private detenerTemporizadores(): void {
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.mostrarModalExpiracion.set(false);
  }

  private guardarSesion(res: LoginResponse): void {
    if (this.isBrowser) {
      localStorage.setItem('token', res.access_token);
      localStorage.setItem('usuario', JSON.stringify(res.usuario));
    }
    this.currentUser.set(res.usuario);
    this.iniciarTemporizadorSesion();
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

  actualizarPerfil(formData: FormData): Observable<{ usuario: UsuarioSesion }> {
    const token = this.getToken();
    const headers = token
      ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
      : new HttpHeaders();

    return this.http
      .patch<{ usuario: UsuarioSesion }>(`${this.apiUrl}/perfil`, formData, { headers })
      .pipe(
        tap((res) => {
          if (res.usuario) {
            this.currentUser.set(res.usuario);
            if (this.isBrowser) {
              localStorage.setItem('usuario', JSON.stringify(res.usuario));
            }
          }
        }),
      );
  }
}