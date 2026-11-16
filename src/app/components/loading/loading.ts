import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, timer } from 'rxjs';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-loading',
  imports: [],
  templateUrl: './loading.html',
  styleUrl: './loading.scss',
})
export class Loading implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    forkJoin({
      esValido: this.authService.verificarSesion(),
      esperaMinima: timer(1000),
    }).subscribe(({ esValido }) => {
      if (esValido) {
        this.router.navigate(['/feed'], { replaceUrl: true });
      } else {
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }
}
