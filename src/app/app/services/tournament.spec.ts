import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';
import { MatchInput, TournamentInput, TournamentService } from './tournament';

describe('TournamentService', () => {
  let auth: Auth;
  let service: TournamentService;
  const tournamentInput: TournamentInput = {
    name: 'Coupe régionale',
    sport: 'Football',
    startDate: '2026-12-10',
    endDate: '2026-12-12',
    location: 'Stade municipal',
    description: 'Compétition locale',
    rules: 'Matchs en deux périodes.',
    format: 'elimination',
    status: 'open',
    maxTeams: 8,
  };
  const matchInput: MatchInput = {
    homeTeamId: '',
    awayTeamId: '',
    startAt: '2026-12-10T09:00',
    endAt: '2026-12-10T10:00',
    location: 'Terrain 1',
  };

  beforeEach(() => {
    localStorage.removeItem('gestion-tournoi-session');
    localStorage.removeItem('gestion-tournoi-users');
    localStorage.removeItem('gestion-tournoi-tournaments');
    localStorage.removeItem('gestion-tournoi-competition');
    TestBed.configureTestingModule({});
    auth = TestBed.inject(Auth);
    service = TestBed.inject(TournamentService);
  });

  afterEach(() => {
    localStorage.removeItem('gestion-tournoi-session');
    localStorage.removeItem('gestion-tournoi-users');
    localStorage.removeItem('gestion-tournoi-tournaments');
    localStorage.removeItem('gestion-tournoi-competition');
  });

  it('creates, updates, and deletes tournaments for their organizer', () => {
    auth.register('Organizer One', 'one@example.com', 'password123', 'organisateur');
    const tournament = service.createTournament(tournamentInput);

    expect(tournament?.ownerEmail).toBe('one@example.com');
    expect(service.getMyTournaments()).toEqual([tournament]);

    expect(service.updateTournament(tournament!.id, { ...tournamentInput, name: 'Coupe nationale' })).toBe(true);
    expect(service.getMyTournaments()[0].name).toBe('Coupe nationale');
    expect(service.deleteTournament(tournament!.id)).toBe(true);
    expect(service.getMyTournaments()).toEqual([]);
  });

  it('keeps tournament management private to its organizer', () => {
    auth.register('Organizer One', 'one@example.com', 'password123', 'organisateur');
    const tournament = service.createTournament(tournamentInput)!;

    auth.register('Organizer Two', 'two@example.com', 'password123', 'organisateur');
    expect(service.getMyTournaments()).toEqual([]);
    expect(service.updateTournament(tournament.id, tournamentInput)).toBe(false);
    expect(service.deleteTournament(tournament.id)).toBe(false);

    auth.register('Player', 'player@example.com', 'password123', 'joueur');
    expect(service.getMyTournaments()).toEqual([]);
    expect(service.createTournament(tournamentInput)).toBeNull();
  });

  it('handles player join requests, organizer decisions, results, and personal points', () => {
    auth.register('Organizer', 'organizer@example.com', 'password123', 'organisateur');
    const tournament = service.createTournament(tournamentInput)!;
    const homeTeam = service.createTeam(tournament.id, 'Les Aigles', 5)!;
    const awayTeam = service.createTeam(tournament.id, 'Les Lions', 5)!;

    auth.register('Player One', 'player@example.com', 'password123', 'joueur');
    expect(service.getTeamDirectory()).toHaveLength(2);
    const request = service.requestToJoin(homeTeam.id)!;
    expect(service.getMyJoinRequests()).toEqual([request]);

    auth.login('organizer@example.com', 'password123');
    expect(service.reviewJoinRequest(request.id, true)).toBe(true);
    const match = service.createMatch(tournament.id, {
      ...matchInput,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
    })!;
    expect(match).toBeTruthy();
    expect(service.setMatchScore(match.id, 'home', 3)).toBe(true);
    expect(service.setMatchScore(match.id, 'away', 1)).toBe(true);
    expect(service.setPlayerPoints(match.id, 'player@example.com', 2)).toBe(true);

    auth.login('player@example.com', 'password123');
    expect(service.getMyTeams().map((team) => team.id)).toEqual([homeTeam.id]);
    expect(service.getPlayerMatches().map((item) => item.id)).toEqual([match.id]);
    expect(service.getPlayerPoints(match.id, 'player@example.com')).toBe(2);
    expect(service.getPlayerPoints(match.id, 'other@example.com')).toBeNull();
  });

  it('does not allow overlapping matches for a team or a venue', () => {
    auth.register('Organizer', 'organizer@example.com', 'password123', 'organisateur');
    const tournament = service.createTournament(tournamentInput)!;
    const firstTeam = service.createTeam(tournament.id, 'A', 5)!;
    const secondTeam = service.createTeam(tournament.id, 'B', 5)!;
    const thirdTeam = service.createTeam(tournament.id, 'C', 5)!;
    const firstMatch = service.createMatch(tournament.id, {
      ...matchInput,
      homeTeamId: firstTeam.id,
      awayTeamId: secondTeam.id,
    });

    expect(firstMatch).toBeTruthy();
    expect(service.createMatch(tournament.id, {
      ...matchInput,
      homeTeamId: firstTeam.id,
      awayTeamId: thirdTeam.id,
    })).toBeNull();
    expect(service.createMatch(tournament.id, {
      ...matchInput,
      homeTeamId: thirdTeam.id,
      awayTeamId: secondTeam.id,
    })).toBeNull();
  });

  it('lets spectators follow public tournaments but not change competition data', () => {
    auth.register('Organizer', 'organizer@example.com', 'password123', 'organisateur');
    const tournament = service.createTournament(tournamentInput)!;
    const homeTeam = service.createTeam(tournament.id, 'A', 5)!;
    const awayTeam = service.createTeam(tournament.id, 'B', 5)!;
    const match = service.createMatch(tournament.id, {
      ...matchInput,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
    })!;

    auth.register('Spectator', 'spectator@example.com', 'password123', 'spectateur');
    expect(service.getPublicMatches()).toEqual([match]);
    expect(service.toggleFollowTournament(tournament.id)).toBe(true);
    expect(service.getFollowedTournamentIds()).toEqual([tournament.id]);
    expect(service.createTeam(tournament.id, 'C', 5)).toBeNull();
  });
});
