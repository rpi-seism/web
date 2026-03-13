import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChartModule } from 'primeng/chart';
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
  // ── Selectors ──────────────────────────────────────────────────────────────
  availableChannels: string[] = [];
  availableDays:     string[] = [];
  events:            ArchiveEvent[] = [];

  selectedChannel = '';
  selectedDate    = '';
  startTime       = '00:00:00';
  endTime         = '00:05:00';
  selectedUnits   = 'COUNTS';

  // ── Status ─────────────────────────────────────────────────────────────────
  loadingWaveform  = false;
  loadingEvents    = false;
  error            = '';

  // ── Chart ──────────────────────────────────────────────────────────────────
  chartData:    any = null;
  chartOptions: any = null;
  waveformMeta: Partial<WaveformResponse> = {};

  constructor(
    private archiveService: ArchiveService,
    private cdref: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.initChartOptions();
    this.loadChannels();
  }

  // ── Loaders ────────────────────────────────────────────────────────────────

  loadChannels() {
    this.archiveService.getAvailableChannels().subscribe({
      next: channels => {
        this.availableChannels = channels;
        if (channels.length > 0) {
          this.selectedChannel = channels[0];
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
    if (!this.selectedChannel) return;

    this.archiveService.getAvailableDays(this.selectedChannel).subscribe({
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
    if (!this.selectedChannel || !this.selectedDate) return;

    this.loadingEvents = true;
    this.archiveService.getEvents(this.selectedChannel, this.selectedDate).subscribe({
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

  // ── Waveform fetch ─────────────────────────────────────────────────────────

  fetchWaveform() {
    if (!this.selectedChannel || !this.selectedDate) return;

    this.error          = '';
    this.loadingWaveform = true;
    this.chartData      = null;

    const start = `${this.selectedDate}T${this.startTime}`;
    const end   = `${this.selectedDate}T${this.endTime}`;

    this.archiveService.getWaveform(this.selectedChannel, start, end, this.selectedUnits).subscribe({
      next: (res: WaveformResponse) => {
        this.waveformMeta    = res;
        this.buildChart(res);
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

  // ── Quick-load from event row ──────────────────────────────────────────────

  loadEvent(ev: ArchiveEvent) {
    this.selectedChannel = ev.channel;
    this.selectedDate    = ev.date;
    this.startTime       = '00:00:00';
    this.endTime         = '23:59:59';
    this.fetchWaveform();
  }

  downloadMseed(ev: ArchiveEvent) {
    this.archiveService.downloadMseed(ev.channel, ev.date);
  }

  // ── Side-effect handlers ───────────────────────────────────────────────────

  onChannelChange() {
    this.chartData    = null;
    this.waveformMeta = {};
    this.events       = [];
    this.loadDays();
  }

  onDateChange() {
    this.loadEvents();
  }

  // ── Chart ──────────────────────────────────────────────────────────────────

  private initChartOptions() {
    this.chartOptions = {
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
          title:  { display: true, text: 'counts', color: '#475569' },
        },
      },
      plugins: { legend: { display: false } },
    };
  }

  private buildChart(res: WaveformResponse) {
    const t0   = new Date(res.starttime).getTime();
    const t1   = new Date(res.endtime).getTime();
    const n    = res.data.length;
    const step = n > 1 ? (t1 - t0) / (n - 1) : 0;

    const labels = Array.from({ length: n }, (_, i) =>
      new Date(t0 + i * step).toISOString().substring(11, 23)
    );

    this.chartData = {
      labels,
      datasets: [{
        data:        res.data,
        borderColor: '#3b82f6',
        fill:        false,
      }],
    };

    // Update Y axis label to match the units returned by the API
    this.chartOptions = {
      ...this.chartOptions,
      scales: {
        ...this.chartOptions.scales,
        y: {
          ...this.chartOptions.scales.y,
          title: { display: true, text: res.units, color: '#475569' },
        },
      },
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatDuration(): string {
    if (!this.waveformMeta.starttime || !this.waveformMeta.endtime) return '';
    const sec = (
      new Date(this.waveformMeta.endtime).getTime() -
      new Date(this.waveformMeta.starttime).getTime()
    ) / 1000;
    return sec >= 60 ? `${(sec / 60).toFixed(1)} min` : `${sec.toFixed(1)} s`;
  }
}