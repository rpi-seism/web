import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BookmarkService {
  private readonly API = environment.httpUrl;

  constructor(private http: HttpClient) {}

  getBookmarks(): Observable<Bookmark[]> {
    return this.http.get<Bookmark[]>(`${this.API}/bookmarks`);
  }

  saveBookmark(bm: Omit<Bookmark, 'id' | 'savedAt'>): Observable<Bookmark> {
    return this.http.post<Bookmark>(`${this.API}/bookmarks`, bm);
  }

  deleteBookmark(id: string): Observable<any> {
    return this.http.delete(`${this.API}/bookmarks/${id}`);
  }
}
