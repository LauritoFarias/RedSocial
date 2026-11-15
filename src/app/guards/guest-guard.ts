import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.verificarSesion().pipe(
    map((isValid) => {
      if (isValid) {
        return router.createUrlTree(['/feed']);
      }
      return true;
    })
  );
};