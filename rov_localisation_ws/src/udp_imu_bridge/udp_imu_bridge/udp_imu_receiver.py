#!/usr/bin/env python3

import socket
import json

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Imu


class UDPIMUReceiver(Node):

    def __init__(self):
        super().__init__('udp_imu_receiver')

        self.publisher = self.create_publisher(
            Imu,
            '/imu/data',
            100
        )

        self.sock = socket.socket(
            socket.AF_INET,
            socket.SOCK_DGRAM
        )

        self.sock.bind(("0.0.0.0", 5005))
        self.sock.setblocking(False)

        self.packet_count = 0

        self.timer = self.create_timer(
            0.001,
            self.receive_data
        )

        self.get_logger().info(
            "Listening for IMU UDP packets on port 5005"
        )

    def receive_data(self):

        try:

            while True:

                data, addr = self.sock.recvfrom(4096)

                self.packet_count += 1

                if self.packet_count % 100 == 0:
                    self.get_logger().info(
                        f"Received {self.packet_count} packets"
                    )

                try:
                    imu_data = json.loads(
                        data.decode("utf-8")
                    )

                except json.JSONDecodeError as e:
                    self.get_logger().error(
                        f"JSON decode error: {e}"
                    )
                    continue

                if "accel" not in imu_data:
                    self.get_logger().warn(
                        "Missing accel field"
                    )
                    continue

                if "gyro" not in imu_data:
                    self.get_logger().warn(
                        "Missing gyro field"
                    )
                    continue

                accel = imu_data["accel"]
                gyro = imu_data["gyro"]

                if len(accel) < 3 or len(gyro) < 3:
                    self.get_logger().warn(
                        f"Invalid packet: {imu_data}"
                    )
                    continue

                msg = Imu()

                msg.header.stamp = (
                    self.get_clock()
                    .now()
                    .to_msg()
                )

                msg.header.frame_id = "imu_link"

                # Linear acceleration
                msg.linear_acceleration.x = float(accel[0])
                msg.linear_acceleration.y = float(accel[1])
                msg.linear_acceleration.z = float(accel[2])

                # Angular velocity
                msg.angular_velocity.x = float(gyro[0])
                msg.angular_velocity.y = float(gyro[1])
                msg.angular_velocity.z = float(gyro[2])

                # Orientation not available
                msg.orientation_covariance[0] = -1.0

                self.publisher.publish(msg)

        except BlockingIOError:
            pass

        except Exception as e:
            self.get_logger().error(
                f"Receive error: {e}"
            )


def main():

    rclpy.init()

    node = UDPIMUReceiver()

    try:
        rclpy.spin(node)

    except KeyboardInterrupt:
        node.get_logger().info(
            "Shutting down..."
        )

    finally:
        node.sock.close()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
