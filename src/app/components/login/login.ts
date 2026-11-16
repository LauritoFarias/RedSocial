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

  private readonly DEMO_USER = {
    identificador: 'ivanlaurito@hotmail.com',
    password: 'Contraseñasegura.123'
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
          this.router.navigate(['/feed']);
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