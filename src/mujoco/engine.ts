export let mujoco: any = null;
export let mjModel: any = null;
export let mjData: any = null;
export let mjDataDes: any = null;
export let tcpBodyId: number = -1;

export const HOME_QPOS = [0, 0, 0, -1.57079, 0, 1.57079, -0.7853];
export const TORQUE_LIMITS = [87, 87, 87, 87, 12, 12, 12];
export const GAIN_BASE = [1, 1, 1, 1, 0.6, 0.6, 0.6];
export const NUM_JOINTS = 7;

export const state = {
  simTime: 0,
  excitationMode: 'sine' as 'hold' | 'sine' | 'step' | 'sineAll',
  scalarKp: 200,
  scalarKd: 10,
  paused: false,
  currentQDes: [...HOME_QPOS],
  dragging: false,
  dragBodyId: -1,
  dragPointLocal: [0, 0, 0] as [number, number, number],
  dragPointWorld: [0, 0, 0] as [number, number, number],
  dragCursorWorld: [0, 0, 0] as [number, number, number],
  actualTrajectory: [] as [number, number, number][],
  desiredTrajectory: [] as [number, number, number][],
  currentTcpError: 0,
  errorHistory: [] as { t: number; e: number }[],
  // Rolling per-joint history for the joint-plot panel. Each sample stores the
  // 7 desired and 7 achieved joint positions at one render frame.
  jointHistory: [] as { desired: number[]; achieved: number[] }[],
};

export const JOINT_HISTORY_LEN = 200;

const ALL_FILES = [
  'scene.xml',
  'fr3.xml',
  // Visual .obj meshes
  'assets/link0_0.obj', 'assets/link0_1.obj', 'assets/link0_2.obj',
  'assets/link0_3.obj', 'assets/link0_4.obj', 'assets/link0_5.obj',
  'assets/link0_6.obj',
  'assets/link1.obj', 'assets/link2.obj',
  'assets/link3_0.obj', 'assets/link3_1.obj',
  'assets/link4_0.obj', 'assets/link4_1.obj',
  'assets/link5_0.obj', 'assets/link5_1.obj', 'assets/link5_2.obj',
  'assets/link6_0.obj', 'assets/link6_1.obj', 'assets/link6_2.obj',
  'assets/link6_3.obj', 'assets/link6_4.obj', 'assets/link6_5.obj',
  'assets/link6_6.obj', 'assets/link6_7.obj',
  'assets/link7_0.obj', 'assets/link7_1.obj', 'assets/link7_2.obj',
  'assets/link7_3.obj',
  // Collision .stl meshes
  'assets/link0.stl', 'assets/link1.stl', 'assets/link2.stl',
  'assets/link3.stl', 'assets/link4.stl', 'assets/link5.stl',
  'assets/link6.stl', 'assets/link7.stl',
  // Hand meshes
  'assets/hand_0.obj', 'assets/hand_1.obj', 'assets/hand_2.obj', 
  'assets/hand_3.obj', 'assets/hand_4.obj', 'assets/hand.stl', 
  'assets/finger_0.obj', 'assets/finger_1.obj',   
];

const MODEL_BASE = `${import.meta.env.BASE_URL}mujoco_menagerie/franka_fr3/`;

/**
 * Lookup tables built by parsing fr3.xml. We key by *mesh name* (not index),
 * because mujoco's compiler can reorder mesh assets. At render time we resolve
 * the mesh name from `mjModel` itself, which is the canonical source.
 */
let materialByName = new Map<string, [number, number, number, number]>();
let materialNameByMeshName = new Map<string, string>();

