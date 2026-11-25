import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TournamentManager } from './tournament-manager';

describe('TournamentManager', () => {
  let fixture: ComponentFixture<TournamentManager>;
  let component: TournamentManager;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TournamentManager],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TournamentManager);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/tournaments/mine').flush({ tournaments: [] });
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  it('rejects a tournament whose end date precedes its start date', () => {
    component.tournamentForm.setValue({
      name: 'Coupe régionale',
      sport: 'Football',
      startDate: '2027-02-12',
      endDate: '2027-02-10',
      location: 'Stade municipal',
      description: '',
      rules: '',
      format: 'elimination',
      status: 'open',
      maxTeams: 8,
    });

    component.saveTournament();

    expect(component.tournamentForm.hasError('invalidDateRange')).toBe(true);
    expect(component.tournamentForm.touched).toBe(true);
    http.expectNone('/api/tournaments');
  });
});
