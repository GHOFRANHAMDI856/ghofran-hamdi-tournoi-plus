import { Injectable, inject } from '@angular/core';

import { Auth } from './auth';

export type TournamentStatus = 'draft' | 'open' | 'in_progress' | 'completed';
export type TournamentFormat = 'elimination' | 'league' | 'groups';

export interface Tournament {
  id: string;
  ownerEmail: string;
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  rules: string;
  format: TournamentFormat;
  status: TournamentStatus;
  maxTeams: number;
}

removePlayerFromTeam(teamId: string, playerEmail: string): boolean {
  const ownerEmail = this.getOrganizerEmail();
  const data = this.getCompetitionData();
  const team = data.teams.find((item) => item.id === teamId && item.ownerEmail === ownerEmail);
  if (!ownerEmail || !team || !team.memberEmails.includes(playerEmail)) {
    return false;
  }

  team.memberEmails = team.memberEmails.filter((email) => email !== playerEmail);
  this.saveCompetitionData(data);
  return true;
}

export type TournamentInput = Omit<Tournament, 'id' | 'ownerEmail'>;

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  ownerEmail: string;
  name: string;
  capacity: number;
  memberEmails: string[];
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TeamJoinRequest {
  id: string;
  teamId: string;
  playerEmail: string;
  status: JoinRequestStatus;
  reason: string;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  ownerEmail: string;
  homeTeamId: string;
  awayTeamId: string;
  startAt: string;
  endAt: string;
  location: string;
  homeScore: number | null;
  awayScore: number | null;
  playerPoints: Record<string, number>;
}

export interface MatchInput {
  homeTeamId: string;
  awayTeamId: string;
  startAt: string;
  endAt: string;
  location: string;
}

interface FollowedTournaments {
  email: string;
  tournamentIds: string[];
}

interface CompetitionData {
  teams: TournamentTeam[];
  joinRequests: TeamJoinRequest[];
  matches: TournamentMatch[];
  followedTournaments: FollowedTournaments[];
}

@Injectable({
  providedIn: 'root',
})
export class TournamentService {
  private readonly auth = inject(Auth);
  private readonly tournamentsKey = 'gestion-tournoi-tournaments';
  private readonly competitionKey = 'gestion-tournoi-competition';

  getMyTournaments(): Tournament[] {
    const ownerEmail = this.getOrganizerEmail();
    return ownerEmail
      ? this.getAllTournaments().filter((tournament) => tournament.ownerEmail === ownerEmail)
      : [];
  }

  getPublicTournaments(): Tournament[] {
    return this.getAllTournaments().filter((tournament) => tournament.status !== 'draft');
  }

  createTournament(input: TournamentInput): Tournament | null {
    const ownerEmail = this.getOrganizerEmail();
    if (!ownerEmail || !this.isValidTournamentInput(input)) {
      return null;
    }

    const tournament: Tournament = {
      ...input,
      id: crypto.randomUUID(),
      ownerEmail,
    };
    const tournaments = this.getAllTournaments();
    tournaments.push(tournament);
    this.saveTournaments(tournaments);
    return tournament;
  }

  updateTournament(id: string, input: TournamentInput): boolean {
    const ownerEmail = this.getOrganizerEmail();
    if (!ownerEmail) {
      return false;
    }

    const tournaments = this.getAllTournaments();
    const index = tournaments.findIndex(
      (tournament) => tournament.id === id && tournament.ownerEmail === ownerEmail,
    );
    if (
      index < 0
      || !this.isValidTournamentInput(input)
      || input.maxTeams < this.getCompetitionData().teams
        .filter((team) => team.tournamentId === id && team.ownerEmail === ownerEmail).length
    ) {
      return false;
    }

    tournaments[index] = { ...tournaments[index], ...input };
    this.saveTournaments(tournaments);
    return true;
  }