function parseFr3Colors(xmlText: string): void {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  } catch (e) {
    console.warn('[mujoco] DOMParser failed:', e);
    return;
  }
  const err = doc.querySelector('parsererror');
  if (err) {
    console.warn('[mujoco] fr3.xml parse error:', err.textContent);
    return;
  }

  materialByName = new Map();
  doc.querySelectorAll('asset material').forEach((m) => {
    const name = m.getAttribute('name');
    const rgbaAttr = m.getAttribute('rgba');
    if (!name || !rgbaAttr) return;
    const parts = rgbaAttr.trim().split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.every((v) => Number.isFinite(v))) {
      materialByName.set(name, [parts[0], parts[1], parts[2], parts[3] ?? 1]);
    }
  });

  materialNameByMeshName = new Map();
  doc.querySelectorAll('geom[mesh][material]').forEach((g) => {
    const mesh = g.getAttribute('mesh');
    const mat = g.getAttribute('material');
    if (mesh && mat && !materialNameByMeshName.has(mesh)) {
      materialNameByMeshName.set(mesh, mat);
    }
  });

  console.info(
    '[mujoco] parsed %d materials, %d mesh→material mappings from menagerie XML',
    materialByName.size,
    materialNameByMeshName.size,
  );
}

/**
 * Resolve a mesh's canonical name as MuJoCo sees it. Tries multiple wasm
 * binding conventions and falls back to a `mesh<id>` placeholder.
 */
function resolveMeshName(meshId: number): string | null {
  if (!mjModel || meshId < 0) return null;

  // (a) Embind method form: mjModel.mesh_name(id)
  if (typeof mjModel.mesh_name === 'function') {
    try {
      const n = mjModel.mesh_name(meshId);
      if (typeof n === 'string' && n.length) return n;
    } catch {
      /* ignore */
    }
  }

  // (b) Heap-decoded form: mjModel.names (uint8 blob) + name_meshadr (offsets)
  const namesBuf = mjModel.names;
  const nameAdr = mjModel.name_meshadr;
  if (namesBuf && nameAdr) {
    const offset = nameAdr[meshId] | 0;
    if (offset >= 0 && offset < namesBuf.length) {
      let end = offset;
      while (end < namesBuf.length && namesBuf[end] !== 0) end++;
      const slice =
        typeof namesBuf.subarray === 'function'
          ? namesBuf.subarray(offset, end)
          : Uint8Array.from(namesBuf).subarray(offset, end);
      try {
        return new TextDecoder('utf-8').decode(slice);
      } catch {
        /* ignore */
      }
    }
  }

  return null;
}

