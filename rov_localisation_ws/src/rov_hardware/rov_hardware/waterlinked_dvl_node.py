import rclpy
from rclpy.node import Node
from geometry_msgs.msg import TwistWithCovarianceStamped, Quaternion, PoseStamped, TransformStamped
from sensor_msgs.msg import Range
from nav_msgs.msg import Odometry, Path
from tf2_ros import TransformBroadcaster
import socket
import json

class CompleteDVLNode(Node):
    def __init__(self):
        super().__init__('complete_dvl_node')
        
        # Publishers
        self.vel_pub = self.create_publisher(TwistWithCovarianceStamped, '/dvl/velocity', 10)
        self.alt_pub = self.create_publisher(Range, '/dvl/altitude', 10)
        self.odom_pub = self.create_publisher(Odometry, '/dvl/odometry', 10)
        self.path_pub = self.create_publisher(Path, '/dvl/path', 10)
        
        self.tf_broadcaster = TransformBroadcaster(self)
        
        self.path_msg = Path()
        self.path_msg.header.frame_id = 'odom'
        
        # --- Internal Dead Reckoning Trackers ---
        self.current_x = 0.0
        self.current_y = 0.0
        self.current_z = 0.0
        self.last_time = self.get_clock().now()
        
        # DVL Network
        self.dvl_ip = '192.168.194.95'  
        self.dvl_port = 16171         
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.connect_to_dvl()
        self.timer = self.create_timer(0.05, self.read_and_publish)

    def connect_to_dvl(self):
        self.get_logger().info(f"Connecting to DVL at {self.dvl_ip}:{self.dvl_port}...")
        try:
            self.sock.connect((self.dvl_ip, self.dvl_port))
            self.sock.setblocking(False)
            self.get_logger().info("Connected! Streaming full telemetry...")
        except Exception as e:
            self.get_logger().error(f"Connection failed: {e}")

    def read_and_publish(self):
        try:
            data = self.sock.recv(4096).decode('utf-8')
            if not data: return
            
            packets = [p for p in data.split('\n') if p.strip()]
            if not packets: return
            dvl = json.loads(packets[-1])
            
            current_time = self.get_clock().now()
            current_time_msg = current_time.to_msg()
            
            # --- 1. ALTITUDE ---
            if 'altitude' in dvl:
                alt_msg = Range()
                alt_msg.header.stamp = current_time_msg
                alt_msg.header.frame_id = "dvl_link"
                alt_msg.radiation_type = Range.ULTRASOUND
                alt_msg.range = float(dvl['altitude'])
                self.alt_pub.publish(alt_msg)

            # --- 2. VELOCITY & CALCULATED ODOMETRY ---
            if dvl.get('velocity_valid'):
                vx = float(dvl.get('vx', 0.0))
                vy = float(dvl.get('vy', 0.0))
                vz = float(dvl.get('vz', 0.0))
                
                # Publish raw Twist (Velocity)
                vel_msg = TwistWithCovarianceStamped()
                vel_msg.header.stamp = current_time_msg
                vel_msg.header.frame_id = "dvl_link"
                vel_msg.twist.twist.linear.x = vx
                vel_msg.twist.twist.linear.y = vy
                vel_msg.twist.twist.linear.z = vz
                fom = float(dvl.get('fom', 0.01))
                vel_msg.twist.covariance[0] = fom 
                vel_msg.twist.covariance[7] = fom
                vel_msg.twist.covariance[14] = fom
                self.vel_pub.publish(vel_msg)

                # --- 3. INTEGRATE POSITION (The Missing Piece!) ---
                dt = (current_time - self.last_time).nanoseconds / 1e9
                self.last_time = current_time
                
                self.current_x += vx * dt
                self.current_y += vy * dt
                self.current_z += vz * dt
                
                # Assume no rotation for now (IMU will handle this later)
                quat = Quaternion(x=0.0, y=0.0, z=0.0, w=1.0)

                # Publish Map Odometry
                odom_msg = Odometry()
                odom_msg.header.stamp = current_time_msg
                odom_msg.header.frame_id = "odom"
                odom_msg.child_frame_id = "base_link"
                odom_msg.pose.pose.position.x = self.current_x
                odom_msg.pose.pose.position.y = self.current_y
                odom_msg.pose.pose.position.z = self.current_z
                odom_msg.pose.pose.orientation = quat
                self.odom_pub.publish(odom_msg)

                # Broadcast TF to RViz
                t = TransformStamped()
                t.header.stamp = current_time_msg
                t.header.frame_id = "odom"
                t.child_frame_id = "base_link"
                t.transform.translation.x = self.current_x
                t.transform.translation.y = self.current_y
                t.transform.translation.z = self.current_z
                t.transform.rotation = quat
                self.tf_broadcaster.sendTransform(t)

                # Append to Line Path
                pose_stamped = PoseStamped()
                pose_stamped.header.stamp = current_time_msg
                pose_stamped.header.frame_id = "odom"
                pose_stamped.pose.position.x = self.current_x
                pose_stamped.pose.position.y = self.current_y
                pose_stamped.pose.position.z = self.current_z
                pose_stamped.pose.orientation = quat
                
                self.path_msg.poses.append(pose_stamped)
                self.path_msg.header.stamp = current_time_msg
                if len(self.path_msg.poses) > 2000:
                    self.path_msg.poses.pop(0)
                    
                self.path_pub.publish(self.path_msg)

        except BlockingIOError:
            pass 
        except json.JSONDecodeError:
            pass 
        except Exception as e:
            self.get_logger().error(f"Stream error: {e}")

def main(args=None):
    rclpy.init(args=args)
    node = CompleteDVLNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.sock.close()
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