  deleteTournament(id: string): boolean {
    const ownerEmail = this.getOrganizerEmail();
    if (!ownerEmail) {
      return false;
    }

    const tournaments = this.getAllTournaments();
    const remaining = tournaments.filter(
      (tournament) => tournament.id !== id || tournament.ownerEmail !== ownerEmail,
    );
    if (remaining.length === tournaments.length) {
      return false;
    }

    this.saveTournaments(remaining);
    const data = this.getCompetitionData();
    const teamIds = data.teams
      .filter((team) => team.tournamentId === id && team.ownerEmail === ownerEmail)
      .map((team) => team.id);
    data.teams = data.teams.filter((team) => !teamIds.includes(team.id));
    data.joinRequests = data.joinRequests.filter((request) => !teamIds.includes(request.teamId));
    data.matches = data.matches.filter((match) => match.tournamentId !== id || match.ownerEmail !== ownerEmail);
    data.followedTournaments = data.followedTournaments.map((follow) => ({
      ...follow,
      tournamentIds: follow.tournamentIds.filter((tournamentId) => tournamentId !== id),
    }));
    this.saveCompetitionData(data);
    return true;
  }

  createTeam(tournamentId: string, name: string, capacity: number): TournamentTeam | null {
    const ownerEmail = this.getOrganizerEmail();
    const tournament = this.getOwnedTournament(tournamentId, ownerEmail);
    const normalizedName = name.trim();
    if (
      !ownerEmail
      || !tournament
      || tournament.status === 'completed'
      || !normalizedName
      || !Number.isInteger(capacity)
      || capacity < 2
      || capacity > 100
    ) {
      return null;
    }

    const data = this.getCompetitionData();
    const teams = data.teams.filter((team) => team.tournamentId === tournamentId);
    if (
      teams.length >= tournament.maxTeams
      || teams.some((team) => team.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())
    ) {
      return null;
    }

    const team: TournamentTeam = {
      id: crypto.randomUUID(),
      tournamentId,
      ownerEmail,
      name: normalizedName,
      capacity,
      memberEmails: [],
    };
    data.teams.push(team);
    this.saveCompetitionData(data);
    return team;
  }

  getTeamsForTournament(tournamentId: string): TournamentTeam[] {
    const ownerEmail = this.getOrganizerEmail();
    return ownerEmail && this.getOwnedTournament(tournamentId, ownerEmail)
      ? this.getCompetitionData().teams.filter(
        (team) => team.tournamentId === tournamentId && team.ownerEmail === ownerEmail,
      )
      : [];
  }

  deleteTeam(teamId: string): boolean {
    const ownerEmail = this.getOrganizerEmail();
    const data = this.getCompetitionData();
    const team = data.teams.find((item) => item.id === teamId && item.ownerEmail === ownerEmail);
    if (!ownerEmail || !team || data.matches.some(
      (match) => match.homeTeamId === teamId || match.awayTeamId === teamId,
    )) {
      return false;
    }

    data.teams = data.teams.filter((item) => item.id !== teamId);
    data.joinRequests = data.joinRequests.filter((request) => request.teamId !== teamId);
    this.saveCompetitionData(data);
    return true;
  }

  getTeamDirectory(): Array<{ team: TournamentTeam; tournament: Tournament }> {
    const playerEmail = this.getPlayerEmail();
    if (!playerEmail) {
      return [];
    }

    const data = this.getCompetitionData();
    const tournaments = this.getPublicTournaments().filter((tournament) => tournament.status === 'open');
    return tournaments.flatMap((tournament) =>
      data.teams
        .filter((team) => team.tournamentId === tournament.id && team.memberEmails.length < team.capacity)
        .filter((team) => !team.memberEmails.includes(playerEmail))
        .filter((team) => !data.joinRequests.some(
          (request) => request.teamId === team.id
            && request.playerEmail === playerEmail
            && request.status === 'pending',
        ))
        .map((team) => ({ team, tournament })),
    );
  }

  requestToJoin(teamId: string): TeamJoinRequest | null {
    const playerEmail = this.getPlayerEmail();
    const data = this.getCompetitionData();
    const team = data.teams.find((item) => item.id === teamId);
    const tournament = team ? this.getPublicTournaments().find((item) => item.id === team.tournamentId) : null;
    if (
      !playerEmail
      || !team
      || !tournament
      || tournament.status !== 'open'
      || team.memberEmails.length >= team.capacity
      || team.memberEmails.includes(playerEmail)
      || data.joinRequests.some(
        (request) => request.teamId === teamId
          && request.playerEmail === playerEmail
          && request.status !== 'rejected',
      )
      || data.teams.some(
        (item) => item.tournamentId === team.tournamentId && item.memberEmails.includes(playerEmail),
      )
    ) {
      return null;
    }

    const request: TeamJoinRequest = {
      id: crypto.randomUUID(),
      teamId,
      playerEmail,
      status: 'pending',
      reason: '',
    };
    data.joinRequests.push(request);
    this.saveCompetitionData(data);
    return request;
  }

