import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Auth as AuthService, AuthUser, PublicUserRole, UserRole } from '../../services/auth';

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly registerForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: this.formBuilder.nonNullable.control<PublicUserRole>('spectateur'),
  });

  readonly signupRoles: Array<{ value: PublicUserRole; label: string }> = [
    { value: 'organisateur', label: 'Organisateur' },
    { value: 'joueur', label: 'Joueur' },
    { value: 'spectateur', label: 'Spectateur' },
  ];
  errorMessage = '';
  successMessage = '';
  mode: 'login' | 'register' = 'login';
  showPassword = false;

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  get currentUser(): AuthUser | null {
    return this.auth.getCurrentUser();
  }

  roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      organisateur: 'Organisateur',
      joueur: 'Joueur',
      spectateur: 'Spectateur',
    };

    return labels[role];
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.errorMessage = '';
    this.successMessage = '';
  }

  login(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    if (this.auth.login(email, password)) {
      void this.router.navigate(['/gestion']);
      return;
    }

    this.errorMessage = 'Adresse e-mail ou mot de passe incorrect.';
  }

  register(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { name, email, password, role } = this.registerForm.getRawValue();
    const result = this.auth.register(name, email, password, role);

    if (result.success) {
      void this.router.navigate(['/gestion']);
      return;
    }

    this.errorMessage = result.message;
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
