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
      { name: 'Samira', email: 'samira@example.com', password: 'secret123' },
    ]);
  });
});
