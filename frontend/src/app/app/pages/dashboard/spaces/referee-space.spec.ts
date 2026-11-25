import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TournamentMatch, TournamentService } from '../../../services/tournament';
import { RefereeSpace } from './referee-space';

describe('RefereeSpace', () => {
  const competitionVersion = signal(0);
  const matches: TournamentMatch[] = [
    {
      id: 'match-1',
      tournamentId: 'tournament-1',
      ownerEmail: 'organizer@example.com',
      refereeEmail: 'referee@example.com',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      startAt: '2026-12-10T09:00',
      endAt: '2026-12-10T10:00',
      location: 'Terrain 1',
      homeScore: null,
      awayScore: null,
      playerPoints: {},
    },
  ];
  const tournamentServiceStub = {
    competitionVersion: competitionVersion.asReadonly(),
    getRefereeMatches: () => [...matches],
    getTournamentName: () => 'Coupe régionale',
    getTeamName: (teamId: string) => teamId === 'team-1' ? 'Les Aigles' : 'Les Lions',
  };

  beforeEach(async () => {
    competitionVersion.set(0);
    await TestBed.configureTestingModule({
      imports: [RefereeSpace],
      providers: [{ provide: TournamentService, useValue: tournamentServiceStub }],
    }).compileComponents();
  });

  it('affiche les matchs attribués au compte arbitre', () => {
    const fixture = TestBed.createComponent(RefereeSpace);
    fixture.detectChanges();

    const page = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(page).toContain('Mes désignations');
    expect(page).toContain('Coupe régionale');
    expect(page).toContain('Les Aigles');
    expect(page).toContain('Les Lions');
    expect(page).toContain('—');
  });
});
