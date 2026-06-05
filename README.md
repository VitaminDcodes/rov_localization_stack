# 🌊 ROV Navigation & Localization Stack

A complete marine robotics navigation and localization framework for **Remotely Operated Vehicles (ROVs)** built on **ROS 2 Humble**.

This project combines:

* ROS 2-based sensor integration
* DVL and IMU data fusion
* Real-time localization and dead reckoning
* WebSocket-based telemetry streaming
* Interactive React dashboard
* 3D vehicle visualization
* GPS path tracking
* Mission data recording and export

The system is designed for both **hardware deployment** and **simulation-based testing**, providing a unified environment for underwater robotics research and development.

---

# 🚀 Features

## Navigation & Localization

* Real-time DVL velocity integration
* Dead-reckoning position estimation
* IMU-based orientation tracking
* Full 6-DOF telemetry support
* Global GPS coordinate projection
* Local and global trajectory visualization

## 3D Visualization

* Live 3D ROV model
* Real-time Pitch, Roll, and Yaw updates
* Dynamic compass heading display
* Auto-scaling trajectory visualization
* Hardware-accelerated rendering using React Three Fiber

## Mapping

* Interactive 2D GPS map using Leaflet
* Real-time path visualization
* Dead-reckoning coordinate conversion
* Mission route tracking

## Data Logging

* High-frequency telemetry recording
* CSV export support
* Timestamped mission datasets
* Post-mission analysis capability

## Testing Modes

* Hardware deployment mode
* Dry testing simulation mode
* Figure-8 trajectory simulator
* Development-friendly architecture

---

# 🏗️ System Architecture

```text
┌────────────────────┐
│    DVL / IMU       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│   ROS 2 Humble     │
│ Localization Core  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Python WebSocket   │
│      Bridge        │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  React Dashboard   │
│  3D + 2D Mapping   │
└────────────────────┘
```

---

# 📂 Repository Structure

```text
rov_localization_stack/
│
├── rov_localisation_ws/
│   ├── src/
│   ├── install/
│   ├── build/
│   └── log/
│
├── backend/
│   └── websocket_manager.py
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
└── README.md
```

---

# 📦 Prerequisites

## Operating System

* Ubuntu 22.04 LTS

## ROS Environment

* ROS 2 Humble
* colcon build tools

Install ROS 2 Humble:

```bash
sudo apt update
sudo apt install ros-humble-desktop
```

---

## Python Dependencies

Python 3.10+

Install required packages:

```bash
pip install websockets
```

---

## Frontend Dependencies

Required:

* Node.js 18+
* npm

Main packages:

* three
* @react-three/fiber
* @react-three/drei
* leaflet

---

# 🛠️ Installation

## 1. Clone Repository

```bash
git clone https://github.com/VitaminDcodes/rov_localization_stack.git

cd rov_localization_stack
```

---

## 2. Build ROS 2 Workspace

```bash
cd rov_localisation_ws

colcon build --symlink-install

source install/setup.bash
```

---

## 3. Install Frontend Packages

```bash
cd ../frontend

npm install

npm install three
npm install @react-three/fiber@8
npm install @react-three/drei@9
npm install leaflet

npm install -D @types/three
```

---

# 🚀 Running the System

The complete stack requires three terminals.

---

## Terminal 1 — ROS 2 Layer

```bash
cd ~/rov_localization_stack/rov_localisation_ws

source install/setup.bash
```

### Option A: Simulation Mode

Launch the localization simulator:

```bash
ros2 run fake_localization simulator
```

The simulator generates:

* Figure-8 trajectory
* Position updates
* Velocity data
* Yaw calculations

Perfect for dry testing without hardware.

---

### Option B: Hardware Mode

Launch the DVL driver:

```bash
ros2 run rov_hardware real_dvl_node
```

Launch your IMU driver separately and ensure it publishes to:

```text
/imu/data
```

Default DVL IP:

```text
192.168.194.95
```

---

## Terminal 2 — Backend Bridge

```bash
cd ~/rov_localization_stack/backend

source /opt/ros/humble/setup.bash

python3 websocket_manager.py
```

Expected output:

```text
WebSocket Server starting on ws://localhost:8080
```

---

## Terminal 3 — React Dashboard

```bash
cd ~/rov_localization_stack/frontend

npm run dev
```

Open:

```text
http://localhost:5173
```

---

# 📊 Dashboard Capabilities

## 3D Vehicle Visualization

* Live ROV orientation
* Pitch monitoring
* Roll monitoring
* Yaw monitoring
* Compass heading display

## Trajectory Tracking

* Auto-scaling local grid
* Path visualization
* Velocity tracking

## GPS Mapping

* Real-time coordinate projection
* Global route tracking
* Interactive Leaflet map

## Mission Recorder

Click:

```text
Record
```

to start logging.

Click:

```text
Export
```

to download telemetry as CSV.

Exported fields:

```text
Timestamp
X
Y
Z
Vx
Vy
Vz
Yaw
Pitch
Roll
```

---

# 🔧 Troubleshooting

## 1. Dashboard Connected but ROV Not Moving

### Cause

The DVL does not have acoustic lock.

When operating on a desk or in air, the sensor intentionally outputs:

```text
0.0
```

for all velocity measurements.

### Solution

Place the DVL in water and provide a valid tracking surface.

---

## 2. Pitch and Roll Remain at Zero

### Cause

The backend is not receiving IMU data.

### Solution

Verify IMU topic availability:

```bash
ros2 topic list

ros2 topic echo /imu/data
```

If your IMU publishes to another topic, update:

```text
backend/websocket_manager.py
```

accordingly.

---

## 3. Connection Error in Dashboard

### Cause

The React frontend cannot connect to the WebSocket backend.

### Solution

Verify:

```bash
python3 websocket_manager.py
```

is running.

Restart the backend and refresh the browser.

---

# 📈 Future Enhancements

* Extended Kalman Filter (EKF)
* USBL integration
* GPS initialization support
* 3D bathymetric mapping
* Sonar visualization
* SLAM integration
* Foxglove telemetry support
* Mission replay system

---

# 📜 License
Divyansh arzare (Coratia Technologies) 

This project is intended for robotics research, education, and marine autonomy development.

Contributions and improvements are welcome.
