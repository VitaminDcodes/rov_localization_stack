import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Quaternion
import math
import time

class FakeLocalizationNode(Node):
    def __init__(self):
        super().__init__('fake_localization_node')
        # Publish to the topic your Python WebSocket backend is listening to
        self.publisher_ = self.create_publisher(Odometry, '/dvl/odometry', 10)
        
        # Publish at 20Hz (0.05 seconds)
        self.timer = self.create_timer(0.05, self.publish_fake_odom) 
        self.start_time = time.time()
        self.get_logger().info("Injecting simulated Figure-8 trajectory into /dvl/odometry...")

    def publish_fake_odom(self):
        msg = Odometry()
        current_time = self.get_clock().now().to_msg()
        msg.header.stamp = current_time
        msg.header.frame_id = "odom"
        msg.child_frame_id = "base_link"

        # Calculate time elapsed for the sine waves
        t = time.time() - self.start_time
        
        # Generate a smooth sweeping path
        msg.pose.pose.position.x = 15.0 * math.sin(t * 0.2)  # Sweeps +/- 15m forward
        msg.pose.pose.position.y = 8.0 * math.sin(t * 0.4)   # Sweeps +/- 8m laterally
        msg.pose.pose.position.z = -18.4 + (2.0 * math.sin(t * 0.1)) # Bobs gently around -18.4m depth

        # Static orientation for now
        msg.pose.pose.orientation = Quaternion(x=0.0, y=0.0, z=0.0, w=1.0)

        self.publisher_.publish(msg)

def main(args=None):
    rclpy.init(args=args)
    node = FakeLocalizationNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
