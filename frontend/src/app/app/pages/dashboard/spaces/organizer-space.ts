import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Auth } from '../../../services/auth';
import {
  MatchInput,
  TeamJoinRequest,
  Tournament,
  TournamentFormat,
  TournamentMatch,
  TournamentService,
  TournamentStatus,
  TOURNAMENT_SPORTS,
  TournamentTeam,
} from '../../../services/tournament';

@Component({
  selector: 'app-organizer-space',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './organizer-space.html',
})
export class OrganizerSpace {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly tournamentService = inject(TournamentService);

  readonly tournamentForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    sport: ['', [Validators.required, Validators.maxLength(50)]],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    location: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(1000)],
    rules: ['', Validators.maxLength(2000)],
    format: this.formBuilder.nonNullable.control<TournamentFormat>('elimination'),
    status: this.formBuilder.nonNullable.control<TournamentStatus>('open'),
    maxTeams: [16, [Validators.required, Validators.min(2), Validators.max(100)]],
  });
  readonly sports: readonly string[] = TOURNAMENT_SPORTS;
  readonly teamForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    capacity: [8, [Validators.required, Validators.min(2), Validators.max(100)]],
  });
  readonly matchForm = this.formBuilder.nonNullable.group({
    homeTeamId: ['', Validators.required],
    awayTeamId: ['', Validators.required],
    startAt: ['', Validators.required],
    endAt: ['', Validators.required],
    location: ['', [Validators.required, Validators.maxLength(100)]],
    refereeEmail: [''],
  });
  readonly referees = signal(this.auth.getArbitres());
  readonly tournaments = signal(this.tournamentService.getMyTournaments());
  readonly showTournamentForm = signal(false);
  readonly editingTournamentId = signal<string | null>(null);
  readonly showTeamFormFor = signal<string | null>(null);
  readonly showMatchFormFor = signal<string | null>(null);
  readonly editingMatchId = signal<string | null>(null);
  readonly message = signal('');
  readonly error = signal('');
  readonly activeTournaments = computed(() =>
    this.tournaments().filter((tournament) => this.getTournamentPhase(tournament) === 'En cours').length,
  );
  readonly upcomingTournaments = computed(() =>
    this.tournaments().filter((tournament) => this.getTournamentPhase(tournament) === 'À venir').length,
  );
  readonly completedTournaments = computed(() =>
    this.tournaments().filter((tournament) => this.getTournamentPhase(tournament) === 'Terminé').length,
  );
  readonly draftTournaments = computed(() =>
    this.tournaments().filter((tournament) => tournament.status === 'draft').length,
  );
  readonly registeredPlayers = computed(() =>
    this.tournaments().reduce(
      (total, tournament) => total + this.getTeams(tournament.id)
        .reduce((teamTotal, team) => teamTotal + team.memberEmails.length, 0),
      0,
    ),
  );
  readonly teamCount = computed(() =>
    this.tournaments().reduce(
      (total, tournament) => total + this.getTeams(tournament.id).length,
      0,
    ),
  );
  readonly playedMatches = computed(() =>
    this.tournaments().reduce(
      (total, tournament) => total + this.getMatches(tournament.id)
        .filter((match) => match.homeScore !== null && match.awayScore !== null).length,
      0,
    ),
  );
  readonly simulatedRevenue = 0;
  readonly matchProgress = computed(() => this.tournaments().map((tournament) => {
    const matches = this.getMatches(tournament.id);
    const played = matches.filter((match) => match.homeScore !== null && match.awayScore !== null).length;

    return {
      id: tournament.id,
      name: tournament.name,
      played,
      total: matches.length,
      percentage: matches.length === 0 ? 0 : Math.round((played / matches.length) * 100),
    };
  }));
  readonly pendingRegistrations = computed(() =>
    this.tournaments().reduce(
      (total, tournament) => total + this.getJoinRequests(tournament.id)
        .filter((request) => request.status === 'pending').length,
      0,
    ));
  readonly matchesToday = computed(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return this.tournaments().reduce(
      (total, tournament) => total + this.getMatches(tournament.id)
        .filter((match) => match.startAt.slice(0, 10) === today).length,
      0,
    );
  });
  readonly matchesWithoutScore = computed(() => this.tournaments().reduce(
      (total, tournament) => total + this.getMatches(tournament.id)
        .filter((match) => match.homeScore === null || match.awayScore === null).length,
      0,
    ));

  openCreateTournament(): void {
    this.editingTournamentId.set(null);
    this.tournamentForm.reset({
      name: '',
      sport: '',
      startDate: '',
      endDate: '',
      location: '',
      description: '',
      rules: '',
      format: 'elimination',
      status: 'open',
      maxTeams: 16,
    });
    this.message.set('');
    this.error.set('');
    this.showTournamentForm.set(true);
  }

  editTournament(tournament: Tournament): void {
    this.editingTournamentId.set(tournament.id);
    this.tournamentForm.reset({
      name: tournament.name,
      sport: tournament.sport,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      location: tournament.location,
      description: tournament.description,
      rules: tournament.rules,
      format: tournament.format,
      status: tournament.status,
      maxTeams: tournament.maxTeams,
    });
    this.message.set('');
    this.error.set('');
    this.showTournamentForm.set(true);
  }

  closeTournamentForm(): void {
    this.showTournamentForm.set(false);
    this.editingTournamentId.set(null);
    this.tournamentForm.reset();
    this.error.set('');
  }

  saveTournament(): void {
    this.message.set('');
    this.error.set('');
    this.trimRequired(
      this.tournamentForm.controls.name,
      this.tournamentForm.controls.sport,
      this.tournamentForm.controls.location,
    );
    if (this.tournamentForm.invalid) {
      this.tournamentForm.markAllAsTouched();
      return;
    }

    const values = this.tournamentForm.getRawValue();
    if (values.endDate < values.startDate) {
      this.error.set('La date de fin doit être égale ou postérieure à la date de début.');
      return;
    }

    const input = {
      ...values,
      name: values.name.trim(),
      sport: values.sport.trim(),
      location: values.location.trim(),
      description: values.description.trim(),
      rules: values.rules.trim(),
    };
    const editingId = this.editingTournamentId();
    const saved = editingId
      ? this.tournamentService.updateTournament(editingId, input)
      : this.tournamentService.createTournament(input) !== null;
    if (!saved) {
      this.error.set('Impossible d’enregistrer ce tournoi.');
      return;
    }

    this.refresh();
    this.message.set(editingId ? 'Tournoi modifié.' : 'Tournoi créé.');
    this.closeTournamentForm();
  }

  deleteTournament(id: string): void {
    this.message.set('');
    this.error.set('');
    if (!this.tournamentService.deleteTournament(id)) {
      this.error.set('Impossible de supprimer ce tournoi.');
      return;
    }

    this.refresh();
    this.message.set('Tournoi supprimé avec ses équipes, demandes et matchs.');
  }

  getTeams(tournamentId: string): TournamentTeam[] {
    return this.tournamentService.getTeamsForTournament(tournamentId);
  }

  getJoinRequests(tournamentId: string): TeamJoinRequest[] {
    return this.tournamentService.getJoinRequestsForTournament(tournamentId);
  }

  getMatches(tournamentId: string): TournamentMatch[] {
    return this.tournamentService.getMatchesForTournament(tournamentId);
  }

  getTeamName(teamId: string): string {
    return this.tournamentService.getTeamName(teamId);
  }

  getPlayerPoints(match: TournamentMatch, playerEmail: string): number | null {
    return Object.hasOwn(match.playerPoints, playerEmail)
      ? match.playerPoints[playerEmail]
      : null;
  }

  openTeamForm(tournamentId: string): void {
    this.teamForm.reset({ name: '', capacity: 8 });
    this.showTeamFormFor.set(tournamentId);
  }

  createTeam(tournamentId: string): void {
    this.trimRequired(this.teamForm.controls.name);
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    const { name, capacity } = this.teamForm.getRawValue();
    if (!this.tournamentService.createTeam(tournamentId, name.trim(), capacity)) {
      this.error.set('Impossible de créer cette équipe. Vérifiez le nombre maximal d’équipes du tournoi.');
      return;
    }

    this.refresh();
    this.showTeamFormFor.set(null);
    this.error.set('');
    this.message.set('Équipe créée.');
  }

  deleteTeam(team: TournamentTeam): void {
    if (!this.tournamentService.deleteTeam(team.id)) {
      this.error.set('Cette équipe ne peut pas être supprimée car elle participe déjà à un match.');
      return;
    }
    this.refresh();
    this.error.set('');
    this.message.set('Équipe supprimée.');
  }

  removePlayer(team: TournamentTeam, playerEmail: string): void {
    if (!this.tournamentService.removePlayerFromTeam(team.id, playerEmail)) {
      this.error.set('Impossible de retirer ce joueur de l’équipe.');
      return;
    }

    this.refresh();
    this.error.set('');
    this.message.set(`${playerEmail} a été retiré de ${team.name}.`);
  }

  reviewRegistration(request: TeamJoinRequest, approved: boolean): void {
    const success = this.tournamentService.reviewJoinRequest(request.id, approved);
    if (!success) {
      this.error.set('Impossible de traiter cette demande. Vérifiez la capacité de l’équipe.');
      return;
    }
    this.refresh();
    this.error.set('');
    this.message.set(approved ? 'Inscription acceptée.' : 'Inscription refusée.');
  }

  openMatchForm(tournamentId: string): void {
    this.referees.set(this.auth.getArbitres());
    this.editingMatchId.set(null);
    this.matchForm.reset({
      homeTeamId: '',
      awayTeamId: '',
      startAt: '',
      endAt: '',
      location: '',
      refereeEmail: '',
    });
    this.showMatchFormFor.set(tournamentId);
  }

  editMatch(match: TournamentMatch): void {
    this.referees.set(this.auth.getArbitres());
    this.editingMatchId.set(match.id);
    this.matchForm.reset({
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      startAt: match.startAt,
      endAt: match.endAt,
      location: match.location,
      refereeEmail: match.refereeEmail ?? '',
    });
    this.showMatchFormFor.set(match.tournamentId);
  }

  saveMatch(tournamentId: string): void {
    this.error.set('');
    this.trimRequired(this.matchForm.controls.location);
    if (this.matchForm.invalid) {
      this.matchForm.markAllAsTouched();
      return;
    }

    const input: MatchInput = {
      ...this.matchForm.getRawValue(),
      location: this.matchForm.controls.location.value.trim(),
      refereeEmail: this.matchForm.controls.refereeEmail.value.trim().toLowerCase(),
    };
    const editingId = this.editingMatchId();
    const success = editingId
      ? this.tournamentService.updateMatchSchedule(editingId, input)
      : this.tournamentService.createMatch(tournamentId, input) !== null;
    if (!success) {
      this.error.set('Match invalide ou conflit d’horaire, d’équipe ou de terrain.');
      return;
    }
    this.refresh();
    this.showMatchFormFor.set(null);
    this.editingMatchId.set(null);
    this.message.set('Calendrier du match enregistré.');
  }

  deleteMatch(match: TournamentMatch): void {
    if (!this.tournamentService.deleteMatch(match.id)) {
      this.error.set('Impossible de supprimer ce match.');
      return;
    }
    this.refresh();
    this.error.set('');
    this.message.set('Match supprimé.');
  }

  updateScore(match: TournamentMatch, side: 'home' | 'away', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const score = value === '' ? null : Number(value);
    if (!this.tournamentService.setMatchScore(match.id, side, score)) {
      this.error.set('Le score doit être un nombre entier positif ou nul.');
      return;
    }
    this.refresh();
    this.error.set('');
    this.message.set('Score enregistré.');
  }

  updatePlayerPoints(match: TournamentMatch, playerEmail: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const points = value === '' ? null : Number(value);
    if (!this.tournamentService.setPlayerPoints(match.id, playerEmail, points)) {
      this.error.set('Les points doivent être un nombre entier positif ou nul.');
      return;
    }
    this.refresh();
    this.error.set('');
    this.message.set('Points du joueur enregistrés.');
  }

  getPlayersForMatch(match: TournamentMatch): string[] {
    const participatingTeamIds = [match.homeTeamId, match.awayTeamId];
    return [...new Set(this.tournaments()
      .flatMap((tournament) => this.getTeams(tournament.id))
      .filter((team) => participatingTeamIds.includes(team.id))
      .flatMap((team) => team.memberEmails))];
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

  formatStatus(status: TournamentStatus): string {
    return {
      draft: 'Brouillon',
      open: 'Inscriptions ouvertes',
      in_progress: 'En cours',
      completed: 'Terminé',
    }[status];
  }

  getTournamentPhase(tournament: Tournament): string {
    const today = this.getLocalDate();
    if (tournament.status === 'completed' || tournament.endDate < today) {
      return 'Terminé';
    }
    if (tournament.status === 'draft') {
      return 'Brouillon';
    }
    if (tournament.status === 'in_progress'
      || (tournament.startDate <= today && tournament.endDate >= today)) {
      return 'En cours';
    }
    return 'À venir';
  }

  formatFormat(format: TournamentFormat): string {
    return {
      elimination: 'Élimination directe',
      league: 'Championnat',
      groups: 'Phases de groupes',
    }[format];
  }

  private refresh(): void {
    this.tournaments.set(this.tournamentService.getMyTournaments());
  }

  private getLocalDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private trimRequired(...controls: Array<{ value: string; setErrors: (errors: Record<string, boolean> | null) => void; markAsTouched: () => void }>): void {
    for (const control of controls) {
      if (!control.value.trim()) {
        control.setErrors({ required: true });
        control.markAsTouched();
      }
    }
  }
}