  getMyJoinRequests(): TeamJoinRequest[] {
    const playerEmail = this.getPlayerEmail();
    return playerEmail
      ? this.getCompetitionData().joinRequests.filter((request) => request.playerEmail === playerEmail)
      : [];
  }

  getJoinRequestsForTournament(tournamentId: string): TeamJoinRequest[] {
    const ownerEmail = this.getOrganizerEmail();
    if (!ownerEmail || !this.getOwnedTournament(tournamentId, ownerEmail)) {
      return [];
    }

    const data = this.getCompetitionData();
    const teamIds = data.teams
      .filter((team) => team.tournamentId === tournamentId && team.ownerEmail === ownerEmail)
      .map((team) => team.id);
    return data.joinRequests.filter((request) => teamIds.includes(request.teamId));
  }

  reviewJoinRequest(requestId: string, approved: boolean, reason = ''): boolean {
    const ownerEmail = this.getOrganizerEmail();
    const data = this.getCompetitionData();
    const request = data.joinRequests.find((item) => item.id === requestId && item.status === 'pending');
    const team = request
      ? data.teams.find((item) => item.id === request.teamId && item.ownerEmail === ownerEmail)
      : null;
    const tournament = team ? this.getOwnedTournament(team.tournamentId, ownerEmail) : null;
    if (!ownerEmail || !request || !team || !tournament || tournament.status !== 'open') {
      return false;
    }

    if (approved) {
      const alreadyInTournament = data.teams.some(
        (item) => item.tournamentId === team.tournamentId && item.memberEmails.includes(request.playerEmail),
      );
      if (alreadyInTournament || team.memberEmails.length >= team.capacity) {
        return false;
      }

      team.memberEmails.push(request.playerEmail);
    }

    request.status = approved ? 'approved' : 'rejected';
    request.reason = reason.trim();
    this.saveCompetitionData(data);
    return true;
  }

  getMyTeams(): TournamentTeam[] {
    const playerEmail = this.getPlayerEmail();
    return playerEmail
      ? this.getCompetitionData().teams.filter((team) => team.memberEmails.includes(playerEmail))
      : [];
  }

  createMatch(tournamentId: string, input: MatchInput): TournamentMatch | null {
    const ownerEmail = this.getOrganizerEmail();
    const tournament = this.getOwnedTournament(tournamentId, ownerEmail);
    if (!ownerEmail || !tournament || tournament.status === 'completed') {
      return null;
    }

    const data = this.getCompetitionData();
    if (!this.isValidMatchInput(tournamentId, input, data)) {
      return null;
    }

    const match: TournamentMatch = {
      ...input,
      id: crypto.randomUUID(),
      tournamentId,
      ownerEmail,
      homeScore: null,
      awayScore: null,
      playerPoints: {},
    };
    data.matches.push(match);
    this.saveCompetitionData(data);
    return match;
  }

  updateMatchSchedule(matchId: string, input: MatchInput): boolean {
    const ownerEmail = this.getOrganizerEmail();
    const data = this.getCompetitionData();
    const match = data.matches.find((item) => item.id === matchId && item.ownerEmail === ownerEmail);
    if (!ownerEmail || !match || !this.getOwnedTournament(match.tournamentId, ownerEmail)) {
      return false;
    }

    if (!this.isValidMatchInput(match.tournamentId, input, data, matchId)) {
      return false;
    }

    Object.assign(match, input);
    this.saveCompetitionData(data);
    return true;
  }

  getMatchesForTournament(tournamentId: string): TournamentMatch[] {
    const ownerEmail = this.getOrganizerEmail();
    return ownerEmail && this.getOwnedTournament(tournamentId, ownerEmail)
      ? this.getCompetitionData().matches.filter(
        (match) => match.tournamentId === tournamentId && match.ownerEmail === ownerEmail,
      )
      : [];
  }

