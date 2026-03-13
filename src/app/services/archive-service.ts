import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class ArchiveService {
  private readonly API = environment.httpUrl;

  constructor(private http: HttpClient) {}

  public getAvailableChannels() {
    return this.http.get<string[]>(`${this.API}/archive/channels`);
  }

  public getAvailableDays(channel: string) {
    const params = new HttpParams().set('channel', channel);
    return this.http.get<string[]>(`${this.API}/archive/days`, { params });
  }

  public getEvents(channel: string, date: string) {
    const params = new HttpParams()
      .set('channel', channel)
      .set('date', date);
    return this.http.get<any[]>(`${this.API}/archive/events`, { params });
  }

  public getWaveform(channel: string, start: string, end: string, units: string = 'COUNTS') {
    const params = new HttpParams()
      .set('channel', channel)
      .set('start', start)
      .set('end', end)
      .set('units', units);
    return this.http.get<any>(`${this.API}/archive/waveform`, { params });
  }

  public downloadMseed(channel: string, date: string): void {
    const params = new HttpParams()
      .set('channel', channel)
      .set('date', date);
    const url = `${this.API}/archive/download?${params.toString()}`;
    window.open(url, '_blank');
  }
}
