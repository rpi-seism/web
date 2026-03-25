import { ChangeDetectorRef, Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebsocketService } from '../services/websocket-service';
import { ChartModule } from 'primeng/chart';
import { SensorData } from '../entities/ws/sensor-data';
import { RouterModule } from '@angular/router';
import FFT from 'fft.js';

interface SpectrogramFrame {
  magnitudes: number[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  imports: [CommonModule, ChartModule, RouterModule],
})
export class Dashboard implements OnInit {
  channels: { [key: string]: any } = {};
  fftChannels: { [key: string]: any } = {};
  lastTimestamp: { [key: string]: string } = {};
  channelKeys: string[] = [];
  spectrogramFrames: { [key: string]: SpectrogramFrame[] } = {};

  wsState: 'connecting' | 'live' | 'disconnected' = 'connecting';
  fftLogarithmic = false;

  chartOptions: any;
  fftOptions: any;

  readonly WINDOW_SIZE = 512;
  readonly MAX_POINTS = 512;
  readonly SPECTROGRAM_HISTORY = 300;

  @ViewChildren('spectrogramCanvas') spectrogramCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  private fftInstances: { [key: string]: FFT } = {};
  private colourMap: string[] = [];

  // fs is only known after the first packet — store it per channel
  // so labels can be (re)built correctly
  private channelFs: { [key: string]: number } = {};

  constructor(
    private dataService: WebsocketService,
    private cdref: ChangeDetectorRef,
  ) {
    this.buildColourMap();
  }

