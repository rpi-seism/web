import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { forkJoin } from 'rxjs';
import { ArchiveService } from '../services/archive-service';

interface WaveformResponse {
  channel:      string;
  network:      string;
  station:      string;
  units:        string;
  fs:           number;
  starttime:    string;
  endtime:      string;
  npts_raw:     number;
  npts_display: number;
  data:         number[];
}

interface WaveformResult {
  res:         WaveformResponse;
  chartData:   any;
  chartOptions: any;
}

interface ArchiveEvent {
  date:     string;
  channel:  string;
  filename: string;
  size_kb:  number;
}

@Component({
  selector: 'app-archive',
  standalone: true,
  templateUrl: './archive.html',
  imports: [CommonModule, FormsModule, ChartModule, RouterModule],
})
export class Archive implements OnInit {
  availableChannels: string[]       = [];
  availableDays:     string[]       = [];
  events:            ArchiveEvent[] = [];

  selectedChannels: string[] = [];
  selectedDate     = '';
  startTime        = '00:00:00';
  endTime          = '00:05:00';
  selectedUnits    = 'COUNTS';

  loadingWaveform  = false;
  loadingEvents    = false;
  error            = '';

  waveformResults: WaveformResult[] = [];

  constructor(
    private archiveService: ArchiveService,
    private cdref: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadChannels();
  }

  loadChannels() {
    this.archiveService.getAvailableChannels().subscribe({
      next: channels => {
        this.availableChannels = channels;
        if (channels.length > 0) {
          this.selectedChannels = [channels[0]];
          this.loadDays();
        }
        this.cdref.detectChanges();
      },
      error: () => {
        this.error = 'Could not reach archive API — is it running?';
        this.cdref.detectChanges();
      },
    });
  }

  loadDays() {
    const ch = this.selectedChannels[0];
    if (!ch) return;

    this.archiveService.getAvailableDays(ch).subscribe({
      next: days => {
        this.availableDays = days;
        this.selectedDate  = days.at(-1) ?? '';
        if (this.selectedDate) this.loadEvents();
        this.cdref.detectChanges();
      },
      error: () => {
        this.availableDays = [];
        this.selectedDate  = '';
        this.events        = [];
        this.cdref.detectChanges();
      },
    });
  }

  loadEvents() {
    const ch = this.selectedChannels[0];
    if (!ch || !this.selectedDate) return;

    this.loadingEvents = true;
    this.archiveService.getEvents(ch, this.selectedDate).subscribe({
      next: (evs: any[]) => {
        this.events        = evs;
        this.loadingEvents = false;
        this.cdref.detectChanges();
      },
      error: () => {
        this.events        = [];
        this.loadingEvents = false;
        this.cdref.detectChanges();
      },
    });
  }

  toggleChannel(ch: string) {
    if (this.selectedChannels.includes(ch)) {
      this.selectedChannels = this.selectedChannels.filter(c => c !== ch);
    } else {
      this.selectedChannels = [...this.selectedChannels, ch];
    }
  }

  isChannelSelected(ch: string): boolean {
    return this.selectedChannels.includes(ch);
  }

  fetchWaveform() {
    if (!this.selectedChannels.length || !this.selectedDate) return;

    this.error           = '';
    this.loadingWaveform = true;
    this.waveformResults = [];

    const start = `${this.selectedDate}T${this.startTime}Z`;
    const end   = `${this.selectedDate}T${this.endTime}Z`;

    const requests = this.selectedChannels.map(ch =>
      this.archiveService.getWaveform(ch, start, end, this.selectedUnits)
    );

    forkJoin(requests).subscribe({
      next: (responses: WaveformResponse[]) => {
        this.waveformResults = responses.map(res => ({
          res,
          chartData:    this.buildChartData(res),
          chartOptions: this.buildChartOptions(res),
        }));
        this.loadingWaveform = false;
        this.cdref.detectChanges();
      },
      error: err => {
        this.error           = err?.error?.detail ?? 'Failed to fetch waveform';
        this.loadingWaveform = false;
        this.cdref.detectChanges();
      },
    });
  }

  loadEvent(ev: ArchiveEvent) {
    if (!this.selectedChannels.includes(ev.channel)) {
      this.selectedChannels = [ev.channel];
    }
    this.selectedDate = ev.date;
    this.startTime    = '00:00:00';
    this.endTime      = '23:59:59';
    this.fetchWaveform();
  }

  downloadMseed(ev: ArchiveEvent) {
    this.archiveService.downloadMseed(ev.channel, ev.date);
  }

  onChannelToggle() {
    this.waveformResults = [];
    this.events          = [];
    this.loadDays();
  }

  onDateChange() {
    this.loadEvents();
  }

  private buildChartData(res: WaveformResponse): any {
    const toUtcMs = (s: string) => new Date(s.endsWith('Z') ? s : s + 'Z').getTime();
    const t0   = toUtcMs(res.starttime);
    const t1   = toUtcMs(res.endtime);
    const n    = res.data.length;
    const step = n > 1 ? (t1 - t0) / (n - 1) : 0;

    const labels = Array.from({ length: n }, (_, i) =>
      new Date(t0 + i * step).toISOString().substring(11, 23)
    );

    return {
      labels,
      datasets: [{
        data:        res.data,
        borderColor: '#3b82f6',
        fill:        false,
      }],
    };
  }

  private buildChartOptions(res: WaveformResponse): any {
    return {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      elements: {
        point: { radius: 0 },
        line:  { borderWidth: 1, tension: 0 },
      },
      scales: {
        x: {
          display: true,
          ticks:  { color: '#64748b', maxTicksLimit: 10, autoSkip: true },
          grid:   { color: '#1e293b' },
          border: { display: false },
        },
        y: {
          grid:   { color: '#1e293b' },
          ticks:  { color: '#64748b' },
          border: { display: false },
          title:  { display: true, text: res.units, color: '#475569' },
        },
      },
      plugins: { legend: { display: false } },
    };
  }

  formatDuration(wr: WaveformResult): string {
    const sec = (
      new Date(wr.res.endtime).getTime() -
      new Date(wr.res.starttime).getTime()
    ) / 1000;
    return sec >= 60 ? `${(sec / 60).toFixed(1)} min` : `${sec.toFixed(1)} s`;
  }
}