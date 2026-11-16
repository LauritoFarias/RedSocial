import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

// =========================================================================
// ⚙️ CONFIGURACIÓN DE TIEMPOS DE SESIÓN (Fáciles de cambiar en un solo lugar)
// Para la prueba de 1m 30s: Aviso a los 60s y cuenta regresiva de 30s.
// Si en el backend ponés 15m, podés cambiar TIEMPO_AVISO_MS a 14 * 60 * 1000.
// =========================================================================
export const TIEMPO_AVISO_MS = 60 * 1000; // 1 minuto para abrir el modal
export const TIEMPO_GRACIA_SEGUNDOS = 30; // 30 segundos restantes antes de vencer

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

  private warningTimeoutId: any = null;
  private countdownIntervalId: any = null;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  currentUser = signal<UsuarioSesion | null>(this.obtenerUsuarioGuardado());
  currentUserId = computed(() => this.currentUser()?._id ?? '');
  isAuthenticated = computed(() => !!this.currentUser() && !!this.getToken());

  // Signals para el modal de advertencia de sesión a nivel aplicación
  mostrarModalExpiracion = signal<boolean>(false);
  segundosRestantes = signal<number>(TIEMPO_GRACIA_SEGUNDOS);
  refrescandoToken = signal<boolean>(false);

  // Registro ahora también guarda el token en localStorage e inicia el contador
  registrar(formData: FormData): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/registro`, formData).pipe(
      tap((res) => this.guardarSesion(res)),
    );
  }

  // Login guarda el token en localStorage e inicia el contador
  login(credenciales: { identificador: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credenciales).pipe(
      tap((res) => this.guardarSesion(res)),
    );
  }

  // Refresca el token cuando el usuario acepta extender su sesión en el modal
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
        this.guardarSesion(res); // Guarda el nuevo token y reinicia el contador de 1 min
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
            // Si aún no había un contador corriendo (ej: tras F5), lo iniciamos
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

  // ================= LÓGICA DEL TEMPORIZADOR DE SESIÓN =================

  iniciarTemporizadorSesion(): void {
    if (!this.isBrowser) return;
    this.detenerTemporizadores();

    // 1. Al cumplirse 1 minuto (TIEMPO_AVISO_MS), abrimos el modal de 30 segundos
    this.warningTimeoutId = setTimeout(() => {
      this.segundosRestantes.set(TIEMPO_GRACIA_SEGUNDOS);
      this.mostrarModalExpiracion.set(true);

      // 2. Descontamos segundo a segundo los 30s restantes
      this.countdownIntervalId = setInterval(() => {
        const actual = this.segundosRestantes() - 1;
        if (actual <= 0) {
          // Si llegó a 0 y no extendió, cerramos sesión y redirigimos al login
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
}