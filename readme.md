# LacakTani: IoT and AI-Based Strawberry Growth Monitoring & Tracking System

This repository contains the source code and documentation for our Final Project (Tugas Akhir/TA). We are developing a system designed to assist in monitoring the growth phases of strawberry plants using Computer Vision and Internet of Things (IoT) technologies.

## Project Overview

**LacakTani** aims to integrate visual monitoring with geolocation tracking. The system utilizes a camera module to capture real-time footage of strawberry plants, which is then processed by an Artificial Intelligence model to identify their growth stages. Additionally, a GPS module is integrated to track the precise location of the plants.

This project is built with the hope of applying our knowledge in Telecommunications and AI to solve real-world problems in agriculture, specifically for strawberry farming.

## Key Features

* **Growth Phase Detection:** Utilizing the YOLOv5 algorithm to classify strawberry plants into three main stages:
    * *Flowering* (Berbunga)
    * *Unripe/Growing* (Mentah)
    * *Ripe/Mature* (Matang)
* **Geolocation Tracking:** Monitoring the specific location of the device using the Ublox NEO-6M GPS module.
* **Web Dashboard:** A simple user interface built with Flask to display the video stream, detection results, and location maps.
* **IoT Connectivity:** Wireless communication between the ESP32 microcontroller and the local server.

## Technologies Used

We are grateful to utilize the following open-source technologies and hardware:

**Hardware:**
* ESP32 (Main Controller)
* ESP32-CAM (Video Streaming)
* Ublox NEO-6M (GPS Module)

**Software:**
* **Python 3.x:** Backend logic.
* **Flask:** Web server framework.
* **YOLOv5 (PyTorch):** Object detection model.
* **OpenCV:** Image processing.

## Installation

1.  **Clone this repository:**
    ```bash
    git clone [https://github.com/katyushaaa/lacaktani.git](https://github.com/katyushaaa/lacaktani.git)
    ```
2.  **Install requirements:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Run the application:**
    ```bash
    cd web_server
    python app.py
    ```

---

## A Note from the Authors

This project is part of our learning journey at Politeknik Negeri Jakarta. We realize there is still much room for improvement in this system.

**We sincerely hope that this Final Project runs smoothly, encounters minimal errors, and can be completed on time to provide benefits to others. We kindly ask for your prayers and support for our graduation.**

*"Bismillah, may this project be a blessing and a stepping stone for our future."*

---
**Agung Soeltani & Team**
Telecommunications Engineering
Politeknik Negeri Jakarta