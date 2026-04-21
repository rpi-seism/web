import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule }                         from '@angular/common';
import { FormsModule }                          from '@angular/forms';
import { RouterModule, ActivatedRoute }         from '@angular/router';
import { ChartModule }                          from 'primeng/chart';
import { DatePickerModule } from 'primeng/datepicker';
import { concat, of } from 'rxjs';
import { catchError, toArray } from 'rxjs/operators';
import { ArchiveService } from '../../services/archive-service';
import { BookmarkService }                      from '../../services/bookmark-service';
import { WaveformResponse } from '../../entities/waveform-response';
import { ArchiveEvent } from '../../entities/archive-event';
import { WaveformResult } from '../../entities/waveform-result';
import { Bookmark } from '../../entities/bookmark';
import { Chart } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { environment } from '../../../environments/environment';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ExportFormat, WaveformExport, WaveformExportData } from '../../dialogs/waveform-export';

Chart.register(zoomPlugin);

@Component({
  selector:    'app-archive',
  standalone:  true,
  templateUrl: './archive.html',
  imports:     [CommonModule, FormsModule, ChartModule, RouterModule, DatePickerModule],
  providers:  [DialogService]
})
export class Archive implements OnInit {
  private dialogService = inject(DialogService);

  availableChannels: string[]       = [];
  availableDays:     string[]       = [];
  events:            ArchiveEvent[] = [];

  allBookmarks:  Bookmark[] = [];
  dayBookmarks:  Bookmark[] = [];
  bookmarkLabel: string     = '';

  selectedChannels: string[] = [];
  selectedDate:     Date | null = null;
  minDate:          Date | null = null;
  maxDate:          Date | null = null;
  startTime         = '00:00:00';
  endTime           = '00:05:00';
  selectedUnits     = 'COUNTS';

  loadingWaveform = false;
  loadingEvents   = false;
  error           = '';

  public chartSettings = environment.chartsSettings;

  waveformResults: WaveformResult[] = [];

  private dialogRef: DynamicDialogRef | null = null;

  // Force UTC timezone for all date operations
  readonly datePickerConfig = {
    firstDayOfWeek: 1,
    showTime: false,
    utc: true,
  };

  constructor(
    private archiveService:  ArchiveService,
    private bookmarkService: BookmarkService,
    private route:           ActivatedRoute,
    private cdref:           ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadChannels();
    this.loadAllBookmarks();
  }

  //  channels / days / events 

  loadChannels() {
    this.archiveService.getAvailableChannels().subscribe({
      next: channels => {
        this.availableChannels = channels;

        // Pre-fill from query params if present, otherwise default to first channel
        const qp = this.route.snapshot.queryParamMap;
        if (qp.get('channels')) {
          this.selectedChannels = qp.get('channels')!.split(',');
        } else if (channels.length > 0) {
          this.selectedChannels = [channels[0]];
        }

        this.loadDays(qp);
        this.cdref.detectChanges();
      },
      error: () => {
        this.error = 'Could not reach archive API — is it running?';
        this.cdref.detectChanges();
      },
    });
  }

