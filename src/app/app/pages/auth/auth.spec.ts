import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Auth } from './auth';

describe('Auth', () => {
  let component: Auth;
  let fixture: ComponentFixture<Auth>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Auth],
    }).compileComponents();

    fixture = TestBed.createComponent(Auth);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('proposes arbitre as a registration role', () => {
    const registrationFixture = TestBed.createComponent(Auth);
    registrationFixture.componentInstance.setMode('register');
    registrationFixture.detectChanges();

    const roleOptions = Array.from(
      (registrationFixture.nativeElement as HTMLElement).querySelectorAll('#account-role option'),
    ).map((option) => option.textContent?.trim());

    expect(roleOptions).toContain('Arbitre');
    registrationFixture.destroy();
  });
});