  ngOnInit() {
    this.initChartOptions();

    this.dataService.getSensorUpdates().subscribe({
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

  //  FFT scale toggle 

  toggleFftScale() {
    this.fftLogarithmic = !this.fftLogarithmic;
    this.fftOptions = {
      ...this.fftOptions,
      scales: {
        ...this.fftOptions.scales,
        y: {
          ...this.fftOptions.scales.y,
          type: this.fftLogarithmic ? 'logarithmic' : 'linear'
        }
      }
    };
    this.cdref.detectChanges();
  }

  //  Chart options 

  private initChartOptions() {
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
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

    this.fftOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          display: true,
          title: { display: true, text: 'Frequency (Hz)', color: '#64748b' },
          ticks: { color: '#64748b', autoSkip: true, maxTicksLimit: 10 },
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

  //  Incoming data 

  updateChart(msg: SensorData) {
    const { channel, data, fs, timestamp } = msg.payload;

    // Guard: skip packet if fs is missing or zero — labels would be NaN
    if (!fs || isNaN(fs) || fs <= 0) {
      console.warn('[dashboard] packet rejected — invalid fs:', fs, msg);
      return;
    }

    const isNewChannel = !this.channels[channel];
    if (isNewChannel) {
      this.channelKeys.push(channel);
      this.channelFs[channel] = fs;
      this.initializeChannelArrays(channel, fs);
    }

    this.lastTimestamp[channel] = timestamp;
    const dataset = this.channels[channel].datasets[0];

    for (const v of data) dataset.data.push(v);

    if (dataset.data.length > this.WINDOW_SIZE) {
      dataset.data = dataset.data.slice(-this.WINDOW_SIZE);
    }

    this.channels[channel] = { ...this.channels[channel] };

    const magnitudes = this.updateFFT(channel, dataset.data);

    //  detectChanges FIRST so the canvas is in the DOM before we draw 
    // For a brand-new channel the @ViewChildren QueryList is not updated
    // until Angular runs change detection, so renderSpectrogram would find
    // no canvas element if called before this point.
    this.cdref.detectChanges();

    if (magnitudes) {
      this.pushSpectrogramFrame(channel, magnitudes);
      this.renderSpectrogram(channel);
    }
  }

  //  Channel initialisation 

  private initializeChannelArrays(channel: string, fs: number) {
    // fs is validated before this call — no NaN risk here
    const fftLabels = Array.from(
      { length: this.MAX_POINTS / 2 },
      (_, i) => ((i * fs) / this.MAX_POINTS).toFixed(1) + ' Hz'
    );

    this.channels[channel] = {
      labels: new Array(this.WINDOW_SIZE).fill(''),
      datasets: [{ data: [], borderColor: '#3b82f6', fill: false }]
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

    this.spectrogramFrames[channel] = [];
  }

  //  FFT 

  private applyHannWindow(data: number[]): number[] {
    const N = data.length;
    return data.map((v, i) => v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))));
  }

  private updateFFT(channel: string, timeData: number[]): number[] | null {
    if (timeData.length < this.MAX_POINTS) return null;

    if (!this.fftInstances[channel]) {
      this.fftInstances[channel] = new FFT(this.MAX_POINTS);
    }
    const fft = this.fftInstances[channel];

    const out = fft.createComplexArray();
    const windowed = this.applyHannWindow(timeData.slice(-this.MAX_POINTS));
    fft.transform(out, fft.toComplexArray(windowed, null));

    const numBins = this.MAX_POINTS / 2;
    const magnitudes = new Array(numBins);
    for (let i = 0; i < numBins; i++) {
      const real = out[2 * i];
      const imag = out[2 * i + 1];
      magnitudes[i] = Math.sqrt(real * real + imag * imag);
    }

    this.fftChannels[channel] = {
      ...this.fftChannels[channel],
      datasets: [{
        ...this.fftChannels[channel].datasets[0],
        data: magnitudes
      }]
    };

    return magnitudes;
  }

  //  Spectrogram 

  private pushSpectrogramFrame(channel: string, magnitudes: number[]) {
    const frames = this.spectrogramFrames[channel];
    frames.push({ magnitudes: [...magnitudes] });
    if (frames.length > this.SPECTROGRAM_HISTORY) {
      frames.shift();
    }
  }

  renderSpectrogram(channel: string) {
    const idx = this.channelKeys.indexOf(channel);
    const canvasEl = this.spectrogramCanvases?.toArray()[idx]?.nativeElement;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const frames = this.spectrogramFrames[channel];
    if (frames.length === 0) return;

    const numBins = this.MAX_POINTS / 2;
    const canvasW = canvasEl.width;
    const canvasH = canvasEl.height;
    const colW = canvasW / this.SPECTROGRAM_HISTORY;
    const rowH = canvasH / numBins;

    let globalMax = 0;
    for (const frame of frames) {
      for (const m of frame.magnitudes) {
        if (m > globalMax) globalMax = m;
      }
    }
    if (globalMax === 0) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    const startX = (this.SPECTROGRAM_HISTORY - frames.length) * colW;

    for (let t = 0; t < frames.length; t++) {
      const x = startX + t * colW;
      const { magnitudes } = frames[t];

      for (let b = 0; b < numBins; b++) {
        const y = canvasH - (b + 1) * rowH;
        const norm = magnitudes[b] / globalMax;
        ctx.fillStyle = this.colourMap[Math.min(255, Math.floor(norm * 255))];
        ctx.fillRect(x, y, Math.ceil(colW) + 1, Math.ceil(rowH) + 1);
      }
    }
  }

  private buildColourMap() {
    this.colourMap = Array.from({ length: 256 }, (_, i) => {
      const t = i / 255;
      const r = Math.round(255 * Math.min(1, Math.max(0,
        t < 0.5 ? 2 * t * 0.7 : 0.7 + (t - 0.5) * 2 * 0.6
      )));
      const g = Math.round(255 * Math.min(1, Math.max(0,
        t < 0.4 ? 0 : (t - 0.4) * (1 / 0.6)
      )));
      const b = Math.round(255 * Math.min(1, Math.max(0,
        t < 0.3 ? t * (1 / 0.3) * 0.7 : 0.7 * (1 - (t - 0.3) * (1 / 0.7))
      )));
      return `rgb(${r},${g},${b})`;
    });
  }
}