import { Routes } from '@angular/router';
import { authGuard } from '../app/guards/auth-guard';
import { guestGuard } from '../app/guards/guest-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/loading/loading').then((m) => m.Loading),
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./components/login/login').then(m => m.Login)
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./components/registro/registro').then(m => m.Registro)
  },
  { 
    path: 'feed',  
    canActivate: [authGuard],
    loadComponent: () => import('./components/feed/feed').then(m => m.Feed) 
  },
  {
    path: 'post/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/post-detail/post-detail').then((m) => m.PostDetail),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./components/profile/profile').then((m) => m.Profile),
  },
];