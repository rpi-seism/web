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

  // Chart Configurations
  chartOptions: any;
  fftOptions: any;

  // Constants - FFT works best with powers of 2
  readonly WINDOW_SIZE = 512;
  readonly MAX_POINTS = 512;

  constructor(
    private dataService: WebsocketService,
    private ngZone: NgZone,
    private cdref: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.initChartOptions();
    
    // Subscribe to the Python WebSocket stream
    this.dataService.getMessages().subscribe({
      next: (msg: SensorData) => this.updateChart(msg),
      error: (err) => console.error('WebSocket Error:', err)
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
            autoSkip: true, // Crucial: prevents 256 labels from overlapping
            maxTicksLimit: 10 // Shows about 10 frequency markers across the bottom
          },
          grid: { display: false }
        },
        y: { 
          type: 'linear', // Change to 'logarithmic' to see low-level noise
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

    // Initialize channel if it's the first time we see it
    if (!this.channels[channel]) {
      this.channelKeys.push(channel);
      this.initializeChannelArrays(channel);
    }

    this.lastTimestamp[channel] = timestamp;
    const dataset = this.channels[channel].datasets[0];
    
    // Append new data (using spread because data is a list from Python)
    dataset.data.push(...data);
    
    // Maintain sliding window
    if (dataset.data.length > this.WINDOW_SIZE) {
      dataset.data = dataset.data.slice(-this.WINDOW_SIZE);
    }
    
    // Run update inside Angular Zone for UI responsiveness
    this.ngZone.run(() => {
      // Refresh Waveform Reference
      this.channels[channel] = { ...this.channels[channel] };

      // Compute FFT from the updated time-domain window
      this.updateFFT(channel, fs, dataset.data);

      this.cdref.detectChanges();
    });
  }

  private initializeChannelArrays(channel: string) {
    // Initial waveform structure
    this.channels[channel] = {
      labels: new Array(this.WINDOW_SIZE).fill(''),
      datasets: [{
        data: [],
        borderColor: '#3b82f6',
        fill: false
      }]
    };

    // Initial FFT structure
    this.fftChannels[channel] = {
      labels: new Array(this.MAX_POINTS / 2).fill(''),
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

private updateFFT(channel: string, fs: number, timeData: number[]) {
  if (timeData.length < this.MAX_POINTS) return;

  const fft = new FFT(this.MAX_POINTS);
  const out = fft.createComplexArray();
  const dataInput = fft.toComplexArray(timeData, null);
  fft.transform(out, dataInput);

  const magnitudes = [];
  const labels = [];
  const numBins = this.MAX_POINTS / 2;

  for (let i = 0; i < numBins; i++) {
    const real = out[2 * i];
    const imag = out[2 * i + 1];
    magnitudes.push(Math.sqrt(real * real + imag * imag));

    // Calculate Frequency for this bin: (index * sampleRate) / totalPoints
    const freq = (i * fs) / this.MAX_POINTS;
    labels.push(freq.toFixed(1) + ' Hz'); 
  }

  this.fftChannels[channel] = {
    ...this.fftChannels[channel],
    labels: labels, // <--- Update the labels here
    datasets: [{
      ...this.fftChannels[channel].datasets[0],
      data: magnitudes
    }]
  };
}
}