import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Auth } from './services/auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);

  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};

export const organizerGuard: CanActivateFn = () => {
  const auth = inject(Auth);

  return auth.getCurrentUser()?.role === 'organisateur'
    ? true
    : inject(Router).createUrlTree(['/gestion']);
};
