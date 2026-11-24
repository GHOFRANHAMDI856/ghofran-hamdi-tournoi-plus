import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { TOURNAMENT_SPORTS, Tournament, TournamentMatch, TournamentService } from '../../../services/tournament';

@Component({
  selector: 'app-spectator-space',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spectator-space.html',
})
export class SpectatorSpace {
  private readonly tournamentService = inject(TournamentService);

  readonly tournaments = signal(this.tournamentService.getPublicTournaments());
  readonly matches = computed(() => {
    this.tournamentService.competitionVersion();
    return this.tournamentService.getPublicMatches();
  });
  readonly followedTournamentIds = signal(this.tournamentService.getFollowedTournamentIds());
  readonly searchTerm = signal('');
  readonly cityFilter = signal('');
  readonly dateFilter = signal('');
  readonly sportFilter = signal('');
  readonly sports: readonly string[] = TOURNAMENT_SPORTS;
  readonly filteredTournaments = computed(() => {
    const searchTerm = this.searchTerm().trim().toLocaleLowerCase('fr');
    const cityFilter = this.cityFilter().trim().toLocaleLowerCase('fr');
    const dateFilter = this.dateFilter();
    const sportFilter = this.sportFilter().toLocaleLowerCase('fr');

    return this.tournaments().filter((tournament) => {
      const searchableText = `${tournament.name} ${tournament.location} ${tournament.sport}`
        .toLocaleLowerCase('fr');
      const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
      const matchesCity = !cityFilter || tournament.location.toLocaleLowerCase('fr').includes(cityFilter);
      const matchesDate = !dateFilter || (
        tournament.startDate <= dateFilter && tournament.endDate >= dateFilter
      );
      const matchesSport = !sportFilter || tournament.sport.toLocaleLowerCase('fr') === sportFilter;

      return matchesSearch && matchesCity && matchesDate && matchesSport;
    });
  });
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
    this.followedTournamentIds.set(this.tournamentService.getFollowedTournamentIds());
  }

  updateSearchTerm(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  updateCityFilter(event: Event): void {
    this.cityFilter.set((event.target as HTMLInputElement).value);
  }

  updateDateFilter(event: Event): void {
    this.dateFilter.set((event.target as HTMLInputElement).value);
  }

  updateSportFilter(event: Event): void {
    this.sportFilter.set((event.target as HTMLSelectElement).value);
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.cityFilter.set('');
    this.dateFilter.set('');
    this.sportFilter.set('');
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
    return this.matches().filter((match) => match.tournamentId === tournamentId);
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
