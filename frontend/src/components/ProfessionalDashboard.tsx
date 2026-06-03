import React, { useEffect, useRef, useState } from 'react';
import { useTrajectoryStore } from '../store/trajectoryStore';
import * as THREE from 'three';
import './ProfessionalDashboard.css';

interface DashboardStats {
  depth: number;
  heading: number;
  speed: number;
  updateRate: number;
  wsLatency: number;
}

export const ProfessionalDashboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const trajectoryRef = useRef<HTMLDivElement>(null);
  const depthChartRef = useRef<HTMLDivElement>(null);

  const currentPose = useTrajectoryStore((state) => state.currentPose);
  const trajectory = useTrajectoryStore((state) => state.trajectory);
  const connectionStatus = useTrajectoryStore((state) => state.connectionStatus);
  const isConnected = useTrajectoryStore((state) => state.isConnected);
  const updateCount = useTrajectoryStore((state) => state.updateCount);

  const [stats, setStats] = useState<DashboardStats>({
    depth: 0,
    heading: 0,
    speed: 0,
    updateRate: 0,
    wsLatency: 0,
  });

  const lastUpdateRef = useRef<number>(Date.now());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const mapInstanceRef = useRef<any>(null);

  // Calculate statistics
  useEffect(() => {
    if (!currentPose) return;

    const now = Date.now();
    const deltaTime = (now - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = now;

    const depth = Math.abs(currentPose.z);
    const heading = ((currentPose.yaw * 180) / Math.PI) % 360;
    const speed = trajectory.length > 1 
      ? Math.sqrt(
          Math.pow(trajectory[trajectory.length - 1].x - trajectory[trajectory.length - 2].x, 2) +
          Math.pow(trajectory[trajectory.length - 1].y - trajectory[trajectory.length - 2].y, 2) +
          Math.pow(trajectory[trajectory.length - 1].z - trajectory[trajectory.length - 2].z, 2)
        ) / deltaTime
      : 0;

    setStats({
      depth: Math.round(depth * 10) / 10,
      heading: Math.round(heading),
      speed: Math.round(speed * 100) / 100,
      updateRate: updateCount,
      wsLatency: Math.random() * 20 + 5, // Simulated latency
    });
  }, [currentPose, trajectory, updateCount]);

  // Initialize 3D trajectory viewer
  useEffect(() => {
    if (!trajectoryRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a0d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      trajectoryRef.current.clientWidth / trajectoryRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(trajectoryRef.current.clientWidth, trajectoryRef.current.clientHeight);
    trajectoryRef.current.appendChild(renderer.domElement);

    // Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x2a4a6a, 0x1a2a4a);
    scene.add(gridHelper);

    // Axes
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Vehicle marker
    const vehicleGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const vehicleMaterial = new THREE.MeshStandardMaterial({ color: 0x1d9e75 });
    const vehicleMarker = new THREE.Mesh(vehicleGeometry, vehicleMaterial);
    scene.add(vehicleMarker);

    // Trajectory line
    const trajectoryGeometry = new THREE.BufferGeometry();
    const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x378add, linewidth: 2 });
    const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
    scene.add(trajectoryLine);

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);

      if (currentPose) {
        vehicleMarker.position.set(currentPose.x, currentPose.z, currentPose.y);
      }

      if (trajectory.length > 1) {
        const points = trajectory.map((p) => new THREE.Vector3(p.x, p.z, p.y));
        trajectoryGeometry.setFromPoints(points);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      trajectoryRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
      }).setView([24.4832, 118.2091], 16);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add marker
      const pulseIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;position:relative">
          <div style="width:14px;height:14px;border-radius:50%;background:#1d9e75;opacity:.25;position:absolute"></div>
          <div style="width:8px;height:8px;border-radius:50%;background:#5dcaa5;position:absolute;top:3px;left:3px"></div>
        </div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([24.4832, 118.2091], { icon: pulseIcon }).addTo(map);
    });
  }, []);

  // Update depth chart
  useEffect(() => {
    if (!depthChartRef.current || trajectory.length === 0) return;

    const recentTrajectory = trajectory.slice(-20);
    const minDepth = Math.min(...recentTrajectory.map((p) => Math.abs(p.z)));
    const maxDepth = Math.max(...recentTrajectory.map((p) => Math.abs(p.z)));

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '90');
    svg.setAttribute('viewBox', `0 0 ${recentTrajectory.length * 30} 90`);
    svg.setAttribute('preserveAspectRatio', 'none');

    let pathData = `M 0 ${45 - ((recentTrajectory[0].z + 20) / 10) * 45}`;
    recentTrajectory.forEach((p, i) => {
      const y = 45 - ((Math.abs(p.z) - minDepth) / (maxDepth - minDepth + 0.1)) * 45;
      pathData += ` L ${i * 30} ${y}`;
    });

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', '#185fa5');
    polyline.setAttribute('stroke-width', '1.5');
    polyline.setAttribute('points', pathData);

    svg.appendChild(polyline);
    depthChartRef.current.innerHTML = '';
    depthChartRef.current.appendChild(svg);
  }, [trajectory]);

  const now = new Date();
  const utcTime = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' });

  return (
    <div className="rov-dashboard">
      <div className="db">
        {/* Top Bar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="logo">ROV LOCALIZATION</div>
            <div style={{ width: '1px', height: '16px', background: '#1a2a3a' }}></div>
            <div style={{ fontSize: '11px', color: '#2a4a6a' }}>
              <span className={`live-dot ${isConnected ? 'active' : ''}`}></span>
              <span style={{ color: isConnected ? '#1d9e75' : '#ff3333' }}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#2a4a6a' }}>
              Mission <span style={{ color: '#7abeee' }}>REEF-07</span>
            </div>
          </div>
          <div className="top-stats">
            <div className="stat">
              Depth <span>{stats.depth} m</span>
            </div>
            <div className="stat">
              Heading <span>{stats.heading}°</span>
            </div>
            <div className="stat">
              Speed <span>{stats.speed} m/s</span>
            </div>
            <div className="stat">
              UTC <span>{utcTime}</span>
            </div>
          </div>
        </div>

        {/* Main Panels */}
        <div className="panels">
          {/* 3D Trajectory */}
          <div className="panel">
            <div className="ph">
              <div className="plabel">3D Trajectory</div>
              <div className="ptag">Real-time</div>
            </div>
            <div className="traj-panel" ref={trajectoryRef}></div>
            {currentPose && (
              <div className="coord-overlay">
                <div className="co-item">
                  X <span>{currentPose.x.toFixed(1)} m</span>
                </div>
                <div className="co-item">
                  Y <span>{currentPose.y.toFixed(1)} m</span>
                </div>
                <div className="co-item">
                  Z <span>{currentPose.z.toFixed(1)} m</span>
                </div>
              </div>
            )}
          </div>

          {/* GPS Map */}
          <div className="panel">
            <div className="ph">
              <div className="plabel">GPS Map</div>
              <div className="ptag">DGPS · hdop 1.2</div>
            </div>
            <div className="map-panel" ref={mapRef}></div>
            <div className="map-badge">24.4832°N 118.2091°E</div>
          </div>

          {/* Depth Chart */}
          <div className="panel depth-panel">
            <div className="depth-inner">
              <div className="depth-header">
                <div className="depth-title">Depth</div>
                <div className="depth-val">{stats.depth} m</div>
              </div>
              <div style={{ position: 'relative', height: '106px', marginTop: '4px' }}>
                <div className="axis-y">
                  <div className="ay">−20</div>
                  <div className="ay">−25</div>
                  <div className="ay">−30</div>
                </div>
                <div className="chart-area" ref={depthChartRef}></div>
                <div className="axis-x">
                  <div className="ax">−5:00</div>
                  <div className="ax">−4:00</div>
                  <div className="ax">−3:00</div>
                  <div className="ax">−2:00</div>
                  <div className="ax">−1:00</div>
                  <div className="ax">now</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="statusbar">
          <div className="sb">
            <span className="live-dot-small"></span>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
          <div className="sbsep"></div>
          <div className="sb">
            WS latency <span>{Math.round(stats.wsLatency)} ms</span>
          </div>
          <div className="sbsep"></div>
          <div className="sb">
            Pose <span>10 Hz</span>
          </div>
          <div className="sbsep"></div>
          <div className="sb">
            Status <span>{connectionStatus}</span>
          </div>
          <div className="sbsep"></div>
          <div className="sb">
            Updates <span>{stats.updateRate}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDashboard;
