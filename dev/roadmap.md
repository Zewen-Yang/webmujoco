# Web MuJoCo - Project Roadmap

这份路线图记录了项目的演进过程，包括已经完成的基础建设阶段，以及未来可能的高级特性和性能优化方向。

## ✅ Phase 1: 基础框架与核心物理 (Completed)

- [x] **Step 0: 构建基础框架 (Framework Setup)**
  - 初始化 Vite + React + TypeScript 环境。
  - 引入 `three`, `@react-three/fiber`, `@react-three/drei` 进行 3D 渲染。
  - 引入 `zustand` 进行全局状态管理。
- [x] **Step 1: 准备静态资源与 MuJoCo WASM**
  - 集成 `mujoco_wasm.js`。
  - 导入 Franka FR3 机器人的 XML 和 3D Mesh 模型（`.obj`, `.stl`）。
- [x] **Step 2: 封装 MuJoCo 物理引擎上下文**
  - 在内存文件系统 (MEMFS) 中动态加载并解析 XML 模型。
  - 建立 MuJoCo 物理步进循环 (Physics Step Loop)。
- [x] **Step 3: 构建 3D 渲染场景**
  - 使用 `useFrame` 将 MuJoCo 的物理状态 (`qpos`, `qquat`) 实时同步到 R3F 的 Mesh。
  - 动态解析并加载 MuJoCo `ngeom` 对应的几何体和材质。

## ✅ Phase 2: 交互、控制与 UI 完善 (Completed)

- [x] **Step 4: 实现交互与控制逻辑**
  - 实现基于 R3F 射线检测 (Raycaster) 的鼠标拖拽交互，向机器人施加空间外力。
  - 在物理循环中实现底层的 PD 控制器 (Proportional-Derivative Controller)。
- [x] **Step 5: 现代化 UI 与实时遥测**
  - 弃用基础的 `leva`，构建基于 Tailwind CSS 的现代化可折叠控制面板。
  - 实现多种激励模式 (Hold, Sine, Step, Sine ×7) 用于测试关节追踪性能。
  - 实现实时数据可视化：TCP 空间轨迹追踪、TCP 误差曲线、7个关节的期望/实际角度对比图。

---

## 🚀 Phase 3: 高级机器人学特性 (Planned / Future)

- [ ] **逆运动学控制 (Inverse Kinematics - IK)**
  - 允许用户直接拖拽末端执行器 (TCP)，自动计算并输出各关节的目标角度。
  - 引入阻抗控制 (Impedance Control) 替代纯位置 PD 控制。
- [ ] **物体抓取与场景交互 (Manipulation)**
  - 在场景中添加可交互的刚体（如方块、圆柱体）。
  - 实现夹爪 (Gripper) 的开合控制逻辑，测试真实的物理碰撞和摩擦力抓取。
- [ ] **多机器人与模型切换**
  - 支持在 UI 中动态切换不同的机器人模型（如 UR5, Spot, 甚至人形机器人）。
  - 支持在同一场景中加载多个 MuJoCo 模型并进行交互。
- [ ] **碰撞可视化 (Collision Visualization)**
  - 在 UI 中增加 Toggle 按钮，用于切换显示机器人的视觉模型 (Visual Mesh) 和碰撞模型 (Collision Mesh / Primitive Geometries)。
  - 实时高亮显示发生碰撞的接触点 (Contact Points) 和法向力。

## ⚡ Phase 4: 架构与性能优化 (Planned / Future)

- [ ] **Web Worker 物理线程分离**
  - 将 MuJoCo 的 `stepSimulation` 移至独立的 Web Worker 中运行。
  - 通过 `SharedArrayBuffer` 与主线程 (UI/渲染) 同步位姿数据，彻底解决复杂物理场景下掉帧导致的 UI 卡顿问题。
- [ ] **WebXR / VR 支持**
  - 引入 `@react-three/xr`，支持在 VR 头显（如 Meta Quest）中沉浸式查看机器人。
  - 支持使用 VR 手柄直接抓取和拖拽机器人关节。
- [ ] **代码编辑器集成 (In-browser Scripting)**
  - 在网页端集成 Monaco Editor，允许用户直接在浏览器中编写 JavaScript/Python 脚本来控制机器人（例如编写自定义的轨迹规划算法），并实时在 3D 场景中预览效果。
