import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Auth, AuthUser } from './auth';
import { authInterceptor } from '../auth.interceptor';
import { TournamentApi } from './tournament-api';

describe('Auth', () => {
  let service: Auth;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('gestion-tournoi-session');
    localStorage.removeItem('gestion-tournoi-users');
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('gestion-tournoi-session');
    localStorage.removeItem('gestion-tournoi-users');
    sessionStorage.clear();
  });

  it('creates an API session after successful login', async () => {
    const login = service.login('organizer@example.com', 'secure-password');
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'organizer@example.com',
      password: 'secure-password',
    });
    const user: AuthUser = {
      name: 'Organisateur',
      email: 'organizer@example.com',
      role: 'organisateur',
    };
    request.flush({ user, token: 'signed-token' });

    await expect(login).resolves.toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.getCurrentUser()).toEqual(user);
    expect(service.getToken()).toBe('signed-token');
    expect(localStorage.getItem('gestion-tournoi-users')).toBeNull();
  });

  it('registers the selected role through the API', async () => {
    const registration = service.register(
      'Player User',
      'player@example.com',
      'secure-password',
      'joueur',
    );
    const request = http.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Player User',
      email: 'player@example.com',
      password: 'secure-password',
      role: 'joueur',
    });
    request.flush({
      user: { name: 'Player User', email: 'player@example.com', role: 'joueur' },
      token: 'player-token',
    });

    await expect(registration).resolves.toEqual({
      success: true,
      message: 'Compte créé avec succès.',
    });
    expect(service.getCurrentUser()?.role).toBe('joueur');
  });

  it('surfaces API validation errors and handles invalid login credentials', async () => {
    const registration = service.register(
      'Existing User',
      'existing@example.com',
      'secure-password',
      'spectateur',
    );
    http.expectOne('/api/auth/register').flush(
      { error: 'Cette adresse e-mail est déjà utilisée.' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(registration).resolves.toEqual({
      success: false,
      message: 'Cette adresse e-mail est déjà utilisée.',
    });

    const login = service.login('missing@example.com', 'wrong-password');
    http.expectOne('/api/auth/login').flush(
      { error: 'Adresse e-mail ou mot de passe incorrect.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await expect(login).resolves.toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('clears the stored session on logout', async () => {
    const login = service.login('organizer@example.com', 'secure-password');
    http.expectOne('/api/auth/login').flush({
      user: { name: 'Organisateur', email: 'organizer@example.com', role: 'organisateur' },
      token: 'signed-token',
    });
    await login;

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getCurrentUser()).toBeNull();
    expect(service.getToken()).toBeNull();
  });

  it('adds the bearer token to protected API requests', async () => {
    const login = service.login('organizer@example.com', 'secure-password');
    http.expectOne('/api/auth/login').flush({
      user: { name: 'Organisateur', email: 'organizer@example.com', role: 'organisateur' },
      token: 'signed-token',
    });
    await login;

    TestBed.inject(TournamentApi).getMyTournaments().subscribe();
    const request = http.expectOne('/api/tournaments/mine');
    expect(request.request.headers.get('Authorization')).toBe('Bearer signed-token');
    request.flush({ tournaments: [] });
  });
});
