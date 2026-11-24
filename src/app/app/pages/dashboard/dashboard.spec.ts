import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Auth, AuthUser } from '../../services/auth';
import { TournamentService } from '../../services/tournament';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let signedInUser: AuthUser;
  const authStub = {
    getCurrentUser: () => signedInUser,
    logout: () => undefined,
  };
  const tournamentServiceStub = {
    getMyTournaments: () => [],
    getPublicTournaments: () => [],
    getPublicMatches: () => [],
    getFollowedTournamentIds: () => [],
    getTeamDirectory: () => [],
    getMyTeams: () => [],
    getMyJoinRequests: () => [],
    getPlayerMatches: () => [],
    getPlayerPoints: () => null,
  };

  beforeEach(async () => {
    signedInUser = {
      name: 'Organisateur Test',
      email: 'organizer@example.com',
      role: 'organisateur',
    };

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: authStub },
        { provide: TournamentService, useValue: tournamentServiceStub },
      ],
    }).compileComponents();
  });

  it('renders the dedicated organizer space without administrator access', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('app-organizer-space')).toBeTruthy();
    expect(page.querySelector('app-player-space')).toBeNull();
    expect(page.querySelector('app-spectator-space')).toBeNull();
    expect(page.textContent).not.toContain('Admin');
  });

  it('renders a distinct player space', () => {
    signedInUser = {
      name: 'Joueur Test',
      email: 'player@example.com',
      role: 'joueur',
    };
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('app-player-space')).toBeTruthy();
    expect(page.querySelector('app-organizer-space')).toBeNull();
    expect(page.textContent).toContain('Rejoindre une équipe');
  });

  it('renders a distinct spectator space', () => {
    signedInUser = {
      name: 'Spectateur Test',
      email: 'spectator@example.com',
      role: 'spectateur',
    };
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('app-spectator-space')).toBeTruthy();
    expect(page.querySelector('app-organizer-space')).toBeNull();
    expect(page.textContent).toContain('Tournois à suivre');
  });

  it('renders an empty designations list for an arbitre', () => {
    signedInUser = {
      name: 'Arbitre Test',
      email: 'referee@example.com',
      role: 'arbitre',
    };
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.referee-space')).toBeTruthy();
    expect(page.textContent).toContain('Mes désignations');
    expect(page.textContent).not.toContain('Ce compte n’a pas de rôle actif');
  });
});
