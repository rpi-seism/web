import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WaveformResponse, WaveformsResponse } from '../entities/waveform-response';
import { Observable } from 'rxjs';
import { ArchiveEvent } from '../entities/archive-event';


@Injectable({
  providedIn: 'root',
})
export class ArchiveService {
  private readonly API = environment.httpUrl;

  constructor(private http: HttpClient) {}

  public getAvailableChannels(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API}/archive/channels`);
  }

  public getAvailableDays(channel: string): Observable<string[]> {
    const params = new HttpParams().set('channel', channel);
    return this.http.get<string[]>(`${this.API}/archive/days`, { params });
  }

  public getEvents(channel: string, date: string): Observable<ArchiveEvent[]> {
    const params = new HttpParams()
      .set('channel', channel)
      .set('date', date);
    return this.http.get<ArchiveEvent[]>(`${this.API}/archive/events`, { params });
  }

  public getWaveform(channel: string, start: string, end: string, units: string = 'COUNTS'): Observable<WaveformResponse>  {
    const params = new HttpParams()
      .set('channel', channel)
      .set('start', start)
      .set('end', end)
      .set('units', units);
    return this.http.get<WaveformResponse>(`${this.API}/archive/waveform`, { params });
  }

  public getWaveforms(channels: string[], start: string, end: string, units: string, maxPts = 4000): Observable<WaveformsResponse> {
    // HttpParams doesn't support repeated keys via set(), build manually
    let params = new HttpParams()
      .set('start',    start)
      .set('end',      end)
      .set('units',    units)
      .set('max_pts',  maxPts.toString());
 
    channels.forEach(ch => { params = params.append('channels', ch); });
 
    return this.http.get<WaveformsResponse>(`${this.API}/archive/waveforms`, { params });
  }

  public exportWaveforms(channels: string[], start: string, end: string, units: string, fmt: string): void{
    // HttpParams doesn't support repeated keys via set(), build manually
    let params = new HttpParams()
      .set('start',    start)
      .set('end',      end)
      .set('units',    units)
      .set('fmt',  fmt);
 
    channels.forEach(ch => { params = params.append('channels', ch); });
 
    let url = `${this.API}/archive/export_waveforms?${params.toString()}`;
    window.open(url, '_blank');
  }

  public downloadMseed(channel: string, date: string): void {
    const params = new HttpParams()
      .set('channel', channel)
      .set('date', date);
    const url = `${this.API}/archive/download?${params.toString()}`;
    window.open(url, '_blank');
  }
}
