import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { StateOfHealth } from '../../entities/ws/state-of-health';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-soh-popover',
  imports: [CommonModule],
  templateUrl: './soh-popover.html',
  styleUrl: './soh-popover.css',
})
export class SohPopover implements OnInit, OnDestroy {
  soh: StateOfHealth | null = null;
  lastSeenDate: Date = new Date();
  secondsAgo = 0;
 
  private subscription?: Subscription;
  private intervalId?: any;
 
  constructor(
    private wsService: WebsocketService,
    private cdref: ChangeDetectorRef,
  ) {}
 
  ngOnInit() {
    // Subscribe to SOH updates
    this.subscription = this.wsService.getStateOfHealth().subscribe({
      next: (msg: StateOfHealth) => {
        this.soh = msg;
        this.lastSeenDate = new Date(msg.payload.last_seen * 1000);
        this.updateSecondsAgo();
      }
    });
 
    // Update "seconds ago" every second
    this.intervalId = setInterval(() => {
      this.updateSecondsAgo();
    }, 1000);
  }
 
  ngOnDestroy() {
    this.subscription?.unsubscribe();
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  get healthStatus(): 'excellent' | 'warning' | 'critical' {
    const payload = this.soh?.payload;
    
    if (!payload?.connected || payload.link_quality <= 0.8) {
        return 'critical';
    }
    if (payload.link_quality > 0.95) {
        return 'excellent';
    }
    return 'warning';
  }
 
  private updateSecondsAgo() {
    if (this.soh) {
      const now = Date.now() / 1000;
      this.secondsAgo = Math.floor(now - this.soh.payload.last_seen);
      this.cdref.detectChanges();
    }
  }
}