import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const peticionClonada =
    token && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(peticionClonada).pipe(
    catchError((error: HttpErrorResponse) => {
      const esRutaLogin = req.url.includes('/auth/login');
      if (error.status === 401 && !esRutaLogin) {
        authService.logout();
      }
      return throwError(() => error);
    }),
  );
};