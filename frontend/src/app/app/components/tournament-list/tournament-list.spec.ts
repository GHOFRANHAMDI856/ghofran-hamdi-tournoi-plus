import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tournament } from '../../services/tournament';
import { TournamentList } from './tournament-list';

describe('TournamentList', () => {
  let fixture: ComponentFixture<TournamentList>;
  let component: TournamentList;
  const tournament: Tournament = {
    id: 'tournament-1',
    ownerEmail: 'organizer@example.com',
    name: 'Coupe régionale',
    sport: 'Football',
    startDate: '2027-02-10',
    endDate: '2027-02-12',
    location: 'Stade municipal',
    description: '',
    rules: '',
    format: 'elimination',
    status: 'open',
    maxTeams: 8,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TournamentList] }).compileComponents();
    fixture = TestBed.createComponent(TournamentList);
    component = fixture.componentInstance;
    component.tournaments = [tournament];
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('emits the selected tournament supplied through its input', () => {
    const selected = vi.fn();
    component.selected.subscribe(selected);
    const button = (fixture.nativeElement as HTMLElement).querySelector('.tournament-choice');
    button?.dispatchEvent(new MouseEvent('click'));

    expect(selected).toHaveBeenCalledWith(tournament);
    expect(fixture.nativeElement.textContent).toContain('Ouvert');
  });
});