  getPlayerMatches(): TournamentMatch[] {
    const playerEmail = this.getPlayerEmail();
    if (!playerEmail) {
      return [];
    }

    const teamIds = this.getMyTeams().map((team) => team.id);
    return this.getCompetitionData().matches.filter(
      (match) => teamIds.includes(match.homeTeamId) || teamIds.includes(match.awayTeamId),
    );
  }

  getPublicMatches(): TournamentMatch[] {
    const tournamentIds = this.getPublicTournaments().map((tournament) => tournament.id);
    return this.getCompetitionData().matches.filter((match) => tournamentIds.includes(match.tournamentId));
  }

  deleteMatch(matchId: string): boolean {
    const ownerEmail = this.getOrganizerEmail();
    const data = this.getCompetitionData();
    const remaining = data.matches.filter(
      (match) => match.id !== matchId || match.ownerEmail !== ownerEmail,
    );
    if (!ownerEmail || remaining.length === data.matches.length) {
      return false;
    }

    data.matches = remaining;
    this.saveCompetitionData(data);
    return true;
  }

  setMatchScore(matchId: string, side: 'home' | 'away', score: number | null): boolean {
    const ownerEmail = this.getOrganizerEmail();
    const data = this.getCompetitionData();
    const match = data.matches.find((item) => item.id === matchId && item.ownerEmail === ownerEmail);
    if (!ownerEmail || !match || !this.getOwnedTournament(match.tournamentId, ownerEmail)) {
      return false;
    }
    if (score !== null && (!Number.isInteger(score) || score < 0)) {
      return false;
    }

    match[side === 'home' ? 'homeScore' : 'awayScore'] = score;
    this.saveCompetitionData(data);
    return true;
  }

  setPlayerPoints(matchId: string, playerEmail: string, points: number | null): boolean {
    const ownerEmail = this.getOrganizerEmail();
    const data = this.getCompetitionData();
    const match = data.matches.find((item) => item.id === matchId && item.ownerEmail === ownerEmail);
    const isParticipant = match && data.teams.some(
      (team) => (team.id === match.homeTeamId || team.id === match.awayTeamId)
        && team.memberEmails.includes(playerEmail),
    );
    if (
      !ownerEmail
      || !match
      || !isParticipant
      || (points !== null && (!Number.isInteger(points) || points < 0))
    ) {
      return false;
    }

    if (points === null) {
      delete match.playerPoints[playerEmail];
    } else {
      match.playerPoints[playerEmail] = points;
    }
    this.saveCompetitionData(data);
    return true;
  }

  getPlayerPoints(matchId: string, playerEmail: string): number | null {
    const player = this.auth.getCurrentUser();
    const matches = this.getPlayerMatches();
    if (
      player?.role !== 'joueur'
      || player.email !== playerEmail
      || !matches.some((match) => match.id === matchId)
    ) {
      return null;
    }

    return this.getCompetitionData().matches.find((match) => match.id === matchId)
      ?.playerPoints[playerEmail] ?? null;
  }

  getFollowedTournamentIds(): string[] {
    const spectatorEmail = this.getSpectatorEmail();
    if (!spectatorEmail) {
      return [];
    }

    return this.getCompetitionData().followedTournaments
      .find((follow) => follow.email === spectatorEmail)?.tournamentIds ?? [];
  }

  toggleFollowTournament(tournamentId: string): boolean {
    const spectatorEmail = this.getSpectatorEmail();
    const tournament = this.getPublicTournaments().find((item) => item.id === tournamentId);
    if (!spectatorEmail || !tournament) {
      return false;
    }

    const data = this.getCompetitionData();
    let follow = data.followedTournaments.find((item) => item.email === spectatorEmail);
    if (!follow) {
      follow = { email: spectatorEmail, tournamentIds: [] };
      data.followedTournaments.push(follow);
    }

    follow.tournamentIds = follow.tournamentIds.includes(tournamentId)
      ? follow.tournamentIds.filter((id) => id !== tournamentId)
      : [...follow.tournamentIds, tournamentId];
    this.saveCompetitionData(data);
    return true;
  }

  getTeamName(teamId: string): string {
    return this.getCompetitionData().teams.find((team) => team.id === teamId)?.name ?? 'Équipe supprimée';
  }

  getTournamentName(tournamentId: string): string {
    return this.getAllTournaments().find((tournament) => tournament.id === tournamentId)?.name
      ?? 'Tournoi supprimé';
  }

