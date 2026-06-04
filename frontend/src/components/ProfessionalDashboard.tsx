import React, { useEffect, useState, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Box, Cone, Text } from '@react-three/drei';
import * as THREE from 'three';
import './ProfessionalDashboard.css';

interface Telemetry {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    yaw: number; pitch: number; roll: number;
    status: string;
}

// --- HELPER: YAW TO COMPASS HEADING ---
const getCompassHeading = (yaw: number) => {
    let normalized = ((yaw % 360) + 360) % 360;
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(normalized / 45) % 8];
};

const DynamicCameraController: React.FC<{ maxExtent: number }> = ({ maxExtent }) => {
    const { camera } = useThree();
    useEffect(() => {
        const distance = Math.max(maxExtent * 2.5, 2.0);
        camera.position.set(distance, distance * 0.8, distance);
    }, [maxExtent, camera]);
    return <OrbitControls makeDefault target={[0, 0, 0]} />;
};

const DistanceMarkers: React.FC<{ maxExtent: number }> = ({ maxExtent }) => {
    const step = Math.max(Math.floor(maxExtent / 3), 1); 
    const markers = [];
    const fontSize = Math.max(maxExtent * 0.04, 0.08);

    for (let i = step; i <= Math.ceil(maxExtent); i += step) {
        markers.push(
            <React.Fragment key={i}>
                <Text position={[i, 0.02, 0]} fontSize={fontSize} color="#ef4444" rotation={[-Math.PI/2, 0, 0]} anchorX="center" anchorY="top">{i}m</Text>
                <Text position={[-i, 0.02, 0]} fontSize={fontSize} color="#ef4444" rotation={[-Math.PI/2, 0, 0]} anchorX="center" anchorY="top">-{i}m</Text>
                <Text position={[0, 0.02, -i]} fontSize={fontSize} color="#22c55e" rotation={[-Math.PI/2, 0, 0]} anchorX="left" anchorY="middle">{i}m</Text>
                <Text position={[0, 0.02, i]} fontSize={fontSize} color="#22c55e" rotation={[-Math.PI/2, 0, 0]} anchorX="left" anchorY="middle">-{i}m</Text>
            </React.Fragment>
        );
    }
    return <>{markers}</>;
};

