import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }
  
  if (authService.isAuthenticated()) {
    return true;
  }

  return authService.verificarSesion().pipe(
    map((esValido) => (esValido ? true : router.createUrlTree(['/login']))),
  );
};