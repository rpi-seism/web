import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule }                         from '@angular/common';
import { FormsModule }                          from '@angular/forms';
import { RouterModule }                         from '@angular/router';
import { DatePickerModule }                     from 'primeng/datepicker';
import { BookmarkService }                      from '../services/bookmark-service';
import { ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';
import { Bookmark } from '../entities/bookmark';


@Component({
  selector:    'app-bookmarks',
  standalone:  true,
  templateUrl: './bookmarks.html',
  imports:     [CommonModule, FormsModule, RouterModule, DatePickerModule, ConfirmDialogModule, ToastModule, ButtonModule],
  providers: [ConfirmationService]
})
export class Bookmarks implements OnInit {
  private confirmationService = inject(ConfirmationService);

  bookmarks:     Bookmark[] = [];
  filtered:      Bookmark[] = [];
  allChannels:   string[]   = [];

  // filters
  dateRange:     Date[] | undefined = undefined;
  filterChannel: string          = '';
  filterText:    string          = '';

  loading = false;

  constructor(
    private bookmarkService: BookmarkService,
    private cdref: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadBookmarks();
  }

  //  data 

  loadBookmarks() {
    this.loading = true;
    this.bookmarkService.getBookmarks().subscribe({
      next: (raw: any[]) => {
        this.bookmarks = raw.map(bm => ({
          ...bm,
          start:   new Date(bm.start.endsWith('Z')    ? bm.start    : bm.start    + 'Z'),
          end:     new Date(bm.end.endsWith('Z')      ? bm.end      : bm.end      + 'Z'),
          savedAt: new Date(bm.saved_at?.endsWith('Z') ? bm.saved_at : (bm.saved_at ?? bm.savedAt) + 'Z'),
        }));

        // collect distinct channels across all bookmarks
        const chSet = new Set<string>();
        this.bookmarks.forEach(bm => bm.channels.forEach(ch => chSet.add(ch)));
        this.allChannels = Array.from(chSet).sort();

        this.applyFilters();
        this.loading = false;
        this.cdref.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdref.detectChanges();
      },
    });
  }

  //  filtering 

  // Called by (onSelect) — only apply once the second date is picked
  onDateRangeSelect() {
    if (this.dateRange?.length === 2 && this.dateRange[1] != null) {
      this.applyFilters();
    }
  }

  // Called by (onClearClick) on the button bar
  onDateRangeClear() {
    this.dateRange = undefined;
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.bookmarks];

    // date range — only apply when both ends are picked
    const from = this.dateRange?.[0];
    const to   = this.dateRange?.[1];
    if (from instanceof Date) {
      const start = new Date(from); start.setHours(0, 0, 0, 0);
      result = result.filter(bm => bm.start >= start);
    }
    if (to instanceof Date) {
      const end = new Date(to); end.setHours(23, 59, 59, 999);
      result = result.filter(bm => bm.start <= end);
    }

    // channel
    if (this.filterChannel) {
      result = result.filter(bm => bm.channels.includes(this.filterChannel));
    }

    // label text
    if (this.filterText.trim()) {
      const q = this.filterText.trim().toLowerCase();
      result = result.filter(bm => bm.label.toLowerCase().includes(q));
    }

    // sort newest first
    this.filtered = result.sort((a, b) => b.start.getTime() - a.start.getTime());
    this.cdref.detectChanges();
  }

  hasActiveFilters(): boolean {
    return (this.dateRange?.length === 2 && this.dateRange[1] != null) || !!this.filterChannel || !!this.filterText.trim();
  }

  clearFilters() {
    this.dateRange     = undefined;
    this.filterChannel = '';
    this.filterText    = '';
    this.applyFilters();
  }

  //  actions 

  deleteBookmark(event: Event, id: string) {
    this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: 'Do you want to delete this record?',
        header: 'Danger Zone',
        icon: 'pi pi-info-circle',
        rejectLabel: 'Cancel',
        rejectButtonProps: {
            label: 'Cancel',
            severity: 'secondary',
            outlined: true
        },
        acceptButtonProps: {
            label: 'Delete',
            severity: 'danger'
        },
    
        accept: () => {
            this.bookmarkService.deleteBookmark(id).subscribe({
              next: () => {
                this.bookmarks = this.bookmarks.filter(b => b.id !== id);
                this.applyFilters();
              },
            });
        },
        reject: () => {
        }
    });
  }

  deleteFiltered(event: Event) {
    this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: 'Do you want to delete this record?',
        header: 'Danger Zone',
        icon: 'pi pi-info-circle',
        rejectLabel: 'Cancel',
        rejectButtonProps: {
            label: 'Cancel',
            severity: 'secondary',
            outlined: true
        },
        acceptButtonProps: {
            label: 'Delete',
            severity: 'danger'
        },
    
        accept: () => {
          const ids = this.filtered.map(b => b.id);
          ids.forEach(id => this.bookmarkService.deleteBookmark(id).subscribe());
          this.bookmarks = this.bookmarks.filter(b => !ids.includes(b.id));
          this.applyFilters();
        },
        reject: () => {
        }
    });
  }

  //  helpers 

  earliestDate(): string {
    if (!this.bookmarks.length) return '—';
    const d = this.bookmarks.reduce((a, b) => a.start < b.start ? a : b).start;
    return d.toISOString().substring(0, 10);
  }

  latestDate(): string {
    if (!this.bookmarks.length) return '—';
    const d = this.bookmarks.reduce((a, b) => a.start > b.start ? a : b).start;
    return d.toISOString().substring(0, 10);
  }

  /** Build query params so the "Open" link pre-fills the archive page */
  bookmarkQueryParams(bm: Bookmark): Record<string, string> {
    return {
      channels: bm.channels.join(','),
      date:     bm.start.toISOString().substring(0, 10),
      start:    bm.start.toISOString().substring(11, 19),
      end:      bm.end.toISOString().substring(11, 19),
      units:    bm.units,
    };
  }
}