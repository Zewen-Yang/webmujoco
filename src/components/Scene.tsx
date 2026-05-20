import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Environment } from '@react-three/drei';
import { Robot } from './Robot';

/**
 * Pure 3D viewport. Kept separate from the UI widget so the scene can be
 * embedded in other layouts (e.g. fullscreen, split view).
 */
export function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [1.124, 0.896, 0.817], fov: 45 }}
      gl={{ antialias: true, toneMappingExposure: 1.1 }}
    >
      <color attach="background" args={['#eef2f7']} />
      <fog attach="fog" args={['#eef2f7', 5, 12]} />

      {/* Image-based lighting gives the metal/plastic parts realistic shading
          so colors don't read as flat gray. */}
      <Environment preset="city" environmentIntensity={0.4} />

      <ambientLight intensity={0.35} />
      <directionalLight
        castShadow
        position={[2, 4, 3]}
        intensity={2.2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={10}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-2, 1, -1]} intensity={0.4} />

      <Robot />

      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={5} blur={2.4} far={4} />
      <Grid
        position={[0, 0.001, 0]}
        args={[4, 20]}
        cellColor="#cbd5e1"
        sectionColor="#94a3b8"
        fadeDistance={20}
      />

      {/* Defaults: LEFT = rotate, MIDDLE = dolly, RIGHT = pan. While the user
          is dragging a robot link, Robot.tsx temporarily disables these
          controls so left-click on a link drags the link instead of the
          camera; once the drag ends they re-enable automatically.
          drei sets r3f's `state.controls` to this instance, which Robot.tsx
          reads via useThree(). */}
      <OrbitControls
        makeDefault
        target={[0.214, 0.452, 0.048]}
        enableDamping
        dampingFactor={0.1}
        minDistance={0.4}
        maxDistance={4}
      />
    </Canvas>
  );
}
