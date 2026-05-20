# Web MuJoCo Interactive Simulation

A modern, interactive robotics simulation running entirely in the browser. This project integrates the **MuJoCo physics engine** (compiled to WebAssembly) with **React**, **Three.js** (via React Three Fiber), and **Tailwind CSS** to provide a real-time, interactive environment for simulating a Franka Emika FR3 robot arm.

![Web MuJoCo Demo](https://img.shields.io/badge/Status-Active-brightgreen)
![Tech Stack](https://img.shields.io/badge/Tech-React%20%7C%20Three.js%20%7C%20MuJoCo%20WASM-blue)

## ✨ Features

- **In-Browser Physics**: Runs the official MuJoCo physics engine via WASM, requiring no backend server.
- **Franka FR3 Robot**: Simulates the 7-DOF Franka Emika FR3 robot arm using high-quality models from MuJoCo Menagerie.
- **Interactive Drag-and-Drop**: Click and drag any robot link in the 3D scene to apply external forces in real-time.
- **Real-Time PD Control**: Tune Proportional-Derivative (PD) gains on the fly using the UI control panel.
- **Excitation Modes**: Test joint tracking performance with built-in reference trajectories:
  - *Hold*: Maintains the home position.
  - *Sine*: Applies a phase-shifted sine wave to the base and shoulder for a smooth 3D ellipse.
  - *Step*: Applies a step function to test transient response.
  - *Sine ×7*: Applies identical sine waves to all 7 joints simultaneously.
- **Live Telemetry & Plotting**: 
  - Visualizes the actual vs. desired Tool Center Point (TCP) trajectory in 3D space.
  - Real-time 2D plotting of desired vs. achieved joint angles for all 7 joints.
  - Live readout and plotting of the TCP cartesian tracking error.
- **Modern UI**: Polished, collapsible side panels for controlling the simulation and monitoring robot state, styled with Tailwind CSS v4.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **3D Rendering**: [Three.js](https://threejs.org/) + [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) + [Drei](https://github.com/pmndrs/drei)
- **Physics Engine**: [MuJoCo WASM](https://mujoco.org/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or newer recommended)
- npm or yarn

### Installation & Running Locally

1. Clone the repository and navigate into the project directory:
   ```bash
   git clone <repository-url>
   cd webmujoco
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

## 🎮 Controls & Interaction

- **Apply Force**: Left-click and drag any part of the robot to pull it towards your cursor.
- **Rotate Camera**: Right-click (or middle-click) and drag to orbit the camera around the scene.
- **Zoom**: Scroll the mouse wheel to zoom in and out.
- **Pan**: Right-click + Shift and drag to pan the camera.
- **UI Panels**: Use the right panel to adjust PD gains, toggle excitation modes, and pause/resume the simulation. Use the left panel to monitor joint tracking and TCP error.

## 📦 Deployment

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the application to **GitHub Pages** on every push to the `main` branch.

### Manual Build

If you want to build the project for production locally:

```bash
npm run build
```

The compiled assets will be placed in the `dist/` directory.

To preview the production build:
```bash
npm run preview
```

*Note: If you are deploying to a subpath (e.g., `https://username.github.io/repo-name/`), Vite automatically handles the base path via the GitHub Actions workflow.*