const ProfessionalDashboard: React.FC = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    const [telemetry, setTelemetry] = useState<Telemetry>({
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, 
        yaw: 0, pitch: 0, roll: 0, status: "Disconnected"
    });
    const [pathHistory, setPathHistory] = useState<THREE.Vector3[]>([]);

    // --- DATA RECORDING & EXPORT ENGINE ---
    const isRecordingRef = useRef(false);
    const recordedDataRef = useRef<any[]>([]);
    const [isRecordingUI, setIsRecordingUI] = useState(false);
    const [recordCount, setRecordCount] = useState(0);

    // Updates the UI badge silently once a second so it doesn't freeze the browser
    useEffect(() => {
        const interval = setInterval(() => {
            if (isRecordingRef.current) setRecordCount(recordedDataRef.current.length);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const toggleRecording = () => {
        isRecordingRef.current = !isRecordingRef.current;
        setIsRecordingUI(isRecordingRef.current);
        if (isRecordingRef.current) {
            // Clear old data when starting a new recording
            recordedDataRef.current = [];
            setRecordCount(0);
        }
    };

    const exportToCSV = () => {
        if (recordedDataRef.current.length === 0) return;
        
        // 1. Create Headers
        const headers = ["Timestamp", "X", "Y", "Z", "Vx", "Vy", "Vz", "Yaw", "Pitch", "Roll"].join(",");
        
        // 2. Map Data Rows
        const rows = recordedDataRef.current.map(row => 
            [row.time, row.x, row.y, row.z, row.vx, row.vy, row.vz, row.yaw, row.pitch, row.roll].join(",")
        ).join("\n");
        
        // 3. Generate Blob and trigger download
        const blob = new Blob([headers + "\n" + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ROV_Mission_Data_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- WEBSOCKET CONNECTION ---
    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8080');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            const fullData = {
                ...data,
                vx: data.vx || 0, vy: data.vy || 0, vz: data.vz || 0,
                yaw: data.yaw || 0, pitch: data.pitch || 0, roll: data.roll || 0
            };
            setTelemetry(fullData);

            // If Recording, push directly to the background array
            if (isRecordingRef.current) {
                recordedDataRef.current.push({
                    time: new Date().toISOString(),
                    ...fullData
                });
            }
            
            setPathHistory(prev => {
                const newPos = new THREE.Vector3(fullData.x, fullData.z, -fullData.y);
                const newPath = [...prev, newPos];
                if (newPath.length > 500) newPath.shift();
                return newPath;
            });
        };
        ws.onerror = () => setTelemetry(prev => ({ ...prev, status: "Connection Error" }));
        return () => ws.close();
    }, []);

    // --- INITIALIZE LEAFLET MAP ---
    useEffect(() => {
        if (mapRef.current && !mapInstance.current) {
            mapInstance.current = L.map(mapRef.current, {
                zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: true
            }).setView([22.2533, 84.9016], 19);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd', maxZoom: 22
            }).addTo(mapInstance.current);

            polylineRef.current = L.polyline([], { color: '#e03030', weight: 3, opacity: 0.9 }).addTo(mapInstance.current);
            
            const pulseIcon = L.divIcon({
                className: '',
                html: `<div style="width:14px;height:14px;position:relative">
                        <div style="width:14px;height:14px;border-radius:50%;background:#1d9e75;opacity:.4;position:absolute"></div>
                        <div style="width:8px;height:8px;border-radius:50%;background:#16a34a;position:absolute;top:3px;left:3px"></div>
                       </div>`,
                iconSize: [14, 14], iconAnchor: [7, 7]
            });
            markerRef.current = L.marker([22.2533, 84.9016], { icon: pulseIcon }).addTo(mapInstance.current);
        }
    }, []);

    // --- MAP DEAD-RECKONING UPDATE ---
    useEffect(() => {
        if (!mapInstance.current || !polylineRef.current || !markerRef.current) return;

        const ORIGIN_LAT = 22.2533;
        const ORIGIN_LON = 84.9016;

        const latLngs = pathHistory.map(p => {
            const latOffset = p.x / 111320; 
            const lonOffset = -(p.y) / (111320 * Math.cos(ORIGIN_LAT * (Math.PI / 180)));
            return new L.LatLng(ORIGIN_LAT + latOffset, ORIGIN_LON + lonOffset);
        });

        if (latLngs.length > 0) {
            polylineRef.current.setLatLngs(latLngs);
            const currentPosition = latLngs[latLngs.length - 1];
            markerRef.current.setLatLng(currentPosition);
        }
    }, [pathHistory]);

    const maxExtent = useMemo(() => {
        if (pathHistory.length === 0) return 1.0;
        const max = Math.max(...pathHistory.map(p => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))));
        return Math.max(max, 1.0); 
    }, [pathHistory]);

    const isConnected = telemetry.status === "Live Stream Active";

    return (
        <div className="db">
            {/* TOP BAR */}
            <div className="topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="logo">ROV NAVIGATOR</div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                        <span className={`live-dot ${!isConnected ? 'offline' : ''}`}></span>
                        {telemetry.status}
                    </div>
                    
                    {/* DATA LOGGER CONTROLS */}
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                        <button 
                            onClick={toggleRecording}
                            style={{
                                background: isRecordingUI ? '#fee2e2' : '#ef4444',
                                color: isRecordingUI ? '#dc2626' : '#ffffff',
                                border: isRecordingUI ? '1px solid #ef4444' : 'none',
                                padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
                            }}
                        >
                            {isRecordingUI ? `🔴 RECORDING... (${recordCount})` : '▶ START RECORDING'}
                        </button>
                        
                        <button 
                            onClick={exportToCSV}
                            disabled={isRecordingUI || recordCount === 0}
                            style={{
                                background: (isRecordingUI || recordCount === 0) ? '#e2e8f0' : '#0ea5e9',
                                color: (isRecordingUI || recordCount === 0) ? '#94a3b8' : '#ffffff',
                                border: 'none', padding: '4px 12px', borderRadius: '4px', 
                                cursor: (isRecordingUI || recordCount === 0) ? 'not-allowed' : 'pointer', 
                                fontSize: '11px', fontWeight: 'bold'
                            }}
                        >
                            ⬇ EXPORT EXCEL
                        </button>
                    </div>
                </div>

                <div className="top-stats">
                    {/* COMPASS HEADING */}
                    <div className="stat">Heading <span>{getCompassHeading(telemetry.yaw)} ({telemetry.yaw.toFixed(1)}°)</span></div>
                    <div className="stat">Pitch <span>{telemetry.pitch.toFixed(1)}°</span></div>
                    <div className="stat">Roll <span>{telemetry.roll.toFixed(1)}°</span></div>
                    <div className="stat">Depth <span>{Math.abs(telemetry.z).toFixed(2)} m</span></div>
                    <div className="stat">UTC <span>{new Date().toISOString().substring(11, 19)}</span></div>
                </div>
            </div>

            <div className="panels">
                {/* 3D TRAJECTORY PANEL */}
                <div className="panel" style={{ position: 'relative' }}>
                    <div className="ph">
                        <div className="plabel">Local Trajectory (Anchored)</div>
                    </div>
                    
                    <div className="traj-panel" style={{ background: '#0f172a' }}>
                        <Canvas>
                            <ambientLight intensity={0.5} />
                            <directionalLight position={[10, 10, 5]} intensity={1} />
                            <DynamicCameraController maxExtent={maxExtent} />
                            
                            <Grid 
                                infiniteGrid 
                                fadeDistance={Math.max(maxExtent * 10, 5)} 
                                sectionSize={Math.max(maxExtent / 2, 0.5)} 
                                cellSize={Math.max(maxExtent / 10, 0.1)} 
                                sectionColor="#334155" 
                                cellColor="#1e293b" 
                                position={[0, -0.01, 0]} 
                            />

                            <axesHelper args={[maxExtent * 1.5]} />
                            <DistanceMarkers maxExtent={maxExtent} />

                            {pathHistory.length > 1 && (
                                <Line points={pathHistory} color="#38bdf8" lineWidth={3} />
                            )}

                            {/* ROV IS ALWAYS VISIBLE NOW */}
                            <group 
                                position={[telemetry.x, telemetry.z, -telemetry.y]} 
                                rotation={[
                                    telemetry.pitch * (Math.PI/180),
                                    -telemetry.yaw * (Math.PI/180),
                                    telemetry.roll * (Math.PI/180)
                                ]}
                            >
                                <Box args={[0.2, 0.1, 0.3]} material-color="#0284c7" />
                                <Cone args={[0.05, 0.15, 16]} position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]} material-color="#fbbf24" />
                            </group>
                        </Canvas>

                        {/* BOTTOM OVERLAY */}
                        <div className="coord-overlay" style={{ flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div className="co-item">X <span>{telemetry.x.toFixed(3)}</span></div>
                                <div className="co-item">Y <span>{telemetry.y.toFixed(3)}</span></div>
                                <div className="co-item">Z <span>{telemetry.z.toFixed(3)}</span></div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div className="co-item" style={{ borderColor: '#38bdf8' }}>Vx <span>{telemetry.vx.toFixed(3)}</span></div>
                                <div className="co-item" style={{ borderColor: '#38bdf8' }}>Vy <span>{telemetry.vy.toFixed(3)}</span></div>
                                <div className="co-item" style={{ borderColor: '#38bdf8' }}>Vz <span>{telemetry.vz.toFixed(3)}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* GPS MAP PANEL */}
                <div className="panel">
                    <div className="ph">
                        <div className="plabel">Global Position</div>
                    </div>
                    <div className="map-panel" ref={mapRef}></div>
                </div>
            </div>
        </div>
    );
};

export default ProfessionalDashboard;