  loadDays(qp?: any) {
    const ch = this.selectedChannels[0];
    if (!ch) return;

    this.archiveService.getAvailableDays(ch).subscribe({
      next: days => {
        this.availableDays = days;

        // Set min and max dates from available days (UTC)
        if (days.length > 0) {
          this.minDate = this.convertToUTC(new Date(days[0]));
          this.maxDate = this.convertToUTC(new Date(days[days.length - 1]));
        } else {
          this.minDate = null;
          this.maxDate = null;
        }

        // honour query param date if available, otherwise latest day
        let paramDate = "";
        if (qp){
          paramDate = qp?.get('date');
        }
        else if (this.selectedDate) {
          paramDate = this.formatDateToString(this.selectedDate);
        }

        const targetDate = (paramDate && days.includes(paramDate))
          ? paramDate
          : (days.at(-1) ?? '');

        this.selectedDate = targetDate ? this.convertToUTC(new Date(targetDate)) : null;

        // apply remaining query params
        if (qp?.get('start')) this.startTime   = qp.get('start');
        if (qp?.get('end'))   this.endTime     = qp.get('end');
        if (qp?.get('units')) this.selectedUnits = qp.get('units');

        if (this.selectedDate) {
          this.loadEvents();
          this.filterDayBookmarks();

          // auto-fetch if we came from a bookmark link
          if (qp?.get('date')) this.fetchWaveform();
        }
        this.cdref.detectChanges();
      },
      error: () => {
        this.availableDays = [];
        this.selectedDate  = null;
        this.minDate       = null;
        this.maxDate       = null;
        this.events        = [];
        this.cdref.detectChanges();
      },
    });
  }

