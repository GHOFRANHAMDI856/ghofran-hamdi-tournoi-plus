import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Tournament, TournamentInput } from './tournament';
import { TournamentApi } from './tournament-api';

describe('TournamentApi', () => {
  let api: TournamentApi;
  let http: HttpTestingController;

  const input: TournamentInput = {
    name: 'Coupe régionale',
    sport: 'Football',
    startDate: '2026-12-10',
    endDate: '2026-12-12',
    location: 'Stade municipal',
    description: '',
    rules: '',
    format: 'elimination',
    status: 'open',
    maxTeams: 8,
  };
  const tournament: Tournament = {
    ...input,
    id: 'tournament-1',
    ownerEmail: 'organizer@example.com',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TournamentApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the REST API for tournament list and full CRUD', () => {
    api.getMyTournaments().subscribe((result) => expect(result).toEqual([tournament]));
    http.expectOne('/api/tournaments/mine').flush({ tournaments: [tournament] });

    api.createTournament(input).subscribe((result) => expect(result).toEqual(tournament));
    const create = http.expectOne('/api/tournaments');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(input);
    create.flush({ tournament });

    api.updateTournament(tournament.id, input).subscribe((result) => expect(result).toEqual(tournament));
    const update = http.expectOne('/api/tournaments/tournament-1');
    expect(update.request.method).toBe('PUT');
    update.flush({ tournament });

    api.deleteTournament(tournament.id).subscribe();
    const remove = http.expectOne('/api/tournaments/tournament-1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('uses the REST API for team list and full CRUD', () => {
    const team = {
      id: 'team-1',
      tournamentId: tournament.id,
      ownerEmail: tournament.ownerEmail,
      name: 'Les Aigles',
      capacity: 8,
      memberEmails: [],
    };

    api.getTeams(tournament.id).subscribe((result) => expect(result).toEqual([team]));
    http.expectOne('/api/tournaments/tournament-1/teams').flush({ teams: [team] });

    api.createTeam(tournament.id, { name: team.name, capacity: team.capacity })
      .subscribe((result) => expect(result).toEqual(team));
    const create = http.expectOne('/api/tournaments/tournament-1/teams');
    expect(create.request.method).toBe('POST');
    create.flush({ team });

    api.updateTeam(team.id, { name: 'Les Lions', capacity: 10 }).subscribe((result) => {
      expect(result.name).toBe('Les Lions');
    });
    const update = http.expectOne('/api/tournaments/teams/team-1');
    expect(update.request.method).toBe('PUT');
    update.flush({ team: { ...team, name: 'Les Lions', capacity: 10 } });

    api.deleteTeam(team.id).subscribe();
    const remove = http.expectOne('/api/tournaments/teams/team-1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