  private getOrganizerEmail(): string | null {
    const user = this.auth.getCurrentUser();
    return user?.role === 'organisateur' ? user.email : null;
  }

  private getPlayerEmail(): string | null {
    const user = this.auth.getCurrentUser();
    return user?.role === 'joueur' ? user.email : null;
  }

  private getSpectatorEmail(): string | null {
    const user = this.auth.getCurrentUser();
    return user?.role === 'spectateur' ? user.email : null;
  }

  private getOwnedTournament(tournamentId: string, ownerEmail: string | null): Tournament | null {
    return ownerEmail
      ? this.getAllTournaments().find(
        (tournament) => tournament.id === tournamentId && tournament.ownerEmail === ownerEmail,
      ) ?? null
      : null;
  }

  private getAllTournaments(): Tournament[] {
    const savedTournaments = localStorage.getItem(this.tournamentsKey);
    const tournaments = savedTournaments
      ? JSON.parse(savedTournaments) as Array<Partial<Tournament> & { date?: string }>
      : [];
    return tournaments.map((tournament): Tournament => ({
      ...tournament,
      startDate: tournament.startDate ?? tournament.date ?? '',
      endDate: tournament.endDate ?? tournament.date ?? '',
      format: tournament.format ?? 'elimination',
      status: tournament.status ?? 'open',
      maxTeams: tournament.maxTeams ?? 16,
    } as Tournament));
  }

  private saveTournaments(tournaments: Tournament[]): void {
    localStorage.setItem(this.tournamentsKey, JSON.stringify(tournaments));
  }

  private getCompetitionData(): CompetitionData {
    const savedData = localStorage.getItem(this.competitionKey);
    if (!savedData) {
      return { teams: [], joinRequests: [], matches: [], followedTournaments: [] };
    }

    const data = JSON.parse(savedData) as Partial<CompetitionData>;
    return {
      teams: data.teams ?? [],
      joinRequests: data.joinRequests ?? [],
      matches: data.matches ?? [],
      followedTournaments: data.followedTournaments ?? [],
    };
  }

  private saveCompetitionData(data: CompetitionData): void {
    localStorage.setItem(this.competitionKey, JSON.stringify(data));
  }

  private isValidMatchInput(
    tournamentId: string,
    input: MatchInput,
    data: CompetitionData,
    exceptMatchId?: string,
  ): boolean {
    if (
      !input.homeTeamId
      || !input.awayTeamId
      || input.homeTeamId === input.awayTeamId
      || !input.startAt
      || !input.endAt
      || new Date(input.startAt).getTime() >= new Date(input.endAt).getTime()
      || !input.location.trim()
    ) {
      return false;
    }

    const teams = data.teams.filter(
      (team) => team.tournamentId === tournamentId && team.ownerEmail === this.getOrganizerEmail(),
    );
    if (
      !teams.some((team) => team.id === input.homeTeamId)
      || !teams.some((team) => team.id === input.awayTeamId)
    ) {
      return false;
    }

    const start = new Date(input.startAt).getTime();
    const end = new Date(input.endAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return false;
    }
    return !data.matches.some((match) => {
      if (match.id === exceptMatchId || match.tournamentId !== tournamentId) {
        return false;
      }

      const conflicts = match.homeTeamId === input.homeTeamId
        || match.awayTeamId === input.homeTeamId
        || match.homeTeamId === input.awayTeamId
        || match.awayTeamId === input.awayTeamId
        || match.location.toLocaleLowerCase() === input.location.trim().toLocaleLowerCase();
      const matchStart = new Date(match.startAt).getTime();
      const matchEnd = new Date(match.endAt).getTime();
      return conflicts && start < matchEnd && matchStart < end;
    });
  }

  private isValidTournamentInput(input: TournamentInput): boolean {
    const start = new Date(`${input.startDate}T00:00:00`).getTime();
    const end = new Date(`${input.endDate}T00:00:00`).getTime();
    return Boolean(
      input.name.trim()
      && input.sport.trim()
      && input.location.trim()
      && Number.isFinite(start)
      && Number.isFinite(end)
      && end >= start
      && Number.isInteger(input.maxTeams)
      && input.maxTeams >= 2
      && input.maxTeams <= 100
    );
  }
}
