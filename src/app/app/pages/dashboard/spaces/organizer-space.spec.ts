import { TestBed } from '@angular/core/testing';

import { Auth } from '../../../services/auth';
import { Tournament, TournamentMatch, TournamentTeam, TournamentService } from '../../../services/tournament';
import { OrganizerSpace } from './organizer-space';

describe('OrganizerSpace', () => {
  const tournaments: Tournament[] = [
    {
      id: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      name: 'Coupe régionale',
      sport: 'Basketball',
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      location: 'Gymnase municipal',
      description: '',
      rules: '',
      format: 'groups',
      status: 'open',
      maxTeams: 8,
    },
    {
      id: 'tournament-2',
      ownerEmail: 'organizer@example.com',
      name: 'Tournoi d’hiver',
      sport: 'Basketball',
      startDate: '2026-12-20',
      endDate: '2026-12-22',
      location: 'Gymnase central',
      description: '',
      rules: '',
      format: 'elimination',
      status: 'open',
      maxTeams: 8,
    },
  ];
  const teams: TournamentTeam[] = [
    {
      id: 'team-1',
      tournamentId: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      name: 'Les Aigles',
      capacity: 8,
      memberEmails: [],
    },
    {
      id: 'team-2',
      tournamentId: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      name: 'Les Lions',
      capacity: 8,
      memberEmails: [],
    },
  ];
  const matches: TournamentMatch[] = [
    {
      id: 'match-1',
      tournamentId: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      startAt: '2026-12-10T09:00',
      endAt: '2026-12-10T10:00',
      location: 'Terrain 1',
      homeScore: 52,
      awayScore: 48,
      playerPoints: {},
    },
    {
      id: 'match-2',
      tournamentId: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      startAt: '2026-12-10T10:00',
      endAt: '2026-12-10T11:00',
      location: 'Terrain 1',
      homeScore: null,
      awayScore: null,
      playerPoints: {},
    },
  ];
  const tournamentServiceStub = {
    getMyTournaments: () => tournaments,
    getTeamsForTournament: (tournamentId: string) => teams.filter((team) => team.tournamentId === tournamentId),
    getMatchesForTournament: (tournamentId: string) => matches.filter((match) => match.tournamentId === tournamentId),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizerSpace],
      providers: [
        { provide: Auth, useValue: { getArbitres: () => [] } },
        { provide: TournamentService, useValue: tournamentServiceStub },
      ],
    }).compileComponents();
  });

  it('calcule les équipes, les matchs terminés et la progression par tournoi', () => {
    const fixture = TestBed.createComponent(OrganizerSpace);
    const component = fixture.componentInstance;

    expect(component.teamCount()).toBe(2);
    expect(component.playedMatches()).toBe(1);
    expect(component.matchProgress()).toEqual([
      { id: 'tournament-1', name: 'Coupe régionale', played: 1, total: 2, percentage: 50 },
      { id: 'tournament-2', name: 'Tournoi d’hiver', played: 0, total: 0, percentage: 0 },
    ]);
    expect(component.simulatedRevenue).toBe(0);
  });
});
