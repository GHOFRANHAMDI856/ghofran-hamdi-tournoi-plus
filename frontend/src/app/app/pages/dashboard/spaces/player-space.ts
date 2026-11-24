import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Auth } from '../../../services/auth';
import { TeamJoinRequest, TournamentMatch, TournamentService, TournamentTeam } from '../../../services/tournament';

@Component({
  selector: 'app-player-space',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-space.html',
})
export class PlayerSpace {
  private readonly auth = inject(Auth);
  private readonly tournamentService = inject(TournamentService);

  readonly currentUser = this.auth.getCurrentUser();
  readonly directory = signal(this.tournamentService.getTeamDirectory());
  readonly teams = signal(this.tournamentService.getMyTeams());
  readonly requests = signal(this.tournamentService.getMyJoinRequests());
  readonly matches = signal(this.tournamentService.getPlayerMatches());
  readonly message = signal('');
  readonly error = signal('');
  readonly pointsTotal = computed(() => {
    const email = this.currentUser?.email ?? '';
    return this.matches().reduce(
      (total, match) => total + (this.tournamentService.getPlayerPoints(match.id, email) ?? 0),
      0,
    );
  });

  requestToJoin(team: TournamentTeam): void {
    this.error.set('');
    const request = this.tournamentService.requestToJoin(team.id);
    if (!request) {
      this.error.set('Impossible d’envoyer la demande. L’équipe est peut-être complète ou les inscriptions sont fermées.');
      return;
    }

    this.message.set(`Votre demande pour rejoindre ${team.name} a été envoyée.`);
    this.refresh();
  }

  refreshSpace(): void {
    this.refresh();
    this.message.set('Votre espace a été actualisé.');
  }

  getRequestForTeam(teamId: string): TeamJoinRequest | undefined {
    return this.requests().find((request) => request.teamId === teamId);
  }

  getTournamentName(match: TournamentMatch): string {
    return this.tournamentService.getTournamentName(match.tournamentId);
  }

  getPersonalPoints(match: TournamentMatch): number | null {
    return this.currentUser
      ? this.tournamentService.getPlayerPoints(match.id, this.currentUser.email)
      : null;
  }

  getTeamName(teamId: string): string {
    return this.tournamentService.getTeamName(teamId);
  }

  getMatchScore(match: TournamentMatch): string {
    return match.homeScore === null || match.awayScore === null
      ? 'À venir'
      : `${match.homeScore} – ${match.awayScore}`;
  }

  getMatchStatus(match: TournamentMatch): string {
    if (match.homeScore !== null && match.awayScore !== null) {
      return 'Terminé';
    }
    const now = Date.now();
    const start = new Date(match.startAt).getTime();
    const end = new Date(match.endAt).getTime();
    if (now >= start && now <= end) {
      return 'En cours';
    }
    return now > end ? 'Score à saisir' : 'À venir';
  }

  formatDateTime(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  }

  private refresh(): void {
    this.directory.set(this.tournamentService.getTeamDirectory());
    this.teams.set(this.tournamentService.getMyTeams());
    this.requests.set(this.tournamentService.getMyJoinRequests());
    this.matches.set(this.tournamentService.getPlayerMatches());
  }
}
