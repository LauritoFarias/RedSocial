import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { take } from 'rxjs';


interface RegistroDraft {
  nombre: string;
  apellido: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  birthDate: string;
  description: string;
  profileImage: File | null;
  selectedDay: string;
  selectedMonth: string;
  selectedYear: string;
}

let registroDraftCache: RegistroDraft | null = null;

const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword
    ? null
    : { passwordMismatch: true };
};

const futureDateValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const value = control.value;

  if (!value) {
    return null;
  }

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  return value > todayString
    ? { futureDate: true }
    : null;
};

const profileImageValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const file = control.value as File | null;

  if (!file) {
    return null;
  }

  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ];

  const maxSize = 5 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    return { imageType: true };
  }

  if (file.size > maxSize) {
    return { imageSize: true };
  }

  return null;
};

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private hostElement = inject(ElementRef<HTMLElement>);

  registroForm = this.fb.group({
    nombre: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u)
      ]
    ],
    apellido: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u)
      ]
    ],
    email: [
      '',
      [
        Validators.required,
        Validators.email
      ]
    ],
    profileImage: this.fb.control<File | null>(
      null,
      [Validators.required, profileImageValidator]
    ),
    username: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[a-zA-Z0-9._]{3,20}$/)
      ]
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.pattern(/^(?=.*[A-Z])(?=.*\d).{8,}$/)
      ]
    ],
    confirmPassword: [
      '',
      [Validators.required]
    ],
    birthDate: [
      '',
      [
        Validators.required,
        futureDateValidator
      ]
    ],
    description: [
      '',
      [
        Validators.required,
        Validators.maxLength(350)
      ]
    ]
  }, {
    validators: passwordMatchValidator
  });

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

    return Array.from({ length: daysInMonth }, (_, i) =>
      String(i + 1).padStart(2, '0')
    );
  });

  isSubmitting = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  imagePreview = signal<string | null>(null);

  today = this.getTodayString();

  constructor() {
    
    this.registroForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.guardarBorradorEnMemoria();
      });
  }

  ngOnInit(): void {
    
    if (registroDraftCache) {
      this.selectedDay.set(registroDraftCache.selectedDay);
      this.selectedMonth.set(registroDraftCache.selectedMonth);
      this.selectedYear.set(registroDraftCache.selectedYear);

      this.registroForm.patchValue({
        nombre: registroDraftCache.nombre,
        apellido: registroDraftCache.apellido,
        email: registroDraftCache.email,
        username: registroDraftCache.username,
        password: registroDraftCache.password,
        confirmPassword: registroDraftCache.confirmPassword,
        birthDate: registroDraftCache.birthDate,
        description: registroDraftCache.description,
        profileImage: registroDraftCache.profileImage
      }, { emitEvent: false });

      if (registroDraftCache.profileImage && this.registroForm.get('profileImage')?.valid) {
        this.imagePreview.set(URL.createObjectURL(registroDraftCache.profileImage));
      }
    }
  }

  ngOnDestroy(): void {
    const prevUrl = this.imagePreview();
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
  }

  private guardarBorradorEnMemoria(): void {
    const raw = this.registroForm.getRawValue();
    registroDraftCache = {
      nombre: raw.nombre ?? '',
      apellido: raw.apellido ?? '',
      email: raw.email ?? '',
      username: raw.username ?? '',
      password: raw.password ?? '',
      confirmPassword: raw.confirmPassword ?? '',
      birthDate: raw.birthDate ?? '',
      description: raw.description ?? '',
      profileImage: raw.profileImage ?? null,
      selectedDay: this.selectedDay(),
      selectedMonth: this.selectedMonth(),
      selectedYear: this.selectedYear()
    };
  }

  private scrollToError(selector: string): void {
    setTimeout(() => {
      const target = this.hostElement.nativeElement.querySelector(selector) as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  }

  onDatePartChange(part: 'day' | 'month' | 'year', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (part === 'day') this.selectedDay.set(value);
    if (part === 'month') this.selectedMonth.set(value);
    if (part === 'year') this.selectedYear.set(value);

    const maxDays = this.availableDays().length;
    if (this.selectedDay() && Number(this.selectedDay()) > maxDays) {
      this.selectedDay.set(String(maxDays).padStart(2, '0'));
    }

    this.syncBirthDateControl();
    this.guardarBorradorEnMemoria();
  }

  markBirthDateTouched(): void {
    const control = this.registroForm.get('birthDate');
    if (this.selectedDay() && this.selectedMonth() && this.selectedYear()) {
      control?.markAsTouched();
    }
  }

  private syncBirthDateControl(): void {
    const d = this.selectedDay();
    const m = this.selectedMonth();
    const y = this.selectedYear();
    const control = this.registroForm.get('birthDate');

    if (d && m && y) {
      control?.setValue(`${y}-${m}-${d}`);
      control?.markAsDirty();
      control?.markAsTouched();
    } else {
      control?.setValue('');
    }
    control?.updateValueAndValidity();
  }

  private getTodayString(): string {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    const control = this.registroForm.get('profileImage');
    control?.setValue(file);
    control?.markAsTouched();
    control?.updateValueAndValidity();

    const prevUrl = this.imagePreview();
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }

    if (file && control?.valid) {
      this.imagePreview.set(URL.createObjectURL(file));
    } else {
      this.imagePreview.set(null);
      if (control?.invalid) {
        this.scrollToError('.field-error, .input-error');
      }
    }
  }

  onSubmit(): void {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      this.scrollToError('.input-error, .field-error');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const rawValues = this.registroForm.getRawValue();
    const formData = new FormData();

    formData.append('nombre', rawValues.nombre ?? '');
    formData.append('apellido', rawValues.apellido ?? '');
    formData.append('correo', rawValues.email ?? '');
    formData.append('username', rawValues.username ?? '');
    formData.append('password', rawValues.password ?? '');
    formData.append('fechaNacimiento', rawValues.birthDate ?? '');
    formData.append('descripcion', rawValues.description ?? '');
    formData.append('perfil', 'usuario');

    if (rawValues.profileImage) {
      formData.append('imagen', rawValues.profileImage);
    }

    this.authService.registrar(formData).pipe(take(1)).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        registroDraftCache = null; 
        this.successMessage.set('¡Usuario registrado correctamente! Redirigiendo...');

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        if (err.error?.message) {
          const msg = Array.isArray(err.error.message)
            ? err.error.message[0]
            : err.error.message;
          this.errorMessage.set(msg);
        } else {
          this.errorMessage.set('Ocurrió un error al registrar el usuario. Intentá nuevamente.');
        }
        
        this.scrollToError('.alert-error');
      }
    });
  }
}