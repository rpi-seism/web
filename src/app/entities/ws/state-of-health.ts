import { BaseWsMessage } from "./base";


export interface StateOfHealthPayload {
    link_quality: number,
    bytes_dropped: number,
    checksum_errors: number,
    last_seen: number,
    connected: boolean
}

export interface StateOfHealth extends BaseWsMessage {
  payload: StateOfHealthPayload
}