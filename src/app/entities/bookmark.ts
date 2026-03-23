export interface Bookmark {
  id:       string;   // crypto.randomUUID()
  label:    string;   // user-defined note e.g. "possible M2.1"
  channels: string[];
  start:    Date;
  end:      Date;
  units:    string;
  savedAt:  Date;   // ISO timestamp
}
