import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mjModel, mjData, stepSimulation, state, getPosition, getQuaternion, getGeomColor } from '../mujoco/engine';

export function Robot() {
  const bodyRefs = useRef<{ [key: number]: THREE.Group | null }>({});
  const { camera, raycaster, pointer, gl, controls } = useThree();

  const dragPlane = useMemo(() => new THREE.Plane(), []);

  // Releasing the mouse button anywhere on the page must end the drag — even if
  // the cursor has wandered off the robot mesh (or off the canvas entirely).
  // Re-enable OrbitControls so left-click reverts to orbiting the camera.
  useEffect(() => {
    const release = () => {
      if (state.dragging) {
        state.dragging = false;
        state.dragBodyId = -1;
        if (controls) (controls as unknown as { enabled: boolean }).enabled = true;
      }
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [controls]);

  // Show a grab cursor when hovering an actuated link so the affordance is
  // discoverable. Reset to default when the pointer leaves.
  useEffect(() => {
    const dom = gl.domElement;
    const onLeave = () => { dom.style.cursor = 'default'; };
    dom.addEventListener('pointerleave', onLeave);
    return () => dom.removeEventListener('pointerleave', onLeave);
  }, [gl]);

  const { bodies, geoms } = useMemo(() => {
    if (!mjModel) return { bodies: [], geoms: [] };

    const bodyList = [];
    const geomList = [];
    const meshGeometries: { [key: number]: THREE.BufferGeometry } = {};

    for (let b = 0; b < mjModel.nbody; b++) {
      bodyList.push(b);
    }

    for (let g = 0; g < mjModel.ngeom; g++) {
      // Render visual geoms only (group < 3). Group >= 3 are collision-only
      // primitives in MuJoCo menagerie convention.
      if (mjModel.geom_group[g] >= 3) continue;

      const bodyId = mjModel.geom_bodyid[g];
      const type = mjModel.geom_type[g];
      const size = [
        mjModel.geom_size[g * 3 + 0],
        mjModel.geom_size[g * 3 + 1],
        mjModel.geom_size[g * 3 + 2]
      ];

      let geometry: THREE.BufferGeometry | null = null;

      if (type === 0) {
        continue;
      } else if (type === 2) {
        geometry = new THREE.SphereGeometry(size[0]);
      } else if (type === 3) {
        geometry = new THREE.CapsuleGeometry(size[0], size[1] * 2.0, 20, 20);
      } else if (type === 5) {
        geometry = new THREE.CylinderGeometry(size[0], size[0], size[1] * 2.0);
      } else if (type === 6) {
        geometry = new THREE.BoxGeometry(size[0] * 2, size[2] * 2, size[1] * 2);
      } else if (type === 7) {
        const meshID = mjModel.geom_dataid[g];
        if (meshID >= 0) {
          if (!meshGeometries[meshID]) {
            const geom = new THREE.BufferGeometry();
            const vert_buf = new Float32Array(
              mjModel.mesh_vert.subarray(
                mjModel.mesh_vertadr[meshID] * 3,
                (mjModel.mesh_vertadr[meshID] + mjModel.mesh_vertnum[meshID]) * 3
              )
            );

            for (let v = 0; v < vert_buf.length; v += 3) {
              const temp = vert_buf[v + 1];
              vert_buf[v + 1] = vert_buf[v + 2];
              vert_buf[v + 2] = -temp;
            }

            let normal_buf;
            if (mjModel.mesh_normaladr && mjModel.mesh_normalnum) {
              normal_buf = new Float32Array(
                mjModel.mesh_normal.subarray(
                  mjModel.mesh_normaladr[meshID] * 3,
                  (mjModel.mesh_normaladr[meshID] + mjModel.mesh_normalnum[meshID]) * 3
                )
              );
              for (let v = 0; v < normal_buf.length; v += 3) {
                const temp = normal_buf[v + 1];
                normal_buf[v + 1] = normal_buf[v + 2];
                normal_buf[v + 2] = -temp;
              }
            }

            const face_buf = new Int32Array(
              mjModel.mesh_face.subarray(
                mjModel.mesh_faceadr[meshID] * 3,
                (mjModel.mesh_faceadr[meshID] + mjModel.mesh_facenum[meshID]) * 3
              )
            );

            geom.setAttribute('position', new THREE.BufferAttribute(vert_buf, 3));
            if (normal_buf && normal_buf.length === vert_buf.length) {
              geom.setAttribute('normal', new THREE.BufferAttribute(normal_buf, 3));
            }
            geom.setIndex(Array.from(face_buf));
            geom.computeVertexNormals();

            meshGeometries[meshID] = geom;
          }
          geometry = meshGeometries[meshID].clone();
        }
      }

      if (!geometry) continue;

      const color = getGeomColor(g);

      geomList.push({
        id: g,
        bodyId,
        geometry,
        color,
        pos: getPosition(mjModel.geom_pos, g),
        quat: getQuaternion(mjModel.geom_quat, g),
      });
    }

    return { bodies: bodyList, geoms: geomList };
  }, []);

  const handlePointerDown = (e: any, bodyId: number) => {
    // Only left-click starts a drag; right/middle stay routed to OrbitControls
    // (pan / dolly) so the user can still manipulate the camera while hovering
    // a link.
    if (e.button !== undefined && e.button !== 0) return;
    if (bodyId < 2) return; // skip world and base

    e.stopPropagation();
    state.dragging = true;
    state.dragBodyId = bodyId;

    state.dragPointWorld = [e.point.x, e.point.y, e.point.z];
    state.dragCursorWorld = [e.point.x, e.point.y, e.point.z];

    const bodyGroup = bodyRefs.current[bodyId];
    if (bodyGroup) {
      const local = bodyGroup.worldToLocal(e.point.clone());
      state.dragPointLocal = [local.x, local.y, local.z];
    }

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    dragPlane.setFromNormalAndCoplanarPoint(camDir, e.point);

    // Disable OrbitControls for the duration of the drag. OrbitControls' own
    // pointerdown already fired (it has no way to know the click landed on a
    // mesh), but it bails out of every subsequent pointermove while disabled,
    // so the camera stays put until we re-enable it on pointerup.
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false;
  };

  const handlePointerOver = (e: any, bodyId: number) => {
    if (bodyId < 2) return;
    e.stopPropagation();
    gl.domElement.style.cursor = state.dragging ? 'grabbing' : 'grab';
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    if (!state.dragging) gl.domElement.style.cursor = 'default';
  };

  useFrame((_, delta) => {
    if (!mjModel || !mjData) return;

    stepSimulation(delta);

    for (const b of bodies) {
      const ref = bodyRefs.current[b];
      if (!ref) continue;
      const pos = getPosition(mjData.xpos, b);
      const quat = getQuaternion(mjData.xquat, b);
      ref.position.set(...pos);
      ref.quaternion.set(...quat);
    }

    // Update drag state every frame so the cursor target keeps tracking even
    // when the mouse strays off the robot mesh (R3F's onPointerMove on the
    // group only fires while a body is under the cursor; useThree's `pointer`
    // updates whenever the mouse moves over the canvas).
    if (state.dragging && state.dragBodyId !== -1) {
      const bodyGroup = bodyRefs.current[state.dragBodyId];
      if (bodyGroup) {
        const local = new THREE.Vector3(...state.dragPointLocal);
        const world = bodyGroup.localToWorld(local);
        state.dragPointWorld = [world.x, world.y, world.z];

        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        dragPlane.setFromNormalAndCoplanarPoint(camDir, world);
      }

      raycaster.setFromCamera(pointer, camera);
      const target = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, target)) {
        state.dragCursorWorld = [target.x, target.y, target.z];
      }

      gl.domElement.style.cursor = 'grabbing';
    }
  });

  return (
    <group>
      {bodies.map((b) => (
        <group
          key={b}
          ref={(el) => (bodyRefs.current[b] = el)}
          onPointerDown={(e) => handlePointerDown(e, b)}
          onPointerOver={(e) => handlePointerOver(e, b)}
          onPointerOut={handlePointerOut}
        >
          {geoms
            .filter((g) => g.bodyId === b)
            .map((g) => (
              <mesh
                key={g.id}
                geometry={g.geometry}
                position={g.pos}
                quaternion={g.quat}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color={new THREE.Color(g.color[0], g.color[1], g.color[2])}
                  transparent={g.color[3] < 1.0}
                  opacity={g.color[3]}
                  roughness={0.6}
                  metalness={0.15}
                />
              </mesh>
            ))}
        </group>
      ))}
      
      {/* Arrow for visualization */}
      <DragArrow />
      
      {/* Trajectory visualization */}
      <Trajectories />
    </group>
  );
}

