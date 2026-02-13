import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, timer, retry, catchError, EMPTY } from 'rxjs';
import { SensorData } from '../entities/sensor_data';

@Injectable({
  providedIn: 'root',
})
export class WebsocketService {
  private socket$: WebSocketSubject<SensorData> | null = null;
  private readonly RECONNECT_INTERVAL = 3000; // 3 seconds
  private readonly WS_URL = 'ws://192.168.138.128:8765';

  /**
   * Returns a stream of sensor data that automatically reconnects on failure.
   */
  getMessages(): Observable<SensorData> {
    return this.connect().pipe(
      retry({
        delay: (error) => {
          console.warn('WebSocket disconnected. Retrying in 3s...', error);
          return timer(this.RECONNECT_INTERVAL);
        },
        resetOnSuccess: true
      }),
      catchError(err => {
        console.error('WebSocket Error:', err);
        return EMPTY;
      })
    );
  }

  private connect(): WebSocketSubject<SensorData> {
    // If the socket doesn't exist or was closed, create a new one
    if (!this.socket$ || this.socket$.closed) {
      this.socket$ = webSocket({
        url: this.WS_URL,
        // Optional: Run logic when the connection is established
        openObserver: {
          next: () => console.log('WebSocket Connected to Python Server')
        },
        // Optional: Run logic when the connection closes
        closeObserver: {
          next: () => {
            console.warn('WebSocket Connection Closed');
          }
        }
      });
    }
    return this.socket$;
  }
}