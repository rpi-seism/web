import { BaseWsMessage } from "./base";


export interface SensorDataPayload {
  channel: string;
  timestamp: string;
  fs: number;
  data: number[];
}

export interface SensorData extends BaseWsMessage {
  payload: SensorDataPayload
}