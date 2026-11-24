import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Tournament, TournamentMatch, TournamentService } from '../../../services/tournament';
import { SpectatorSpace } from './spectator-space';

describe('SpectatorSpace', () => {
  const tournaments: Tournament[] = [
    {
      id: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      name: 'Coupe régionale',
      sport: 'Basketball',
      startDate: '2026-11-24',
      endDate: '2026-11-26',
      location: 'Lyon - Gymnase A',
      description: '',
      rules: '',
      format: 'groups',
      status: 'open',
      maxTeams: 8,
    },
    {
      id: 'tournament-2',
      ownerEmail: 'organizer@example.com',
      name: 'Tournoi U18',
      sport: 'Football',
      startDate: '2026-11-28',
      endDate: '2026-11-29',
      location: 'Villeurbanne - Gymnase B',
      description: '',
      rules: '',
      format: 'elimination',
      status: 'open',
      maxTeams: 8,
    },
    {
      id: 'tournament-3',
      ownerEmail: 'organizer@example.com',
      name: 'Coupe d’hiver',
      sport: 'Volleyball',
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      location: 'Paris - Gymnase C',
      description: '',
      rules: '',
      format: 'league',
      status: 'open',
      maxTeams: 8,
    },
  ];
  const competitionVersion = signal(0);
  const matches: TournamentMatch[] = [
    {
      id: 'match-1',
      tournamentId: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      startAt: '2026-11-24T18:00',
      endAt: '2026-11-24T19:00',
      location: 'Lyon - Gymnase A',
      homeScore: null,
      awayScore: null,
      playerPoints: {},
    },
  ];
  const tournamentServiceStub = {
    competitionVersion: competitionVersion.asReadonly(),
    getPublicTournaments: () => tournaments,
    getPublicMatches: () => [...matches],
    getFollowedTournamentIds: () => [],
    getTeamName: (teamId: string) => teamId === 'team-1' ? 'Les Aigles' : 'Les Lions',
    getTournamentName: () => 'Coupe régionale',
  };

  beforeEach(async () => {
    competitionVersion.set(0);
    await TestBed.configureTestingModule({
      imports: [SpectatorSpace],
      providers: [{ provide: TournamentService, useValue: tournamentServiceStub }],
    }).compileComponents();
  });

  it('combine recherche, ville, date incluse dans le tournoi et catégorie', () => {
    const fixture = TestBed.createComponent(SpectatorSpace);
    const component = fixture.componentInstance;

    component.searchTerm.set('coupe');
    component.cityFilter.set('lyon');
    component.dateFilter.set('2026-11-25');
    component.sportFilter.set('Basketball');

    expect(component.filteredTournaments().map((tournament) => tournament.id)).toEqual(['tournament-1']);
  });

  it('supprime les filtres et déduplique la liste des catégories', () => {
    const fixture = TestBed.createComponent(SpectatorSpace);
    const component = fixture.componentInstance;
    component.sportFilter.set('Football');
    component.resetFilters();

    expect(component.filteredTournaments()).toHaveLength(3);
    expect(component.sports).toEqual(['Basketball', 'Football', 'Volleyball', 'Handball']);
  });

  it('affiche le score de chaque tournoi et le met à jour quand il change', () => {
    const fixture = TestBed.createComponent(SpectatorSpace);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('—');

    matches[0].homeScore = 42;
    matches[0].awayScore = 39;
    competitionVersion.update((version) => version + 1);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('42 – 39');
  });
});