export async function initMuJoCo(onProgress: (msg: string) => void) {
  if (mujoco) return; // already initialized

  onProgress('Loading MuJoCo WASM...');
  // Use a full absolute URL to bypass Vite's local file import restrictions
  // during dev. `BASE_URL` already includes any GitHub Pages sub-path prefix.
  const url = new URL(
    `${import.meta.env.BASE_URL}mujoco_wasm.js`,
    window.location.origin,
  ).href;
  const module = await import(/* @vite-ignore */ url);
  const loadModule = module.default;
  mujoco = await loadModule();
  
  mujoco.FS.mkdir('/working');
  mujoco.FS.mount(mujoco.MEMFS, { root: '.' }, '/working');

  onProgress('Downloading FR3 models into Virtual FS...');
  // Ensure directories exist
  const dirs = new Set<string>();
  ALL_FILES.forEach(f => {
    const parts = f.split('/');
    let cur = '/working';
    for (let i = 0; i < parts.length - 1; i++) {
      cur += '/' + parts[i];
      dirs.add(cur);
    }
  });
  for (const d of dirs) {
    if (!mujoco.FS.analyzePath(d).exists) {
      mujoco.FS.mkdir(d);
    }
  }

  let loaded = 0;
  const total = ALL_FILES.length;
  let fr3XmlText = '';

  async function fetchFile(path: string) {
    const url = MODEL_BASE + path;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}`);

    const isBinary = path.endsWith('.stl') || path.endsWith('.png');
    if (isBinary) {
      const buf = await resp.arrayBuffer();
      mujoco.FS.writeFile('/working/' + path, new Uint8Array(buf));
    } else {
      const text = await resp.text();
      mujoco.FS.writeFile('/working/' + path, text);
      if (path === 'fr3.xml') fr3XmlText = text;
    }
    loaded++;
    onProgress(`Downloading FR3 model... (${loaded}/${total})`);
  }

  await Promise.all(ALL_FILES.map(fetchFile));

  // Build the official color lookup BEFORE compile so it's ready for first paint.
  if (fr3XmlText) parseFr3Colors(fr3XmlText);

  onProgress('Compiling model...');
  mjModel = mujoco.MjModel.loadFromXML('/working/scene.xml');
  mjData = new mujoco.MjData(mjModel);
  mjDataDes = new mujoco.MjData(mjModel);

  // Find the 'hand' body to use as TCP (Tool Center Point)
  if (mujoco.mj_name2id) {
    // 1 is the integer value for mjtObj.mjOBJ_BODY
    tcpBodyId = mujoco.mj_name2id(mjModel, 1, 'hand');
  } else {
    // Fallback if mj_name2id not exposed
    tcpBodyId = 9; 
  }

  for (let i = 0; i < NUM_JOINTS; i++) {
    mjData.qpos[i] = HOME_QPOS[i];
  }
  mujoco.mj_forward(mjModel, mjData);

  if (typeof console !== 'undefined') {
    const probedNames: string[] = [];
    for (let i = 0; i < Math.min(mjModel.nmesh ?? 0, 8); i++) {
      const n = resolveMeshName(i);
      if (n) probedNames.push(`${i}:${n}`);
    }
    console.info(
      '[mujoco] ngeom=%d nbody=%d nmesh=%d | XML: %d materials, %d mesh-mappings | wasm mesh-names: %o',
      mjModel.ngeom,
      mjModel.nbody,
      mjModel.nmesh,
      materialByName.size,
      materialNameByMeshName.size,
      probedNames.length ? probedNames : '(none resolved)',
    );
  }

  onProgress('Ready');
}

export function updateDesiredPositions() {
  const SINE_FREQUENCY = 0.5;
  const STEP_PERIOD = 2.0;
  // 'sineAll' mirrors the Tune-to-Learn FR3 widget: every joint tracks the
  // exact same sinusoid added to its home pose, so PD-gain effects are
  // visible on each of the 7 joint plots simultaneously.
  const SINE_ALL_AMPLITUDE = 0.1; // rad

  // Compute the shared offset once per frame for the all-joint sine case.
  const sineAllOffset =
    SINE_ALL_AMPLITUDE * Math.sin(2 * Math.PI * SINE_FREQUENCY * state.simTime);

  for (let i = 0; i < NUM_JOINTS; i++) {
    let offset = 0;
    if (state.excitationMode === 'sine') {
      // Create a clean, narrow ellipse by moving Joint 0 and Joint 1 with a phase shift
      if (i === 0) {
        // Base rotation (left-right)
        offset = 0.2 * Math.sin(2 * Math.PI * SINE_FREQUENCY * state.simTime);
      } else if (i === 1) {
        // Shoulder pitch (up-down) with cosine and smaller amplitude for a narrow ellipse
        offset = 0.08 * Math.cos(2 * Math.PI * SINE_FREQUENCY * state.simTime);
      } else {
        // Keep other joints still so the curve doesn't twist in 3D
        offset = 0;
      }
    } else if (state.excitationMode === 'sineAll') {
      // All 7 joints follow the same in-phase 0.1 rad / 0.5 Hz sine wave
      // around HOME_QPOS (faithful reproduction of the reference widget).
      offset = sineAllOffset;
    } else if (state.excitationMode === 'step') {
      const phase = Math.floor(state.simTime / STEP_PERIOD) % 2;
      offset = phase === 0 ? 0.1 : -0.1;
    }
    state.currentQDes[i] = HOME_QPOS[i] + offset;
  }
}

export function applyPDControl() {
  updateDesiredPositions();
  for (let i = 0; i < NUM_JOINTS; i++) {
    const kp = state.scalarKp * GAIN_BASE[i];
    const kd = state.scalarKd * GAIN_BASE[i];
    const posError = state.currentQDes[i] - mjData.qpos[i];
    const velError = -mjData.qvel[i];
    let torque = kp * posError + kd * velError;
    torque = Math.max(-TORQUE_LIMITS[i], Math.min(TORQUE_LIMITS[i], torque));
    mjData.ctrl[i] = torque;
  }
}

export function stepSimulation(dt: number) {
  if (!mjModel || !mjData) return;
  if (state.paused) return;

  // `dt` (from R3F useFrame) and `mjModel.opt.timestep` are both in seconds.
  const nsteps = Math.max(1, Math.floor(dt / mjModel.opt.timestep));

  for (let i = 0; i < Math.min(nsteps, 30); i++) {
    state.simTime += mjModel.opt.timestep;

    // Apply drag forces
    for (let j = 0; j < mjData.qfrc_applied.length; j++) {
      mjData.qfrc_applied[j] = 0;
    }

    if (state.dragging && state.dragBodyId !== -1) {
      const mass = mjModel.body_mass[state.dragBodyId];
      const forceScale = mass * 250;
      
      const dispX = state.dragCursorWorld[0] - state.dragPointWorld[0];
      const dispY = state.dragCursorWorld[1] - state.dragPointWorld[1];
      const dispZ = state.dragCursorWorld[2] - state.dragPointWorld[2];

      // Swizzle back to MuJoCo coords (Three Y-up -> MuJoCo Z-up: X->X, Y->Z, Z->-Y)
      const forceVec = [dispX * forceScale, -dispZ * forceScale, dispY * forceScale];
      const pointVec = [state.dragPointWorld[0], -state.dragPointWorld[2], state.dragPointWorld[1]];

      mujoco.mj_applyFT(
        mjModel, mjData,
        new Float64Array(forceVec),
        new Float64Array([0, 0, 0]),
        new Float64Array(pointVec),
        state.dragBodyId,
        mjData.qfrc_applied
      );
    }

    mujoco.mj_step1(mjModel, mjData);
    applyPDControl();
    mujoco.mj_step2(mjModel, mjData);
  }

  // Update desired kinematics for visualization
  for (let j = 0; j < NUM_JOINTS; j++) {
    mjDataDes.qpos[j] = state.currentQDes[j];
  }
  mujoco.mj_kinematics(mjModel, mjDataDes);

  // Record trajectories once per frame (not every substep)
  if (tcpBodyId >= 0 && !state.paused) {
    const actPos = getTcpPosition(mjData, tcpBodyId);
    state.actualTrajectory.push(actPos);
    if (state.actualTrajectory.length > 500) state.actualTrajectory.shift();

    const desPos = getTcpPosition(mjDataDes, tcpBodyId);
    state.desiredTrajectory.push(desPos);
    if (state.desiredTrajectory.length > 500) state.desiredTrajectory.shift();

    const dx = actPos[0] - desPos[0];
    const dy = actPos[1] - desPos[1];
    const dz = actPos[2] - desPos[2];
    state.currentTcpError = Math.sqrt(dx * dx + dy * dy + dz * dz);

    state.errorHistory.push({ t: state.simTime, e: state.currentTcpError });
    if (state.errorHistory.length > 200) state.errorHistory.shift();
  }

  // Record per-joint desired/achieved positions for the joint-plot panel.
  if (!state.paused) {
    const desired = state.currentQDes.slice();
    const achieved = new Array<number>(NUM_JOINTS);
    for (let i = 0; i < NUM_JOINTS; i++) achieved[i] = mjData.qpos[i];
    state.jointHistory.push({ desired, achieved });
    if (state.jointHistory.length > JOINT_HISTORY_LEN) {
      state.jointHistory.shift();
    }
  }
}

// One-time diagnostic dump of how colors are being resolved.
let colorDiagnosticDumped = false;

/**
 * Resolve a geom's RGBA color. Strategy:
 *   1. Primary: resolve the geom's mesh name from `mjModel`, look up its
 *      material in the table parsed from menagerie XML. These are official
 *      MuJoCo colors.
 *   2. Fallback: read `mat_rgba` via `geom_matid` (wasm binding).
 *   3. Fallback: read `geom_rgba` directly.
 *   4. Last resort: opaque white.
 */
export function getGeomColor(g: number): [number, number, number, number] {
  if (!mjModel) return [1, 1, 1, 1];

  // (1) Official colors via mesh-name lookup.
  let meshName: string | null = null;
  let xmlColor: [number, number, number, number] | undefined;
  if (mjModel.geom_dataid && materialByName.size > 0) {
    const meshId = (mjModel.geom_dataid[g] | 0);
    if (meshId >= 0) {
      meshName = resolveMeshName(meshId);
      if (meshName) {
        const matName = materialNameByMeshName.get(meshName);
        if (matName) xmlColor = materialByName.get(matName);
      }
    }
  }

  if (!colorDiagnosticDumped && g < 6) {
    console.info(
      '[mujoco] geom %d → meshId=%s meshName=%s material=%s rgba=%o',
      g,
      mjModel.geom_dataid ? mjModel.geom_dataid[g] : 'n/a',
      meshName,
      meshName ? materialNameByMeshName.get(meshName) : 'n/a',
      xmlColor,
    );
    if (g === 5) colorDiagnosticDumped = true;
  }

  if (xmlColor) return xmlColor;

  // (2) wasm material binding fallback.
  const nmat: number = (mjModel.nmat ?? (mjModel.mat_rgba ? mjModel.mat_rgba.length / 4 : 0)) | 0;
  const matId = (mjModel.geom_matid ? mjModel.geom_matid[g] : -1) | 0;
  if (matId >= 0 && matId < nmat && mjModel.mat_rgba) {
    const c: [number, number, number, number] = [
      mjModel.mat_rgba[matId * 4 + 0],
      mjModel.mat_rgba[matId * 4 + 1],
      mjModel.mat_rgba[matId * 4 + 2],
      mjModel.mat_rgba[matId * 4 + 3],
    ];
    if (Number.isFinite(c[0])) return c;
  }

  // (3) wasm geom rgba fallback.
  if (mjModel.geom_rgba) {
    const c: [number, number, number, number] = [
      mjModel.geom_rgba[g * 4 + 0],
      mjModel.geom_rgba[g * 4 + 1],
      mjModel.geom_rgba[g * 4 + 2],
      mjModel.geom_rgba[g * 4 + 3],
    ];
    if (Number.isFinite(c[0])) return c;
  }

  return [1, 1, 1, 1];
}

export function getPosition(buffer: any, index: number): [number, number, number] {
  return [
    buffer[index * 3 + 0],
    buffer[index * 3 + 2],
    -buffer[index * 3 + 1]
  ];
}

export function getTcpPosition(data: any, bodyId: number): [number, number, number] {
  // Hand's world position (MuJoCo coords: X, Y, Z)
  const p0 = data.xpos[bodyId * 3 + 0];
  const p1 = data.xpos[bodyId * 3 + 1];
  const p2 = data.xpos[bodyId * 3 + 2];

  // The 3rd column of the rotation matrix (Z-axis direction in world space)
  const r02 = data.xmat[bodyId * 9 + 2];
  const r12 = data.xmat[bodyId * 9 + 5];
  const r22 = data.xmat[bodyId * 9 + 8];

  // Offset TCP by 10.3cm along the hand's local Z axis 
  // (0.0584m to finger base + ~0.045m to fingertip pad)
  const zOffset = 0.103;

  const g0 = p0 + r02 * zOffset;
  const g1 = p1 + r12 * zOffset;
  const g2 = p2 + r22 * zOffset;

  // Convert to Three.js coordinates (Y-up)
  return [g0, g2, -g1];
}

export function getQuaternion(buffer: any, index: number): [number, number, number, number] {
  return [
    -buffer[index * 4 + 1],
    -buffer[index * 4 + 3],
     buffer[index * 4 + 2],
    -buffer[index * 4 + 0]
  ];
}