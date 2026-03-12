import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebsocketService } from '../services/websocket-service';
import { ChartModule } from 'primeng/chart';
import { SensorData } from '../entities/sensor_data';
import FFT from 'fft.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  imports: [CommonModule, ChartModule]
})
export class Dashboard implements OnInit {
  // Data stores
  channels: { [key: string]: any } = {};
  fftChannels: { [key: string]: any } = {};
  lastTimestamp: { [key: string]: string } = {};
  channelKeys: string[] = [];

  // Connection state
  wsState: 'connecting' | 'live' | 'disconnected' = 'connecting';

  // Chart Configurations
  chartOptions: any;
  fftOptions: any;

  // Constants - FFT works best with powers of 2
  readonly WINDOW_SIZE = 512;
  readonly MAX_POINTS = 512;

  // Cached FFT instances — one per channel, allocated once
  private fftInstances: { [key: string]: FFT } = {};

  constructor(
    private dataService: WebsocketService,
    private cdref: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.initChartOptions();

    this.dataService.getMessages().subscribe({
      next: (msg: SensorData) => {
        this.wsState = 'live';
        this.updateChart(msg);
      },
      error: () => {
        this.wsState = 'disconnected';
        this.cdref.detectChanges();
      },
      complete: () => {
        this.wsState = 'disconnected';
        this.cdref.detectChanges();
      }
    });
  }

  private initChartOptions() {
    // Waveform Options
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 1.2,
      animation: false,
      elements: { point: { radius: 0 }, line: { borderWidth: 1.5, tension: 0 } },
      scales: {
        x: { display: false },
        y: {
          grid: { color: '#1e293b' },
          ticks: { color: '#64748b' },
          border: { display: false }
        }
      },
      plugins: { legend: { display: false } }
    };

    // FFT Spectrum Options
    this.fftOptions = {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 1.2,
      animation: false,
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Frequency (Hz)',
            color: '#64748b'
          },
          ticks: {
            color: '#64748b',
            autoSkip: true,
            maxTicksLimit: 10
          },
          grid: { display: false }
        },
        y: {
          type: 'linear',
          grid: { color: '#1e293b' },
          ticks: { display: false },
          border: { display: false }
        }
      },
      plugins: { legend: { display: false } }
    };
  }

  updateChart(msg: SensorData) {
    const { channel, data, fs, timestamp } = msg;

    // Initialize channel structures on first packet
    if (!this.channels[channel]) {
      this.channelKeys.push(channel);
      this.initializeChannelArrays(channel, fs);
    }

    this.lastTimestamp[channel] = timestamp;
    const dataset = this.channels[channel].datasets[0];

    // Append new samples — avoid spread into push which can overflow the call
    // stack for large payloads
    for (const v of data) dataset.data.push(v);

    // Maintain sliding window
    if (dataset.data.length > this.WINDOW_SIZE) {
      dataset.data = dataset.data.slice(-this.WINDOW_SIZE);
    }

    // Trigger immutable reference update so PrimeNG detects the change
    this.channels[channel] = { ...this.channels[channel] };

    // Compute FFT from the updated time-domain window
    this.updateFFT(channel, dataset.data);

    // Manual change detection — no need to also wrap in ngZone.run()
    this.cdref.detectChanges();
  }

  private initializeChannelArrays(channel: string, fs: number) {
    // Pre-compute frequency-axis labels once — they never change for a given fs
    const fftLabels = Array.from(
      { length: this.MAX_POINTS / 2 },
      (_, i) => ((i * fs) / this.MAX_POINTS).toFixed(1) + ' Hz'
    );

    this.channels[channel] = {
      labels: new Array(this.WINDOW_SIZE).fill(''),
      datasets: [{
        data: [],
        borderColor: '#3b82f6',
        fill: false
      }]
    };

    this.fftChannels[channel] = {
      labels: fftLabels,
      datasets: [{
        data: [],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        pointRadius: 0,
        borderWidth: 1
      }]
    };
  }

  private applyHannWindow(data: number[]): number[] {
    const N = data.length;
    return data.map((v, i) => v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))));
  }

  private updateFFT(channel: string, timeData: number[]) {
    if (timeData.length < this.MAX_POINTS) return;

    // Reuse FFT instance per channel — avoids re-allocating on every packet
    if (!this.fftInstances[channel]) {
      this.fftInstances[channel] = new FFT(this.MAX_POINTS);
    }
    const fft = this.fftInstances[channel];

    const out = fft.createComplexArray();

    // Apply Hann window to reduce spectral leakage before transforming
    const windowed = this.applyHannWindow(timeData.slice(-this.MAX_POINTS));
    const dataInput = fft.toComplexArray(windowed, null);
    fft.transform(out, dataInput);

    const magnitudes = new Array(this.MAX_POINTS / 2);
    for (let i = 0; i < this.MAX_POINTS / 2; i++) {
      const real = out[2 * i];
      const imag = out[2 * i + 1];
      magnitudes[i] = Math.sqrt(real * real + imag * imag);
    }

    // Only update the dataset — labels are stable and set once at init
    this.fftChannels[channel] = {
      ...this.fftChannels[channel],
      datasets: [{
        ...this.fftChannels[channel].datasets[0],
        data: magnitudes
      }]
    };
  }
}