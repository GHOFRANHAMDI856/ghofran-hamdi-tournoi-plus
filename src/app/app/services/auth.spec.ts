import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';

describe('Auth', () => {
  let service: Auth;

  beforeEach(() => {
    localStorage.removeItem('gestion-tournoi-session');
    localStorage.removeItem('gestion-tournoi-users');
    TestBed.configureTestingModule({});
    service = TestBed.inject(Auth);
  });

  afterEach(() => {
    localStorage.removeItem('gestion-tournoi-session');
    localStorage.removeItem('gestion-tournoi-users');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('removes the old demo account and its active session', () => {
    localStorage.setItem(
      'gestion-tournoi-users',
      JSON.stringify([
        { name: 'Organisateur Démo', email: 'demo@tournoiplus.fr', password: 'Tournoi2026!' },
        { name: 'Samira', email: 'samira@example.com', password: 'secret123' },
      ]),
    );
    localStorage.setItem(
      'gestion-tournoi-session',
      JSON.stringify({ email: 'demo@tournoiplus.fr', name: 'Organisateur Démo' }),
    );

    const auth = new Auth();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.login('demo@tournoiplus.fr', 'Tournoi2026!')).toBe(false);
    expect(JSON.parse(localStorage.getItem('gestion-tournoi-users') ?? '[]')).toEqual([
      { name: 'Samira', email: 'samira@example.com', password: 'secret123', role: 'spectateur' },
    ]);
  });

  it('registers the selected role for the first and later accounts', () => {
    expect(service.register('Organizer User', 'organizer@example.com', 'password123', 'organisateur').success).toBe(true);
    expect(service.getCurrentUser()?.role).toBe('organisateur');

    expect(service.register('Player User', 'player@example.com', 'password123', 'joueur').success).toBe(true);
    expect(service.getCurrentUser()?.role).toBe('joueur');

    expect(service.register('Referee User', 'referee@example.com', 'password123', 'arbitre').success).toBe(true);
    expect(service.getCurrentUser()?.role).toBe('arbitre');
  });

  it('migrates existing Admin accounts to Organisateur', () => {
    localStorage.setItem(
      'gestion-tournoi-users',
      JSON.stringify([
        { name: 'Former Admin', email: 'admin@example.com', password: 'password123', role: 'admin' },
      ]),
    );
    localStorage.setItem(
      'gestion-tournoi-session',
      JSON.stringify({ email: 'admin@example.com', name: 'Former Admin', role: 'admin' }),
    );

    const auth = new Auth();

    expect(auth.getCurrentUser()?.role).toBe('organisateur');
    expect(JSON.parse(localStorage.getItem('gestion-tournoi-users') ?? '[]')[0].role).toBe('organisateur');
  });

  it('migrates the former Équipe role to Joueur', () => {
    localStorage.setItem(
      'gestion-tournoi-users',
      JSON.stringify([
        { name: 'Team Account', email: 'team@example.com', password: 'password123', role: 'equipe' },
      ]),
    );

    const auth = new Auth();

    expect(auth.login('team@example.com', 'password123')).toBe(true);
    expect(auth.getCurrentUser()?.role).toBe('joueur');
    expect(JSON.parse(localStorage.getItem('gestion-tournoi-users') ?? '[]')[0].role).toBe('joueur');
  });

  it('rejects the removed Admin role', () => {
    const result = Reflect.apply(service.register, service, [
      'User',
      'user@example.com',
      'password123',
      'admin',
    ]);

    expect(result.success).toBe(false);
    expect(result.message).toContain('type de compte valide');

    const teamRoleResult = Reflect.apply(service.register, service, [
      'Team User',
      'team@example.com',
      'password123',
      'equipe',
    ]);
    expect(teamRoleResult.success).toBe(false);
  });
});
