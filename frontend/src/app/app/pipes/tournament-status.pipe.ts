import { Pipe, PipeTransform } from '@angular/core';

import { TournamentStatus } from '../services/tournament';

const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'Brouillon',
  open: 'Ouvert',
  in_progress: 'En cours',
  completed: 'Terminé',
};

@Pipe({
  name: 'tournamentStatus',
  standalone: true,
})
export class TournamentStatusPipe implements PipeTransform {
  transform(status: TournamentStatus): string {
    return STATUS_LABELS[status];
  }
}
