# Web MuJoCo Interactive Simulation

This project is a modular, React-based web interactive simulation using the MuJoCo physics engine compiled to WebAssembly (WASM) and Three.js (via React Three Fiber) for rendering.

## Roadmap & Steps

**Step 0: 构建基础框架 (Framework Setup)**
- Initialize Vite + React + TypeScript.
- Install necessary dependencies (`three`, `@react-three/fiber`, `@react-three/drei`, `leva`, `zustand`).
- Setup project folder structure.

**Step 1: 准备静态资源与 MuJoCo WASM (Static Assets & WASM)**
- Download `mujoco_wasm.js`.
- Download Franka FR3 models (`.xml`, `.obj`, `.stl`) into the `public` directory.
- Allow `fetch` from within the code.

**Step 2: 封装 MuJoCo 物理引擎上下文 (MuJoCo Physics Context)**
- Implement a `Zustand` store or React Context to initialize MuJoCo.
- Load the XML models via MEMFS.
- Run the physics step loop.

**Step 3: 构建 3D 渲染场景 (3D Rendering with R3F)**
- Use `useFrame` to sync MuJoCo state (`qpos`, `qquat`) to R3F meshes.
- Load geometries dynamically based on MuJoCo `ngeom`.

**Step 4: 实现交互与控制逻辑 (Interaction & PD Control)**
- Implement drag-and-drop to apply external forces using R3F pointer events.
- Implement a PD controller in the physics step loop.

**Step 5: 添加 UI 面板 (UI Panel)**
- Use `leva` to add adjustable Kp/Kd sliders and mode selectors (Sine/Step/Hold).
- Show real-time performance or values.

## How to run
```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

This repo ships with a GitHub Actions workflow (`.github/workflows/deploy.yml`)
that builds the Vite app and publishes `dist/` to GitHub Pages on every push to
`main`.

One-time setup on GitHub:

1. Push the project to a GitHub repository.
2. In the repo, go to **Settings → Pages** and set **Source = GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site will be served at
   `https://<user>.github.io/<repo>/`.

The Vite `base` path is auto-derived from `GITHUB_REPOSITORY` during the build,
so the same code works for any repo name. For a custom domain or user/org page
served from `/`, override it explicitly:

```bash
VITE_BASE=/ npm run build
```

