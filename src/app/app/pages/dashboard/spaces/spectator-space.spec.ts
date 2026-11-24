import { TestBed } from '@angular/core/testing';

import { Tournament, TournamentService } from '../../../services/tournament';
import { SpectatorSpace } from './spectator-space';

describe('SpectatorSpace', () => {
  const tournaments: Tournament[] = [
    {
      id: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      name: 'Coupe régionale',
      sport: 'Basketball',
      category: 'U15',
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
      sport: 'Basketball',
      category: 'U18',
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
      sport: 'Basketball',
      category: 'U15',
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
  const tournamentServiceStub = {
    getPublicTournaments: () => tournaments,
    getPublicMatches: () => [],
    getFollowedTournamentIds: () => [],
  };

  beforeEach(async () => {
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
    component.categoryFilter.set('U15');

    expect(component.filteredTournaments().map((tournament) => tournament.id)).toEqual(['tournament-1']);
  });

  it('supprime les filtres et déduplique la liste des catégories', () => {
    const fixture = TestBed.createComponent(SpectatorSpace);
    const component = fixture.componentInstance;
    component.categoryFilter.set('U18');
    component.resetFilters();

    expect(component.filteredTournaments()).toHaveLength(3);
    expect(component.categories()).toEqual(['U15', 'U18']);
  });
});
