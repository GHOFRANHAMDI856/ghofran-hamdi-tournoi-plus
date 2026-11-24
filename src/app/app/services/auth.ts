import { Injectable } from '@angular/core';

export const ACCOUNT_ROLES = ['organisateur', 'joueur', 'spectateur'] as const;
export type UserRole = (typeof ACCOUNT_ROLES)[number];
export type PublicUserRole = UserRole;

interface StoredUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly sessionKey = 'gestion-tournoi-session';
  private readonly usersKey = 'gestion-tournoi-users';
  private readonly removedDemoEmail = 'demo@tournoiplus.fr';

  constructor() {
    const users = this.getUsers();

    const currentUser = this.getCurrentUser();
    if (currentUser && this.isRemovedDemoEmail(currentUser.email)) {
      this.logout();
      return;
    }

    if (currentUser) {
      const savedUser = users.find((user) => user.email === currentUser.email);
      if (savedUser) {
        localStorage.setItem(
          this.sessionKey,
          JSON.stringify({ email: savedUser.email, name: savedUser.name, role: savedUser.role }),
        );
      } else {
        this.logout();
      }
    }
  }

  login(email: string, password: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find((item) => item.email === normalizedEmail && item.password === password);

    if (user) {
      localStorage.setItem(
        this.sessionKey,
        JSON.stringify({ email: normalizedEmail, name: user.name, role: user.role }),
      );
    }

    return Boolean(user);
  }

  register(
    name: string,
    email: string,
    password: string,
    role: PublicUserRole = 'spectateur',
  ): { success: boolean; message: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const users = this.getUsers();

    if (users.some((item) => item.email === normalizedEmail)) {
      return { success: false, message: 'Cette adresse e-mail est déjà utilisée.' };
    }

    if (!this.isPublicUserRole(role)) {
      return { success: false, message: 'Veuillez choisir un type de compte valide.' };
    }

    const user: StoredUser = {
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
    };
    users.push(user);
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    localStorage.setItem(
      this.sessionKey,
      JSON.stringify({ email: normalizedEmail, name: user.name, role: user.role }),
    );

    return { success: true, message: 'Compte créé avec succès.' };
  }

  logout(): void {
    localStorage.removeItem(this.sessionKey);
  }

  isAuthenticated(): boolean {
    const currentUser = this.getCurrentUser();
    if (currentUser && this.isRemovedDemoEmail(currentUser.email)) {
      this.logout();
      return false;
    }

    return currentUser !== null;
  }

  getCurrentUser(): AuthUser | null {
    const session = localStorage.getItem(this.sessionKey);
    return session ? JSON.parse(session) as AuthUser : null;
  }

  private getUsers(): StoredUser[] {
    const users = localStorage.getItem(this.usersKey);
    const savedUsers = users ? JSON.parse(users) as Array<Omit<StoredUser, 'role'> & { role?: unknown }> : [];
    const activeSavedUsers = savedUsers.filter((user) => !this.isRemovedDemoEmail(user.email));
    const activeUsers = activeSavedUsers.map((user): StoredUser => ({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role === 'admin'
        ? 'organisateur'
        : user.role === 'equipe'
          ? 'joueur'
        : this.isUserRole(user.role)
          ? user.role
          : 'spectateur',
    }));
    const needsMigration = activeUsers.length !== savedUsers.length
      || activeUsers.some((user, index) => activeSavedUsers[index]?.role !== user.role);

    if (needsMigration) {
      localStorage.setItem(this.usersKey, JSON.stringify(activeUsers));
    }

    return activeUsers;
  }

  private isUserRole(role: unknown): role is UserRole {
    return typeof role === 'string' && ACCOUNT_ROLES.some((knownRole) => knownRole === role);
  }

  private isPublicUserRole(role: unknown): role is PublicUserRole {
    return role === 'organisateur'
      || role === 'joueur'
      || role === 'spectateur';
  }

  private isRemovedDemoEmail(email: string): boolean {
    return email.trim().toLowerCase() === this.removedDemoEmail;
  }
}
