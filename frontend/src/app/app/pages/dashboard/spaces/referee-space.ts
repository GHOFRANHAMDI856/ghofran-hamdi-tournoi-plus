import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TournamentMatch, TournamentService } from '../../../services/tournament';

@Component({
  selector: 'app-referee-space',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './referee-space.html',
})
export class RefereeSpace {
  private readonly tournamentService = inject(TournamentService);

  readonly matches = computed(() => {
    this.tournamentService.competitionVersion();
    return this.tournamentService.getRefereeMatches();
  });

  getTournamentName(match: TournamentMatch): string {
    return this.tournamentService.getTournamentName(match.tournamentId);
  }

  getTeamName(teamId: string): string {
    return this.tournamentService.getTeamName(teamId);
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

  formatDateTime(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  }
}
