interface WaveformResponse {
  channel:      string;
  network:      string;
  station:      string;
  units:        string;
  fs:           number;
  starttime:    string;
  endtime:      string;
  npts_raw:     number;
  npts_display: number;
  data:         number[];
}