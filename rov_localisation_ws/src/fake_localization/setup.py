from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'fake_localization'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        # This registers the package with the ROS 2 system
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        # This includes your package.xml
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='y18',
    maintainer_email='youremail@example.com',
    description='Simulates DVL odometry for testing the React dashboard',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            # This links the command "simulator" to your python script
            'simulator = fake_localization.fake_odom_node:main',
        ],
    },
)
