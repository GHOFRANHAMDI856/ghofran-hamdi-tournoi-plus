import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly sessionKey = 'gestion-tournoi-session';
  private readonly usersKey = 'gestion-tournoi-users';
  private readonly removedDemoEmail = 'demo@tournoiplus.fr';

  constructor() {
    this.getUsers();

    const currentUser = this.getCurrentUser();
    if (currentUser && this.isRemovedDemoEmail(currentUser.email)) {
      this.logout();
    }
  }

  login(email: string, password: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find((item) => item.email === normalizedEmail && item.password === password);

    if (user) {
      localStorage.setItem(this.sessionKey, JSON.stringify({ email: normalizedEmail, name: user.name }));
    }

    return Boolean(user);
  }

  register(name: string, email: string, password: string): { success: boolean; message: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const users = this.getUsers();

    if (users.some((item) => item.email === normalizedEmail)) {
      return { success: false, message: 'Cette adresse e-mail est déjà utilisée.' };
    }

    users.push({ name: name.trim(), email: normalizedEmail, password });
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    localStorage.setItem(
      this.sessionKey,
      JSON.stringify({ email: normalizedEmail, name: name.trim() }),
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

  getCurrentUser(): { email: string; name: string } | null {
    const session = localStorage.getItem(this.sessionKey);
    return session ? JSON.parse(session) as { email: string; name: string } : null;
  }

  private getUsers(): Array<{ name: string; email: string; password: string }> {
    const users = localStorage.getItem(this.usersKey);
    const savedUsers = users ? JSON.parse(users) as Array<{ name: string; email: string; password: string }> : [];
    const activeUsers = savedUsers.filter((user) => !this.isRemovedDemoEmail(user.email));

    if (activeUsers.length !== savedUsers.length) {
      localStorage.setItem(this.usersKey, JSON.stringify(activeUsers));
    }

    return activeUsers;
  }

  private isRemovedDemoEmail(email: string): boolean {
    return email.trim().toLowerCase() === this.removedDemoEmail;
  }
}
