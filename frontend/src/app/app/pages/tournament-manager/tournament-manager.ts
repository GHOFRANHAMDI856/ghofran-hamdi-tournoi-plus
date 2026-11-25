import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Tournament, TournamentFormat, TournamentStatus, TournamentTeam, TOURNAMENT_SPORTS } from '../../services/tournament';
import { TeamInput, TournamentApi } from '../../services/tournament-api';
import { TournamentList } from '../../components/tournament-list/tournament-list';

const dateRangeValidator: ValidatorFn = (control): ValidationErrors | null => {
  const startDate = control.get('startDate')?.value as string | undefined;
  const endDate = control.get('endDate')?.value as string | undefined;
  return startDate && endDate && endDate < startDate ? { invalidDateRange: true } : null;
};

@Component({
  selector: 'app-tournament-manager',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TournamentList],
  templateUrl: './tournament-manager.html',
  styleUrl: './tournament-manager.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentManager implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(TournamentApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly sports: readonly string[] = TOURNAMENT_SPORTS;
  readonly tournaments = signal<Tournament[]>([]);
  readonly teams = signal<TournamentTeam[]>([]);
  readonly selectedTournament = signal<Tournament | null>(null);
  readonly editingTournamentId = signal<string | null>(null);
  readonly editingTeamId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  readonly tournamentForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    sport: ['', [Validators.required, Validators.maxLength(80)]],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    location: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(2000)],
    rules: ['', Validators.maxLength(5000)],
    format: this.formBuilder.nonNullable.control<TournamentFormat>('elimination'),
    status: this.formBuilder.nonNullable.control<TournamentStatus>('open'),
    maxTeams: [8, [Validators.required, Validators.min(2), Validators.max(100)]],
  }, { validators: [dateRangeValidator] });

  readonly teamForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    capacity: [8, [Validators.required, Validators.min(2), Validators.max(100)]],
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tournamentId = params.get('tournamentId');
      const tournament = this.tournaments().find((item) => item.id === tournamentId);
      if (tournament && tournament.id !== this.selectedTournament()?.id) {
        this.selectedTournament.set(tournament);
        this.loadTeams();
      }
    });
    this.loadTournaments();
  }

  loadTournaments(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getMyTournaments().subscribe({
      next: (tournaments) => {
        this.tournaments.set(tournaments);
        const routeId = this.route.snapshot.paramMap.get('tournamentId');
        const selected = tournaments.find((item) => item.id === routeId)
          ?? tournaments.find((item) => item.id === this.selectedTournament()?.id)
          ?? tournaments[0]
          ?? null;
        this.selectedTournament.set(selected);
        this.loading.set(false);
        this.loadTeams();
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.showError(error);
      },
    });
  }

  selectTournament(tournament: Tournament): void {
    this.selectedTournament.set(tournament);
    this.teams.set([]);
    void this.router.navigate(['/gestion/tournois-api', tournament.id]);
    this.loadTeams();
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
  }

  saveTournament(): void {
    this.error.set('');
    this.message.set('');
    this.tournamentForm.controls.name.setValue(this.tournamentForm.controls.name.value.trim());
    this.tournamentForm.controls.location.setValue(this.tournamentForm.controls.location.value.trim());
    if (this.tournamentForm.invalid) {
      this.tournamentForm.markAllAsTouched();
      return;
    }

    const input = this.tournamentForm.getRawValue();
    const id = this.editingTournamentId();
    const request = id
      ? this.api.updateTournament(id, input)
      : this.api.createTournament(input);
    request.subscribe({
      next: (saved) => {
        this.message.set(id ? 'Tournoi modifié.' : 'Tournoi créé.');
        this.resetTournamentForm();
        this.selectedTournament.set(saved);
        void this.router.navigate(['/gestion/tournois-api', saved.id]);
        this.loadTournaments();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  deleteTournament(tournament: Tournament): void {
    this.error.set('');
    this.message.set('');
    this.api.deleteTournament(tournament.id).subscribe({
      next: () => {
        this.message.set('Tournoi supprimé.');
        if (this.selectedTournament()?.id === tournament.id) {
          this.selectedTournament.set(null);
          this.teams.set([]);
        }
        this.loadTournaments();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  saveTeam(): void {
    const tournament = this.selectedTournament();
    if (!tournament) {
      this.error.set('Sélectionnez un tournoi avant de gérer ses équipes.');
      return;
    }

    this.error.set('');
    this.teamForm.controls.name.setValue(this.teamForm.controls.name.value.trim());
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    const input: TeamInput = this.teamForm.getRawValue();
    const id = this.editingTeamId();
    const request = id
      ? this.api.updateTeam(id, input)
      : this.api.createTeam(tournament.id, input);
    request.subscribe({
      next: () => {
        this.message.set(id ? 'Équipe modifiée.' : 'Équipe créée.');
        this.resetTeamForm();
        this.loadTeams();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  editTeam(team: TournamentTeam): void {
    this.editingTeamId.set(team.id);
    this.teamForm.reset({ name: team.name, capacity: team.capacity });
    this.error.set('');
    this.message.set('');
  }

  deleteTeam(team: TournamentTeam): void {
    this.api.deleteTeam(team.id).subscribe({
      next: () => {
        this.message.set('Équipe supprimée.');
        this.loadTeams();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  resetTournamentForm(): void {
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
      maxTeams: 8,
    });
  }

  resetTeamForm(): void {
    this.editingTeamId.set(null);
    this.teamForm.reset({ name: '', capacity: 8 });
  }

  private loadTeams(): void {
    const tournament = this.selectedTournament();
    if (!tournament) {
      this.teams.set([]);
      return;
    }

    this.api.getTeams(tournament.id).subscribe({
      next: (teams) => this.teams.set(teams),
      error: (error: unknown) => this.showError(error),
    });
  }

  private showError(error: unknown): void {
    this.error.set(error instanceof HttpErrorResponse
      ? error.error?.error ?? 'La requête à l’API a échoué.'
      : 'Une erreur inattendue est survenue.');
  }
}