  loadEvents() {
    if (!this.selectedChannels.length || !this.selectedDate) return;

    this.loadingEvents = true;
    const dateString = this.formatDateToString(this.selectedDate);
    
    const eventRequests = this.selectedChannels.map(ch =>
      this.archiveService.getEvents(ch, dateString).pipe(
        catchError(() => of([] as any[]))
      )
    );

    // Events are still serialized to avoid any SDS concurrency issues
    concat(...eventRequests).pipe(toArray()).subscribe({
      next: (results: any[][]) => {
        this.events        = results.flat().sort((a, b) => a.filename.localeCompare(b.filename));
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

  //  channel toggling 

  toggleChannel(ch: string) {
    this.selectedChannels = this.selectedChannels.includes(ch)
      ? this.selectedChannels.filter(c => c !== ch)
      : [...this.selectedChannels, ch];
  }

  isChannelSelected(ch: string): boolean {
    return this.selectedChannels.includes(ch);
  }

  onChannelToggle() {
    this.waveformResults = [];
    this.events          = [];
    this.loadDays();
  }

  onDateChange() {
    this.loadEvents();
    this.filterDayBookmarks();
  }

  onStartTimeChange(e: Event) {
    let timeString = (e.target as any).value;

    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, seconds, 0);

    const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
    const newTimestamp = date.getTime() + FIVE_MINUTES_IN_MS;
    const updatedDate = new Date(newTimestamp);

    this.endTime = updatedDate.toTimeString().split(' ')[0];
  }

  //  waveform 

  fetchWaveform() {
    if (!this.selectedChannels.length || !this.selectedDate) return;

    this.error           = '';
    this.loadingWaveform = true;
    this.waveformResults = [];

    const dateString = this.formatDateToString(this.selectedDate);
    const start      = `${dateString}T${this.startTime}Z`;
    const end        = `${dateString}T${this.endTime}Z`;
    
    this.archiveService.getWaveforms(this.selectedChannels, start, end, this.selectedUnits).subscribe({
      next: ({ results, errors }) => {
        this.waveformResults = results.map(res => ({
          res,
          chartData:    this.buildChartData(res),
          chartOptions: this.buildChartOptions(res),
        }));

        this.error = errors.map(e => e.detail).join(' · ');

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

  downloadMseed(ev: ArchiveEvent) {
    this.archiveService.downloadMseed(ev.channel, ev.date);
  }

  //  bookmarks 

  loadAllBookmarks() {
    this.bookmarkService.getBookmarks().subscribe({
      next: (raw: any[]) => {
        this.allBookmarks = raw.map(bm => ({
          ...bm,
          start:   new Date(bm.start.endsWith('Z')    ? bm.start    : bm.start    + 'Z'),
          end:     new Date(bm.end.endsWith('Z')      ? bm.end      : bm.end      + 'Z'),
          savedAt: new Date(bm.saved_at?.endsWith('Z') ? bm.saved_at : (bm.saved_at ?? bm.savedAt) + 'Z'),
        }));
        this.filterDayBookmarks();
        this.cdref.detectChanges();
      },
    });
  }

  filterDayBookmarks() {
    if (!this.selectedDate) { this.dayBookmarks = []; return; }
    
    const dateString = this.formatDateToString(this.selectedDate);
    this.dayBookmarks = this.allBookmarks
      .filter(bm => bm.start.toISOString().substring(0, 10) === dateString)
      .sort((a, b) => b.start.getTime() - a.start.getTime());
  }

  loadBookmark(bm: Bookmark) {
    this.selectedChannels = [...bm.channels];
    this.selectedDate     = this.convertToUTC(bm.start);
    this.startTime        = bm.start.toISOString().substring(11, 19);
    this.endTime          = bm.end.toISOString().substring(11, 19);
    this.selectedUnits    = bm.units;
    this.loadDays();
    this.fetchWaveform();
  }

  exportBookmark(bm: Bookmark) {
    const label = `Export — ${bm.label}`;
 
    this.dialogRef = this.dialogService.open(WaveformExport, {
      header:          label,
      width:           '520px',
      modal:           true,
      closable:        true,
      dismissableMask: true,
      style:           { 'border': '1px solid #1e293b', 'border-radius': '1.5rem', 'overflow': 'hidden', 'background': 'var(--color-slate-950)' },
      data:            { bookmark: bm } satisfies WaveformExportData,
    });
 
    this.dialogRef?.onClose.subscribe((format: ExportFormat | null) => {
      if (!format) return;

      this.archiveService.exportWaveforms(bm.channels, bm.start.toISOString(), bm.end.toISOString(), bm.units, format);
    });
  }

  saveBookmark() {
    if (!this.selectedChannels.length || !this.selectedDate) return;

    const dateString = this.formatDateToString(this.selectedDate);
    const payload = {
      label:    this.bookmarkLabel.trim() || `${dateString} ${this.startTime}`,
      channels: [...this.selectedChannels],
      start:    new Date(`${dateString}T${this.startTime}Z`),
      end:      new Date(`${dateString}T${this.endTime}Z`),
      units:    this.selectedUnits,
    };

    this.bookmarkService.saveBookmark(payload).subscribe({
      next: (saved: any) => {
        const bm: Bookmark = {
          ...saved,
          start:   new Date(saved.start.endsWith('Z')    ? saved.start    : saved.start    + 'Z'),
          end:     new Date(saved.end.endsWith('Z')      ? saved.end      : saved.end      + 'Z'),
          savedAt: new Date(saved.saved_at?.endsWith('Z') ? saved.saved_at : (saved.saved_at ?? saved.savedAt) + 'Z'),
        };
        this.allBookmarks  = [bm, ...this.allBookmarks];
        this.bookmarkLabel = '';
        this.filterDayBookmarks();
        this.cdref.detectChanges();
      },
    });
  }

  /**
   * Format Date object to YYYY-MM-DD string
   */
  formatDateToString(date: Date): string {
    return date.toISOString().substring(0, 10);
  }

  getSelectedDateString(): string {
    return this.selectedDate ? this.formatDateToString(this.selectedDate) : '';
  }

  private convertToUTC(date: Date): Date {
    return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
    ));
  }

  onDatePickerChange(event: Date) {
    // Ensure the date is treated as UTC
    if (event) {
      this.selectedDate = this.convertToUTC(event);
    } else {
      this.selectedDate = null;
    }
    this.onDateChange();
  }

  //  chart helpers 

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
          ticks:   { color: '#64748b', maxTicksLimit: 10, autoSkip: true },
          grid:    { color: '#1e293b' },
          border:  { display: false },
        },
        y: {
          grid:   { color: '#1e293b' },
          ticks:  { color: '#64748b' },
          border: { display: false },
          title:  { display: true, text: res.units, color: '#475569' },
        },
      },
      plugins: {
        legend: { display: false },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
          },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
          },
        },
      },
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