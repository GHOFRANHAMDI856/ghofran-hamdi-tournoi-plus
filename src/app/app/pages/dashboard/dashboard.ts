import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Auth, AuthUser, UserRole } from '../../services/auth';
import { OrganizerSpace } from './spaces/organizer-space';
import { PlayerSpace } from './spaces/player-space';
import { SpectatorSpace } from './spaces/spectator-space';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrganizerSpace, PlayerSpace, SpectatorSpace],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.getCurrentUser();
  readonly todayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  readonly currentYear = new Date().getFullYear();

  get firstName(): string {
    return this.currentUser?.name.trim().split(/\s+/)[0] || 'sportif';
  }

  get userInitials(): string {
    return this.currentUser?.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'TP';
  }

  roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      organisateur: 'Organisateur',
      joueur: 'Joueur',
      spectateur: 'Spectateur',
    };

    return labels[role];
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
