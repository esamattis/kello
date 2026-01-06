import { render } from "preact";
import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import "./style.css";

// Signal to store the current time
const currentTime = signal(new Date());

// Computed signals for clock hands angles
const secondsAngle = computed(() => {
    const seconds = currentTime.value.getSeconds();
    const milliseconds = currentTime.value.getMilliseconds();
    return ((seconds + milliseconds / 1000) / 60) * 360;
});

const minutesAngle = computed(() => {
    const minutes = currentTime.value.getMinutes();
    const seconds = currentTime.value.getSeconds();
    return ((minutes + seconds / 60) / 60) * 360;
});

const hoursAngle = computed(() => {
    const hours = currentTime.value.getHours() % 12;
    const minutes = currentTime.value.getMinutes();
    return ((hours + minutes / 60) / 12) * 360;
});

function AnalogClock() {
    useEffect(() => {
        const interval = setInterval(() => {
            currentTime.value = new Date();
        }, 50);

        return () => clearInterval(interval);
    }, []);

    // Generate hour markers
    const hourMarkers = [];
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * 360;
        hourMarkers.push(
            <line
                key={`hour-${i}`}
                x1="50"
                y1="8"
                x2="50"
                y2="12"
                stroke="#333333"
                stroke-width="2"
                stroke-linecap="round"
                transform={`rotate(${angle} 50 50)`}
            />,
        );
    }

    // Generate minute markers
    const minuteMarkers = [];
    for (let i = 0; i < 60; i++) {
        if (i % 5 !== 0) {
            const angle = (i / 60) * 360;
            minuteMarkers.push(
                <line
                    key={`minute-${i}`}
                    x1="50"
                    y1="9"
                    x2="50"
                    y2="11"
                    stroke="#666666"
                    stroke-width="0.5"
                    stroke-linecap="round"
                    transform={`rotate(${angle} 50 50)`}
                />,
            );
        }
    }

    // Generate hour numbers
    const hourNumbers = [];
    for (let i = 1; i <= 12; i++) {
        const angle = ((i / 12) * 360 - 90) * (Math.PI / 180);
        const radius = 38;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        hourNumbers.push(
            <text
                key={`number-${i}`}
                x={x}
                y={y}
                text-anchor="middle"
                dominant-baseline="central"
                font-size="8"
                font-family="Arial, sans-serif"
                font-weight="bold"
                fill="#333333"
            >
                {i}
            </text>,
        );
    }

    return (
        <svg
            viewBox="0 0 100 100"
            style={{
                width: "100vmin",
                height: "100vmin",
                display: "block",
            }}
        >
            {/* Clock face */}
            <circle
                cx="50"
                cy="50"
                r="48"
                fill="#ffffff"
                stroke="#333333"
                stroke-width="2"
            />

            {/* Hour markers */}
            {hourMarkers}

            {/* Minute markers */}
            {minuteMarkers}

            {/* Hour numbers */}
            {hourNumbers}

            {/* Hour hand */}
            <line
                x1="50"
                y1="50"
                x2="50"
                y2="28"
                stroke="#222222"
                stroke-width="3"
                stroke-linecap="round"
                transform={`rotate(${hoursAngle.value} 50 50)`}
            />

            {/* Minute hand */}
            <line
                x1="50"
                y1="50"
                x2="50"
                y2="18"
                stroke="#444444"
                stroke-width="2"
                stroke-linecap="round"
                transform={`rotate(${minutesAngle.value} 50 50)`}
            />

            {/* Second hand */}
            <line
                x1="50"
                y1="55"
                x2="50"
                y2="14"
                stroke="#e53e3e"
                stroke-width="1"
                stroke-linecap="round"
                transform={`rotate(${secondsAngle.value} 50 50)`}
            />

            {/* Center dot */}
            <circle cx="50" cy="50" r="2.5" fill="#222222" />
            <circle cx="50" cy="50" r="1" fill="#e53e3e" />
        </svg>
    );
}

export function App() {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100vh",
                margin: 0,
                padding: 0,
                backgroundColor: "#f5f5f5",
            }}
        >
            <AnalogClock />
        </div>
    );
}

render(<App />, document.getElementById("app")!);
