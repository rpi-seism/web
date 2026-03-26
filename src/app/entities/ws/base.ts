import { WebsocketMessageTypeEnum } from "./enums";

export interface BaseWsMessage{
    type: WebsocketMessageTypeEnum;
    timestamp: Date;
}