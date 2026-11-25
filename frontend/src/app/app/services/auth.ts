import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export const ACCOUNT_ROLES = ['organisateur', 'joueur', 'spectateur', 'arbitre'] as const;
export type UserRole = (typeof ACCOUNT_ROLES)[number];
export type PublicUserRole = UserRole;

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly sessionKey = 'gestion-tournoi-session';
  private readonly tokenKey = 'gestion-tournoi-token';
  private readonly legacyUsersKey = 'gestion-tournoi-users';
  private readonly currentUser = signal<AuthUser | null>(null);

  constructor() {
    localStorage.removeItem(this.legacyUsersKey);
    localStorage.removeItem(this.sessionKey);

    const savedUser = sessionStorage.getItem(this.sessionKey);
    if (sessionStorage.getItem(this.tokenKey) && savedUser) {
      this.currentUser.set(JSON.parse(savedUser) as AuthUser);
    } else {
      this.logout();
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      const session = await firstValueFrom(
        this.http.post<AuthResponse>('/api/auth/login', { email: email.trim().toLowerCase(), password }),
      );
      this.saveSession(session);
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return false;
      }
      throw error;
    }
  }

  async register(
    name: string,
    email: string,
    password: string,
    role: PublicUserRole = 'spectateur',
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isUserRole(role)) {
      return { success: false, message: 'Veuillez choisir un type de compte valide.' };
    }

    try {
      const session = await firstValueFrom(
        this.http.post<AuthResponse>('/api/auth/register', {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        }),
      );
      this.saveSession(session);
      return { success: true, message: 'Compte créé avec succès.' };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        return {
          success: false,
          message: typeof error.error?.error === 'string'
            ? error.error.error
            : 'Impossible de créer le compte. Vérifiez la connexion à l’API.',
        };
      }
      throw error;
    }
  }

  logout(): void {
    sessionStorage.removeItem(this.sessionKey);
    sessionStorage.removeItem(this.tokenKey);
    this.currentUser.set(null);
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null && sessionStorage.getItem(this.tokenKey) !== null;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser();
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  getArbitres(): Array<Pick<AuthUser, 'name' | 'email'>> {
    return [];
  }

  private saveSession(session: AuthResponse): void {
    sessionStorage.setItem(this.sessionKey, JSON.stringify(session.user));
    sessionStorage.setItem(this.tokenKey, session.token);
    this.currentUser.set(session.user);
  }

  private isUserRole(role: unknown): role is UserRole {
    return typeof role === 'string' && ACCOUNT_ROLES.some((knownRole) => knownRole === role);
  }
}
