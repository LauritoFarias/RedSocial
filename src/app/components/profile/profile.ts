import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { PostsService } from '../../services/posts';
import { PostItem } from '../../models/post.model';
import { PostCard } from '../post-card/post-card';

export type CampoEditable =
  | 'nombre'
  | 'apellido'
  | 'username'
  | 'descripcion'
  | 'fechaNacimiento'
  | 'imagen'
  | 'password';

const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (!password || !confirmPassword) return null;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

const futureDateValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = control.value;
  if (!value) return null;
  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return value > todayString ? { futureDate: true } : null;
};

const profileImageValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const file = control.value as File | null;
  if (!file) return null;
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024;
  if (!allowedTypes.includes(file.type)) return { imageType: true };
  if (file.size > maxSize) return { imageSize: true };
  return null;
};

@Component({
  selector: 'app-profile',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, PostCard],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private postsService = inject(PostsService);
  private platformId = inject(PLATFORM_ID);

  paginaLista = signal<boolean>(false);
  ultimosPosts = signal<PostItem[]>([]);
  totalPublicaciones = signal<number>(0);

  usuarioActual = computed(() => this.authService.currentUser());
  currentUserId = computed(() => this.authService.currentUserId());
  esAdmin = computed(() => this.authService.currentUser()?.perfil === 'admin');
  menuUsuarioAbierto = signal<boolean>(false);

  // Estado del Modal de Edición en 2 pasos (1: Formulario, 2: Confirmar cambio)
  campoEditando = signal<CampoEditable | null>(null);
  confirmandoCambio = signal<boolean>(false);
  guardandoCambio = signal<boolean>(false);
  errorEdicion = signal<string>('');
  mensajeExito = signal<string>('');

  // Estado para selector de fecha (idéntico a Registro)
  readonly months = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];
  readonly currentYear = new Date().getFullYear();
  readonly years = Array.from({ length: 110 }, (_, i) => String(this.currentYear - i));

  selectedDay = signal<string>('');
  selectedMonth = signal<string>('');
  selectedYear = signal<string>('');

  availableDays = computed(() => {
    const year = Number(this.selectedYear()) || 2000;
    const month = Number(this.selectedMonth()) || 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
  });

  // Estado para imagen de perfil (idéntico a Registro)
  imagePreview = signal<string | null>(null);

  // Formularios específicos según el campo
  editForm = this.fb.group(
    {
      valorTexto: [''],
      birthDate: ['', [Validators.required, futureDateValidator]],
      profileImage: this.fb.control<File | null>(null, [
        Validators.required,
        profileImageValidator,
      ]),
      password: [''],
      confirmPassword: [''],
    },
    { validators: passwordMatchValidator },
  );

  avatarUsuarioActual = computed(() => {
    const user = this.usuarioActual();
    const url = user?.imagenUrl || user?.fotoPerfil;
    if (url) return url;
    const nombre = user?.username || user?.nombre || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=4f46e5&color=fff`;
  });

  tituloModal = computed(() => {
    switch (this.campoEditando()) {
      case 'nombre':
        return 'Cambiar nombre';
      case 'apellido':
        return 'Cambiar apellido';
      case 'username':
        return 'Cambiar nombre de usuario';
      case 'descripcion':
        return 'Cambiar descripción';
      case 'fechaNacimiento':
        return 'Cambiar fecha de nacimiento';
      case 'imagen':
        return 'Cambiar imagen de perfil';
      case 'password':
        return 'Cambiar contraseña';
      default:
        return '';
    }
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarDatosPerfil();
    }
  }

  ngOnDestroy(): void {
    this.limpiarPreviewUrl();
  }

  private limpiarPreviewUrl(): void {
    const prevUrl = this.imagePreview();
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
      this.imagePreview.set(null);
    }
  }

  private cargarDatosPerfil(): void {
    this.paginaLista.set(false);
    const inicio = Date.now();
    const userId = this.currentUserId();

    if (!userId) {
      this.paginaLista.set(true);
      return;
    }

    this.postsService.getPostsByUser(userId, 3).subscribe({
      next: async (res) => {
        this.ultimosPosts.set(res.data);
        this.totalPublicaciones.set(res.meta.total);

        const urlsAPrecargar = [
          this.avatarUsuarioActual(),
          ...res.data.map((p) => p.imagenUrl || ''),
        ].filter((url) => !!url);

        await this.precargarImagenes(urlsAPrecargar);

        const restante = Math.max(0, 600 - (Date.now() - inicio));
        setTimeout(() => this.paginaLista.set(true), restante);
      },
      error: (err) => {
        console.error('Error al cargar las publicaciones del perfil:', err);
        this.paginaLista.set(true);
      },
    });
  }

  private precargarImagenes(urls: string[]): Promise<void> {
    const urlsUnicas = [...new Set(urls)];
    const promesas = urlsUnicas.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    );
    return Promise.all(promesas).then(() => undefined);
  }

  // ================= FLUJO DE EDICIÓN DE DATOS DEL PERFIL =================

  abrirModalEditar(campo: CampoEditable): void {
    const user = this.usuarioActual();
    if (!user) return;

    this.errorEdicion.set('');
    this.confirmandoCambio.set(false);
    this.limpiarPreviewUrl();
    this.editForm.reset();

    const valorTextoCtrl = this.editForm.get('valorTexto')!;
    const passCtrl = this.editForm.get('password')!;
    const confirmPassCtrl = this.editForm.get('confirmPassword')!;

    valorTextoCtrl.clearValidators();
    passCtrl.clearValidators();
    confirmPassCtrl.clearValidators();

    if (campo === 'nombre' || campo === 'apellido') {
      valorTextoCtrl.setValue(campo === 'nombre' ? user.nombre : user.apellido);
      valorTextoCtrl.setValidators([
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u),
      ]);
    } else if (campo === 'username') {
      valorTextoCtrl.setValue(user.username);
      valorTextoCtrl.setValidators([
        Validators.required,
        Validators.pattern(/^[a-zA-Z0-9._]{3,20}$/),
      ]);
    } else if (campo === 'descripcion') {
      valorTextoCtrl.setValue(user.descripcion || '');
      valorTextoCtrl.setValidators([Validators.required, Validators.maxLength(350)]);
    } else if (campo === 'fechaNacimiento') {
      const fechaStr = user.fechaNacimiento ? String(user.fechaNacimiento).slice(0, 10) : '';
      if (fechaStr && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        const [y, m, d] = fechaStr.split('-');
        this.selectedYear.set(y);
        this.selectedMonth.set(m);
        this.selectedDay.set(d);
        this.editForm.get('birthDate')?.setValue(fechaStr);
      } else {
        this.selectedYear.set('');
        this.selectedMonth.set('');
        this.selectedDay.set('');
      }
    } else if (campo === 'password') {
      passCtrl.setValidators([
        Validators.required,
        Validators.pattern(/^(?=.*[A-Z])(?=.*\d).{8,}$/),
      ]);
      confirmPassCtrl.setValidators([Validators.required]);
    }

    valorTextoCtrl.updateValueAndValidity();
    passCtrl.updateValueAndValidity();
    confirmPassCtrl.updateValueAndValidity();

    this.campoEditando.set(campo);
  }

  cerrarModalEditar(): void {
    if (this.guardandoCambio()) return;
    this.campoEditando.set(null);
    this.confirmandoCambio.set(false);
    this.errorEdicion.set('');
    this.limpiarPreviewUrl();
  }

  // Selectores de fecha iguales al Registro
  onDatePartChange(part: 'day' | 'month' | 'year', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (part === 'day') this.selectedDay.set(value);
    if (part === 'month') this.selectedMonth.set(value);
    if (part === 'year') this.selectedYear.set(value);

    const maxDays = this.availableDays().length;
    if (this.selectedDay() && Number(this.selectedDay()) > maxDays) {
      this.selectedDay.set(String(maxDays).padStart(2, '0'));
    }

    const d = this.selectedDay();
    const m = this.selectedMonth();
    const y = this.selectedYear();
    const control = this.editForm.get('birthDate');

    if (d && m && y) {
      control?.setValue(`${y}-${m}-${d}`);
      control?.markAsDirty();
      control?.markAsTouched();
    } else {
      control?.setValue('');
    }
    control?.updateValueAndValidity();
  }

  markBirthDateTouched(): void {
    const control = this.editForm.get('birthDate');
    if (this.selectedDay() && this.selectedMonth() && this.selectedYear()) {
      control?.markAsTouched();
    }
  }

  // Selector de imagen igual al Registro
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    const control = this.editForm.get('profileImage');
    control?.setValue(file);
    control?.markAsTouched();
    control?.updateValueAndValidity();

    this.limpiarPreviewUrl();

    if (file && control?.valid) {
      this.imagePreview.set(URL.createObjectURL(file));
    }
  }

  // Paso 1: Validar el formulario pequeño y pasar a la pantalla de confirmación
  avanzarAConfirmacion(): void {
    const campo = this.campoEditando();
    if (!campo) return;

    if (campo === 'nombre' || campo === 'apellido' || campo === 'username' || campo === 'descripcion') {
      const ctrl = this.editForm.get('valorTexto')!;
      ctrl.markAsTouched();
      if (ctrl.invalid) return;
    } else if (campo === 'fechaNacimiento') {
      const ctrl = this.editForm.get('birthDate')!;
      ctrl.markAsTouched();
      if (ctrl.invalid) return;
    } else if (campo === 'imagen') {
      const ctrl = this.editForm.get('profileImage')!;
      ctrl.markAsTouched();
      if (ctrl.invalid) return;
    } else if (campo === 'password') {
      const passCtrl = this.editForm.get('password')!;
      const confCtrl = this.editForm.get('confirmPassword')!;
      passCtrl.markAsTouched();
      confCtrl.markAsTouched();
      if (passCtrl.invalid || confCtrl.invalid || this.editForm.hasError('passwordMismatch')) {
        return;
      }
    }

    this.errorEdicion.set('');
    this.confirmandoCambio.set(true);
  }

  volverAFormulario(): void {
    if (this.guardandoCambio()) return;
    this.confirmandoCambio.set(false);
  }

  // Paso 2: Confirmar cambios y enviar al backend
  confirmarYGuardar(): void {
    const campo = this.campoEditando();
    if (!campo || this.guardandoCambio()) return;

    this.guardandoCambio.set(true);
    this.errorEdicion.set('');

    const formData = new FormData();
    const raw = this.editForm.getRawValue();

    if (campo === 'nombre' || campo === 'apellido' || campo === 'username' || campo === 'descripcion') {
      formData.append(campo, (raw.valorTexto ?? '').trim());
    } else if (campo === 'fechaNacimiento') {
      formData.append('fechaNacimiento', raw.birthDate ?? '');
    } else if (campo === 'imagen' && raw.profileImage) {
      formData.append('imagen', raw.profileImage);
    } else if (campo === 'password') {
      formData.append('password', raw.password ?? '');
    }

    this.authService.actualizarPerfil(formData).subscribe({
      next: () => {
        this.guardandoCambio.set(false);
        this.cerrarModalEditar();
        // Refrescamos también las 3 publicaciones por si cambió su foto o username
        this.postsService.getPostsByUser(this.currentUserId(), 3).subscribe({
          next: (res) => this.ultimosPosts.set(res.data),
        });
        this.mostrarToastExito('¡Cambios guardados correctamente!');
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoCambio.set(false);
        this.confirmandoCambio.set(false);
        const msg = Array.isArray(err.error?.message)
          ? err.error.message[0]
          : err.error?.message || 'No se pudo guardar el cambio. Intentá nuevamente.';
        this.errorEdicion.set(msg);
      },
    });
  }

  private mostrarToastExito(texto: string): void {
    this.mensajeExito.set(texto);
    setTimeout(() => {
      this.mensajeExito.set('');
    }, 3000);
  }

  // ================= ACCIONES EN LAS PUBLICACIONES DEL PERFIL =================

  manejarLike(postId: string): void {
    this.postsService.toggleLike(postId).subscribe({
      next: (postActualizado) => {
        this.ultimosPosts.update((lista) =>
          lista.map((p) =>
            p._id === postId
              ? { ...postActualizado, commentsCount: p.commentsCount }
              : p,
          ),
        );
      },
    });
  }

  manejarEliminacion(postId: string): void {
    this.postsService.deletePost(postId).subscribe({
      next: () => {
        this.postsService.getPostsByUser(this.currentUserId(), 3).subscribe({
          next: (res) => {
            this.ultimosPosts.set(res.data);
            this.totalPublicaciones.set(res.meta.total);
          },
        });
      },
    });
  }

  // ================= MENÚ DE USUARIO (HEADER) =================

  toggleMenuUsuario(event: Event): void {
    event.stopPropagation();
    this.menuUsuarioAbierto.update((abierto) => !abierto);
  }

  cerrarMenuUsuario(): void {
    if (this.menuUsuarioAbierto()) {
      this.menuUsuarioAbierto.set(false);
    }
  }

  cerrarSesion(): void {
    this.menuUsuarioAbierto.set(false);
    this.authService.logout();
  }
}