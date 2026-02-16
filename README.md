Got it! Here's an updated README with details about the RPI-Seism WebSocket server:

---

# RPI-Seism: Real-time Seismic Station Monitoring

## Overview

RPI-Seism is an Angular-based dashboard application designed for real-time monitoring of seismic data. The application connects to the **RPI-Seism WebSocket server** to receive and visualize seismic data. The dashboard includes both time-domain waveforms and frequency-domain power spectrums (via FFT) for each seismic channel.

Key features:

* **Real-Time Data**: Displays velocity waveforms and FFT power spectrums in real-time as seismic data arrives.
* **WebSocket Integration**: Connects to the RPI-Seism server via WebSocket for continuous data updates.
* **Data Visualization**: Interactive charts for visualizing time-domain waveforms and frequency-domain FFT spectrums.
* **Responsive Design**: Layout adapts to different screen sizes for desktop and mobile users.

## Prerequisites

Before you begin, ensure you have the following installed on your development environment:

* **Node.js** (v14 or higher)
* **Angular CLI** (v12 or higher)

## Installation

### Step 1: Clone the repository

Clone this repository to your local machine:

```bash
git clone https://github.com/your-repository/rpi-seism-dashboard.git
cd rpi-seism-dashboard
```

### Step 2: Install Dependencies

Run the following command to install all required dependencies:

```bash
npm install
```

### Step 3: Start the Development Server

To launch the development server, run:

```bash
ng serve
```

The app will be available at `http://localhost:4200` in your browser.

## RPI-Seism WebSocket Server

This application connects to a **WebSocket server** created by the RPI-Seism server project to fetch seismic data. The WebSocket connection is established to receive the data in real-time.

### WebSocket Server Details

* **Server URL**: `ws://192.168.138.128:8765`
* **Data Format**: The server sends data in the following format:

  * `channel`: The seismic channel identifier (e.g., "channel-1").
  * `data`: Array of seismic data points (e.g., waveform data).
  * `timestamp`: The timestamp of when the data was recorded.

### Setting Up the RPI-Seism WebSocket Server

If you're setting up your own RPI-Seism server, you'll need to ensure that the server is up and running on the specified WebSocket URL (`ws://192.168.138.128:8765`).

For more details on setting up the server, please refer to the **[RPI-Seism Server Project](#link-to-python-repository)**.

## Components

### `dashboard.component.ts`

* **Channels**: Each seismic channel is represented as a dataset with its corresponding time-domain waveform and FFT power spectrum.
* **Charts**: The application uses `p-chart` (PrimeNG) to render line charts for both the waveform and FFT spectrum.
* **Data Updates**: The `updateChart()` method listens to incoming WebSocket messages and updates the charts with new data.

### `websocket-service.ts`

* **WebSocket Connection**: The service manages the WebSocket connection to the RPI-Seism server and ensures automatic reconnection if the connection is lost.
* **Data Subscription**: The `getMessages()` method listens to incoming sensor data and sends it to the `Dashboard` component for visualization.

### `sensor_data.ts`

This file defines the `SensorData` interface to model the incoming sensor data:

* `channel`: The seismic channel that the data came from.
* `data`: The seismic data (an array of waveform values).
* `timestamp`: The timestamp when the data was recorded.

### `dashboard.html`

This template defines the layout of the dashboard:

* **Waveform Visualization**: Each channel has a line chart that visualizes the velocity waveform.
* **FFT Visualization**: A line chart displays the power spectrum derived from the waveform using FFT.
* **Status Indicators**: The dashboard shows the server status, last packet timestamp, and active channel information.

## Customization

### WebSocket Server URL

If you need to change the WebSocket server URL (in case you're connecting to a different server), modify the `WS_URL` in `websocket-service.ts`:

```typescript
private readonly WS_URL = 'ws://your-server-address:port';
```

### Chart Options

You can adjust the chart configurations in the `initChartOptions()` method. Customize elements such as:

* Line colors (`borderColor`)
* Aspect ratios and responsiveness
* Axis configuration
* Data labels and tooltips

### Data Window Size and FFT Configuration

The window size for the waveform and the number of FFT bins can be adjusted by modifying the `WINDOW_SIZE` and `MAX_POINTS` constants in `dashboard.component.ts`. Note that FFT works best with powers of 2 (e.g., 256, 512, 1024).

## Technologies Used

* **Angular**: The main framework for building the application.
* **PrimeNG**: A UI component library used for charts (`p-chart`).
* **RxJS**: For handling asynchronous data streams via WebSocket.
* **FFT.js**: A JavaScript library used for performing FFT calculations.
* **TailwindCSS**: For utility-first styling and responsive design.

## License

This project is licensed under the GNU GPL V3 License. See the [LICENSE](LICENSE) file for details.
