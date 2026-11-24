
import { Routes } from '@angular/router';

import { authGuard } from './app/auth.guard';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Auth } from './app/pages/auth/auth';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: Auth },
  { path: 'gestion', component: Dashboard, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' },
];