function DragArrow() {
  const arrowRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!arrowRef.current) return;
    if (state.dragging && state.dragBodyId !== -1) {
      // Arrow goes FROM the cursor in 3D space TO the body grab point.
      // The shaft's base sits at the cursor (in free space) and the cone tip
      // points at the body, visualising "drag this point toward the cursor".
      const cursor = new THREE.Vector3(...state.dragCursorWorld);
      const grab = new THREE.Vector3(...state.dragPointWorld);
      const disp = grab.clone().sub(cursor);
      const len = disp.length();

      if (len > 0.01) {
        const arrowLen = Math.min(len, 0.5);
        const dir = disp.normalize();

        arrowRef.current.position.copy(cursor);

        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        arrowRef.current.quaternion.copy(quat);

        const shaft = arrowRef.current.getObjectByName('shaft');
        const head = arrowRef.current.getObjectByName('head');
        if (shaft && head) {
          const headLen = Math.min(arrowLen * 0.35, 0.06);
          const shaftLen = Math.max(arrowLen - headLen, 0.001);
          shaft.scale.set(1, shaftLen, 1);
          shaft.position.set(0, shaftLen * 0.5, 0);
          head.position.set(0, shaftLen + headLen * 0.5, 0);
        }

        arrowRef.current.visible = true;
      } else {
        arrowRef.current.visible = false;
      }
    } else {
      arrowRef.current.visible = false;
    }
  });

  return (
    <group ref={arrowRef} visible={false}>
      <mesh name="shaft" position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 1, 12]} />
        <meshPhysicalMaterial color={0xff4444} roughness={0.4} metalness={0} transparent opacity={0.9} />
      </mesh>
      <mesh name="head" position={[0, 1, 0]}>
        <coneGeometry args={[0.022, 0.06, 16]} />
        <meshPhysicalMaterial color={0xff4444} roughness={0.4} metalness={0} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function Trajectories() {
  const maxPoints = 500;

  const actualGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, []);

  const desiredGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, []);

  // Build the three.js Line objects imperatively so we can attach them via
  // <primitive>. The intrinsic `<line>` JSX element collides with SVG types
  // under React 19's stricter typings and triggers a `tsc` error.
  const actualLine = useMemo(
    () =>
      new THREE.Line(
        actualGeom,
        new THREE.LineBasicMaterial({
          color: 0x4444ff,
          linewidth: 4,
          transparent: true,
          opacity: 0.9,
        }),
      ),
    [actualGeom],
  );

  const desiredLine = useMemo(
    () =>
      new THREE.Line(
        desiredGeom,
        new THREE.LineBasicMaterial({
          color: 0xff4444,
          linewidth: 4,
          transparent: true,
          opacity: 0.9,
        }),
      ),
    [desiredGeom],
  );

  useFrame(() => {
    if (state.actualTrajectory) {
      const positions = actualLine.geometry.attributes.position.array as Float32Array;
      const count = state.actualTrajectory.length;
      for (let i = 0; i < count; i++) {
        // MuJoCo uses Z-up, R3F uses Y-up. Our getPosition maps to Three's Y-up.
        positions[i * 3] = state.actualTrajectory[i][0];
        positions[i * 3 + 1] = state.actualTrajectory[i][1];
        positions[i * 3 + 2] = state.actualTrajectory[i][2];
      }
      actualLine.geometry.setDrawRange(0, count);
      actualLine.geometry.attributes.position.needsUpdate = true;
    }

    if (state.desiredTrajectory) {
      const positions = desiredLine.geometry.attributes.position.array as Float32Array;
      const count = state.desiredTrajectory.length;
      for (let i = 0; i < count; i++) {
        positions[i * 3] = state.desiredTrajectory[i][0];
        positions[i * 3 + 1] = state.desiredTrajectory[i][1];
        positions[i * 3 + 2] = state.desiredTrajectory[i][2];
      }
      desiredLine.geometry.setDrawRange(0, count);
      desiredLine.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      <primitive object={actualLine} />
      <primitive object={desiredLine} />
    </group>
  );
}
