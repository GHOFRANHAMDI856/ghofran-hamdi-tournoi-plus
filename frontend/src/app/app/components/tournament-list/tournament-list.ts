import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Tournament } from '../../services/tournament';
import { TournamentStatusPipe } from '../../pipes/tournament-status.pipe';

@Component({
  selector: 'app-tournament-list',
  standalone: true,
  imports: [TournamentStatusPipe],
  templateUrl: './tournament-list.html',
})
export class TournamentList {
  @Input() tournaments: Tournament[] = [];
  @Input() selectedId: string | null = null;
  @Output() selected = new EventEmitter<Tournament>();
  @Output() edit = new EventEmitter<Tournament>();
  @Output() remove = new EventEmitter<Tournament>();
}
