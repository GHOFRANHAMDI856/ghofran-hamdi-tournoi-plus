
import { Routes } from '@angular/router';

import { authGuard, organizerGuard } from './app/auth.guard';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Auth } from './app/pages/auth/auth';
import { TournamentManager } from './app/pages/tournament-manager/tournament-manager';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: Auth },
  { path: 'gestion/tournois-api/:tournamentId', component: TournamentManager, canActivate: [authGuard, organizerGuard] },
  { path: 'gestion/tournois-api', component: TournamentManager, canActivate: [authGuard, organizerGuard] },
  { path: 'gestion', component: Dashboard, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' },
];
