
import { Routes } from '@angular/router';

import { authGuard } from './app/auth.guard';
import { Auth } from './app/pages/auth/auth';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: Auth },
  { path: 'gestion', component: Auth, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' },
];
