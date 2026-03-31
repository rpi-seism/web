import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { Bookmark } from '../entities/bookmark';

export type ExportFormat = 'mseed' | 'sac' | 'csv' | 'json';

export interface WaveformExportData {
  bookmark: Bookmark;
}

interface FormatOption {
  id:          ExportFormat;
  label:       string;
  ext:         string;
  description: string;
  tag:         string;
  tagColor:    string;
  icon:        string;
}

@Component({
  selector:   'app-waveform-export',
  standalone: true,
  imports:    [CommonModule],
  template: `
    <div class="flex flex-col gap-5 p-1">

      <!-- Bookmark summary card -->
      <div class="rounded-xl bg-slate-800/60 border border-slate-700/50 overflow-hidden">

        <!-- label row -->
        <div class="px-4 pt-3 pb-2 border-b border-slate-700/50">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Bookmark</p>
          <p class="text-sm font-bold text-slate-100 truncate">{{ bm.label }}</p>
        </div>

        <!-- meta chips -->
        <div class="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3">
          <div>
            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Channels</p>
            <div class="flex gap-1 mt-0.5 flex-wrap">
              @for (ch of bm.channels; track ch) {
                <span class="bg-blue-900/50 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded">{{ ch }}</span>
              }
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Start</p>
            <p class="text-xs font-mono text-slate-300 mt-0.5">{{ bm.start | date:'yyyy-MM-dd HH:mm:ss' : 'UTC' }} UTC</p>
          </div>
          <div>
            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">End</p>
            <p class="text-xs font-mono text-slate-300 mt-0.5">{{ bm.end | date:'HH:mm:ss' : 'UTC' }} UTC</p>
          </div>
          <div>
            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Units</p>
            <p class="text-xs font-mono text-slate-300 mt-0.5">{{ bm.units }}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Duration</p>
            <p class="text-xs font-mono text-slate-300 mt-0.5">{{ duration }}</p>
          </div>
        </div>
      </div>

      <!-- Format grid -->
      <div class="flex flex-col gap-2">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Select format</p>

        @for (fmt of formats; track fmt.id) {
          <button
            (click)="select(fmt.id)"
            [class]="rowClass(fmt.id)"
          >
            <!-- icon -->
            <div [class]="iconClass(fmt.id)">{{ fmt.icon }}</div>

            <!-- text -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                <span class="text-sm font-bold text-slate-200">{{ fmt.label }}</span>
                <span [class]="'text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ' + fmt.tagColor">
                  {{ fmt.tag }}
                </span>
                <span class="ml-auto text-[10px] font-mono text-slate-600">.{{ fmt.ext }}</span>
              </div>
              <p class="text-xs leading-snug"
                 [class]="fmt.id === 'mseed' && bm.channels.length > 1 ? 'text-slate-600' : 'text-slate-500'">
                {{ fmt.description }}
              </p>
            </div>

            <!-- tick -->
            @if (selectedFormat === fmt.id) {
              <svg class="h-4 w-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            }
          </button>
        }
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-1">
        <button
          (click)="cancel()"
          class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest
                 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600
                 text-slate-400 hover:text-slate-200 transition-colors">
          Cancel
        </button>
        <button
          (click)="confirm()"
          [disabled]="!selectedFormat"
          class="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors
                 bg-blue-600 hover:bg-blue-500 text-white
                 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed">
          ↓ Download
        </button>
      </div>

    </div>
  `,
})
export class WaveformExport {

  bm: Bookmark;
  selectedFormat: ExportFormat | null = null;

  readonly formats: FormatOption[] = [
    {
      id:          'mseed',
      label:       'MiniSEED',
      ext:         'mseed',
      description: 'Full-resolution raw day file directly from the SDS archive. Opens in ObsPy, SeisComP, or any standard seismological tool.',
      tag:         'Seismic',
      tagColor:    'bg-blue-900/50 text-blue-400',
      icon:        '〰️',
    },
    {
      id:          'sac',
      label:       'SAC',
      ext:         'sac',
      description: 'Standard seismological binary format with extensive header metadata. Ideal for analysis in SAC, ObsPy, or TauP.',
      tag:         'Seismic',
      tagColor:    'bg-blue-900/50 text-blue-400',
      icon:        '📈',
    },
    {
      id:          'csv',
      label:       'CSV',
      ext:         'csv',
      description: 'Comma-separated timestamp,value pairs for the bookmarked time window. Opens in Excel, MATLAB, or Python.',
      tag:         'General',
      tagColor:    'bg-slate-900/50 text-slate-400',
      icon:        '📊',
    },
    {
      id:          'json',
      label:       'JSON',
      ext:         'json',
      description: 'Full waveform metadata and sample array as a single JSON object. Useful for custom scripts or web integrations.',
      tag:         'General',
      tagColor:    'bg-slate-900/50 text-slate-400',
      icon:        '{ }',
    },
  ];

  constructor(
    private ref:    DynamicDialogRef,
    private config: DynamicDialogConfig,
  ) {
    this.bm = (this.config.data as WaveformExportData).bookmark;
  }

  get duration(): string {
    const sec = (this.bm.end.getTime() - this.bm.start.getTime()) / 1000;
    return sec >= 60 ? `${(sec / 60).toFixed(1)} min` : `${sec.toFixed(1)} s`;
  }

  select(fmt: ExportFormat) {
    this.selectedFormat = fmt;
  }

  confirm() {
    if (!this.selectedFormat) return;
    this.ref.close(this.selectedFormat);
  }

  cancel() {
    this.ref.close(null);
  }

  rowClass(id: ExportFormat): string {
    return this.selectedFormat === id
      ? 'flex items-start gap-4 w-full text-left px-4 py-3 rounded-xl border transition-colors bg-blue-950/40 border-blue-600/60'
      : 'flex items-start gap-4 w-full text-left px-4 py-3 rounded-xl border transition-colors bg-slate-800/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800';
  }

  iconClass(id: ExportFormat): string {
    return 'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-base '
      + (this.selectedFormat === id ? 'bg-blue-600' : 'bg-slate-700');
  }
}