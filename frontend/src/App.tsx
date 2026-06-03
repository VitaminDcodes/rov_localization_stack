import React, { useEffect } from 'react';
import { useTrajectoryStore } from './store/trajectoryStore';
import { wsService } from './services/websocketService';

function App() {
  const currentPose = useTrajectoryStore((state) => state.currentPose);
  const isConnected = useTrajectoryStore((state) => state.isConnected);
  const trajectory = useTrajectoryStore((state) => state.trajectory);

  useEffect(() => {
    wsService.connect().catch(console.error);
    return () => wsService.disconnect();
  }, []);

  return (
    <div style={{ padding: '20px', color: '#fff' }}>
      <h1>ROV Localization Dashboard</h1>
      <div style={{ marginTop: '20px' }}>
        <p>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
        {currentPose && (
          <div>
            <p>X: {currentPose.x.toFixed(2)} m</p>
            <p>Y: {currentPose.y.toFixed(2)} m</p>
            <p>Z: {currentPose.z.toFixed(2)} m</p>
            <p>Yaw: {currentPose.yaw.toFixed(2)} rad</p>
            <p>Trajectory Points: {trajectory.length}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
