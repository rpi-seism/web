import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { FormsModule }       from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';

export interface EditBookmarkLabelData {
  id:    string;
  label: string;
}

@Component({
  selector:   'app-edit-bookmark-label',
  standalone: true,
  imports:    [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-5 p-1">

      <!-- Current label hint -->
      <p class="text-xs font-mono text-slate-500">
        Editing label for bookmark
        <span class="text-slate-400 font-bold">{{ data.id.substring(0, 8) }}…</span>
      </p>

      <!-- Input -->
      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Label</label>
        <input
          type="text"
          [(ngModel)]="newLabel"
          (keydown.enter)="save()"
          (keydown.escape)="cancel()"
          autofocus
          placeholder="e.g. possible M2.1, teleseismic P-wave…"
          class="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl
                 px-3 py-2.5 focus:outline-none focus:border-blue-500 transition-colors
                 placeholder:text-slate-600"
        />
        <p class="text-[10px] font-mono text-slate-600">
          {{ newLabel.length }} / 120 characters
        </p>
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
          (click)="save()"
          [disabled]="!newLabel.trim() || newLabel.trim() === data.label"
          class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors
                 bg-blue-600 hover:bg-blue-500 text-white
                 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed">
          Save label
        </button>
      </div>

    </div>
  `,
})
export class EditBookmarkLabel {

  data: EditBookmarkLabelData;
  newLabel = '';

  constructor(
    private ref:    DynamicDialogRef,
    private config: DynamicDialogConfig,
  ) {
    this.data     = this.config.data as EditBookmarkLabelData;
    this.newLabel = this.data.label;
  }

  save() {
    const trimmed = this.newLabel.trim();
    if (!trimmed || trimmed === this.data.label) return;
    this.ref.close(trimmed);
  }

  cancel() {
    this.ref.close(null);
  }
}