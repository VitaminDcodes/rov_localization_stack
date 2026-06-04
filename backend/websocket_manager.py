import asyncio
import websockets
import json
import threading
import math
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from sensor_msgs.msg import Imu

# Global dictionary to hold the latest ROV data
rov_telemetry = {
    "x": 0.0, "y": 0.0, "z": 0.0,
    "vx": 0.0, "vy": 0.0, "vz": 0.0,
    "yaw": 0.0,
    "pitch": 0.0, # NEW
    "roll": 0.0,  # NEW
    "status": "Awaiting Data..."
}

class ROVDataBridge(Node):
    def __init__(self):
        super().__init__('websocket_bridge_node')
        
        # Subscribe to DVL
        self.odom_sub = self.create_subscription(Odometry, '/dvl/odometry', self.odom_callback, 10)
        
        # Subscribe to IMU (Ensure this matches your actual IMU topic name!)
        self.imu_sub = self.create_subscription(Imu, '/imu/data', self.imu_callback, 10)
        
        self.get_logger().info("Backend Bridge listening to DVL and IMU...")

    def odom_callback(self, msg):
        global rov_telemetry
        rov_telemetry["x"] = round(msg.pose.pose.position.x, 3)
        rov_telemetry["y"] = round(msg.pose.pose.position.y, 3)
        rov_telemetry["z"] = round(msg.pose.pose.position.z, 3)
        
        rov_telemetry["vx"] = round(msg.twist.twist.linear.x, 3)
        rov_telemetry["vy"] = round(msg.twist.twist.linear.y, 3)
        rov_telemetry["vz"] = round(msg.twist.twist.linear.z, 3)
        
        # NOTE: If your IMU provides a fused Yaw, you can move this math to the IMU callback
        q = msg.pose.pose.orientation
        siny_cosp = 2.0 * (q.w * q.z + q.x * q.y)
        cosy_cosp = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
        yaw_rad = math.atan2(siny_cosp, cosy_cosp)
        rov_telemetry["yaw"] = round(math.degrees(yaw_rad), 1)

        rov_telemetry["status"] = "Live Stream Active"

    def imu_callback(self, msg):
        global rov_telemetry
        
        ax = msg.linear_acceleration.x
        ay = msg.linear_acceleration.y
        az = msg.linear_acceleration.z
        
        # Calculate Roll and Pitch mathematically from the gravity vector
        try:
            roll_rad = math.atan2(ay, az)
            pitch_rad = math.atan2(-ax, math.sqrt(ay**2 + az**2))
            
            rov_telemetry["roll"] = round(math.degrees(roll_rad), 1)
            rov_telemetry["pitch"] = round(math.degrees(pitch_rad), 1)
        except ValueError:
            pass # Prevent math errors if sensor zeros out momentarily

async def ws_handler(websocket):
    try:
        while True:
            await websocket.send(json.dumps(rov_telemetry))
            await asyncio.sleep(0.05) 
    except websockets.exceptions.ConnectionClosed:
        pass

def spin_ros():
    rclpy.init()
    node = ROVDataBridge()
    rclpy.spin(node)
    rclpy.shutdown()

async def main():
    threading.Thread(target=spin_ros, daemon=True).start()
    print("WebSocket Server starting on ws://localhost:8080")
    async with websockets.serve(ws_handler, "localhost", 8080):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
