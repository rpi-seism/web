export const environment = {
    production: true,
    httpUrl: `http://${window.location.hostname}:8000`,
    websocketUrl: `ws://${window.location.hostname}:8765`,

    chartsSettings: {
        windowSize: 512,
        maxPoints: 512,
        spectrogramHistory: 300
    }
};