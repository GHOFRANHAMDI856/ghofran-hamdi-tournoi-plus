import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Tournament, TournamentMatch, TournamentService } from '../../../services/tournament';

@Component({
  selector: 'app-spectator-space',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spectator-space.html',
})
export class SpectatorSpace {
  private readonly tournamentService = inject(TournamentService);

  readonly tournaments = signal(this.tournamentService.getPublicTournaments());
  readonly matches = signal(this.tournamentService.getPublicMatches());
  readonly followedTournamentIds = signal(this.tournamentService.getFollowedTournamentIds());
  readonly liveMatches = computed(() =>
    this.matches().filter((match) => this.getMatchStatus(match) === 'En cours').length,
  );
  readonly followedMatches = computed(() =>
    this.matches().filter((match) => this.followedTournamentIds().includes(match.tournamentId)),
  );

  toggleFollow(tournament: Tournament): void {
    this.tournamentService.toggleFollowTournament(tournament.id);
    this.followedTournamentIds.set(this.tournamentService.getFollowedTournamentIds());
  }

  refreshSpace(): void {
    this.tournaments.set(this.tournamentService.getPublicTournaments());
    this.matches.set(this.tournamentService.getPublicMatches());
    this.followedTournamentIds.set(this.tournamentService.getFollowedTournamentIds());
  }

  isFollowing(tournamentId: string): boolean {
    return this.followedTournamentIds().includes(tournamentId);
  }

  getTournamentName(match: TournamentMatch): string {
    return this.tournamentService.getTournamentName(match.tournamentId);
  }

  getTeamName(teamId: string): string {
    return this.tournamentService.getTeamName(teamId);
  }

  getMatchesForTournament(tournamentId: string): TournamentMatch[] {
    return this.followedMatches().filter((match) => match.tournamentId === tournamentId);
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

  getScore(match: TournamentMatch): string {
    return match.homeScore === null || match.awayScore === null
      ? '—'
      : `${match.homeScore} – ${match.awayScore}`;
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
      .format(new Date(`${date}T00:00:00`));
  }

  formatDateTime(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  }

  formatStatus(status: Tournament['status']): string {
    return {
      draft: 'Brouillon',
      open: 'Inscriptions ouvertes',
      in_progress: 'En cours',
      completed: 'Terminé',
    }[status];
  }
}
