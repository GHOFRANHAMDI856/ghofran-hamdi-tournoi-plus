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
  readonly searchTerm = signal('');
  readonly cityFilter = signal('');
  readonly dateFilter = signal('');
  readonly categoryFilter = signal('');
  readonly categories = computed(() => [...new Set(
    this.tournaments().map((tournament) => tournament.category.trim()).filter(Boolean),
  )].sort((first, second) => first.localeCompare(second, 'fr')));
  readonly filteredTournaments = computed(() => {
    const searchTerm = this.searchTerm().trim().toLocaleLowerCase('fr');
    const cityFilter = this.cityFilter().trim().toLocaleLowerCase('fr');
    const dateFilter = this.dateFilter();
    const categoryFilter = this.categoryFilter();

    return this.tournaments().filter((tournament) => {
      const searchableText = `${tournament.name} ${tournament.location} ${tournament.category}`
        .toLocaleLowerCase('fr');
      const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
      const matchesCity = !cityFilter || tournament.location.toLocaleLowerCase('fr').includes(cityFilter);
      const matchesDate = !dateFilter || (
        tournament.startDate <= dateFilter && tournament.endDate >= dateFilter
      );
      const matchesCategory = !categoryFilter || tournament.category === categoryFilter;

      return matchesSearch && matchesCity && matchesDate && matchesCategory;
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
    this.matches.set(this.tournamentService.getPublicMatches());
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

  updateCategoryFilter(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.cityFilter.set('');
    this.dateFilter.set('');
    this.categoryFilter.set('');
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
