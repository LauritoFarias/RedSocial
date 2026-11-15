import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Definí acá los parámetros de tu usuario válido de prueba
  private readonly DEMO_USER = {
    identificador: 'retro_admin',
    password: 'Password123'
  };

  loginForm = this.fb.group({
    identificador: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  isSubmitting = signal(false);
  errorMessage = signal('');

  quickLogin(): void {
    this.loginForm.patchValue({
      identificador: this.DEMO_USER.identificador,
      password: this.DEMO_USER.password,
    });
    this.onSubmit();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const { identificador, password } = this.loginForm.getRawValue();

    this.authService
      .login({
        identificador: identificador ?? '',
        password: password ?? '',
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.router.navigate(['/feed']); // Unificado con la ruta '/feed' de app.routes.ts
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.error?.message) {
            const msg = Array.isArray(err.error.message)
              ? err.error.message[0]
              : err.error.message;
            this.errorMessage.set(msg);
          } else {
            this.errorMessage.set('Error al iniciar sesión. Verificá tus datos.');
          }
        },
      });
  }
}