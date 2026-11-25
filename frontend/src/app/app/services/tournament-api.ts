import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { Tournament, TournamentInput, TournamentTeam } from './tournament';

interface TournamentsResponse {
  tournaments: Tournament[];
}

interface TeamsResponse {
  teams: TournamentTeam[];
}

interface TournamentResponse {
  tournament: Tournament;
}

interface TeamResponse {
  team: TournamentTeam;
}

export type TeamInput = Pick<TournamentTeam, 'name' | 'capacity'>;

@Injectable({
  providedIn: 'root',
})
export class TournamentApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getMyTournaments(): Observable<Tournament[]> {
    return this.http.get<TournamentsResponse>(`${this.baseUrl}/tournaments/mine`)
      .pipe(map((response) => response.tournaments));
  }

  createTournament(input: TournamentInput): Observable<Tournament> {
    return this.http.post<TournamentResponse>(`${this.baseUrl}/tournaments`, input)
      .pipe(map((response) => response.tournament));
  }

  updateTournament(id: string, input: TournamentInput): Observable<Tournament> {
    return this.http.put<TournamentResponse>(`${this.baseUrl}/tournaments/${id}`, input)
      .pipe(map((response) => response.tournament));
  }

  deleteTournament(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tournaments/${id}`);
  }

  getTeams(tournamentId: string): Observable<TournamentTeam[]> {
    return this.http.get<TeamsResponse>(`${this.baseUrl}/tournaments/${tournamentId}/teams`)
      .pipe(map((response) => response.teams));
  }

  createTeam(tournamentId: string, input: TeamInput): Observable<TournamentTeam> {
    return this.http.post<TeamResponse>(`${this.baseUrl}/tournaments/${tournamentId}/teams`, input)
      .pipe(map((response) => response.team));
  }

  updateTeam(teamId: string, input: TeamInput): Observable<TournamentTeam> {
    return this.http.put<TeamResponse>(`${this.baseUrl}/tournaments/teams/${teamId}`, input)
      .pipe(map((response) => response.team));
  }

  deleteTeam(teamId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tournaments/teams/${teamId}`);
  }
}
