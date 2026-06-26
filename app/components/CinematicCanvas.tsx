'use client'

import { useRef, useMemo, useEffect, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

// ── Floating particle cloud ────────────────────────────────────────────────

function FloatingParticles({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null)

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const r     = 4 + Math.random() * 18
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

      if (Math.random() < 0.12) {
        col[i * 3] = 0.86; col[i * 3 + 1] = 0.15; col[i * 3 + 2] = 0.15
      } else {
        const v = 0.4 + Math.random() * 0.6
        col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v
      }
    }

    return [pos, col]
  }, [count])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.y = t * 0.012
    ref.current.rotation.x = t * 0.006

    // Slow upward drift
    const arr = ref.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += 0.0015
      if (arr[i * 3 + 1] > 8) arr[i * 3 + 1] = -8
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.022}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  )
}

// ── Centre orb ─────────────────────────────────────────────────────────────

function CenterOrb() {
  const innerRef = useRef<THREE.Mesh>(null)
  const outerRef = useRef<THREE.Mesh>(null)
  const ring1    = useRef<THREE.Mesh>(null)
  const ring2    = useRef<THREE.Mesh>(null)
  const ring3    = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (innerRef.current) {
      innerRef.current.rotation.y = t * 0.45
      innerRef.current.rotation.x = Math.sin(t * 0.18) * 0.12
      const pulse = 1 + Math.sin(t * 2.2) * 0.035
      innerRef.current.scale.setScalar(pulse)
    }
    if (outerRef.current) {
      outerRef.current.rotation.y = -t * 0.15
      outerRef.current.rotation.z =  t * 0.08
    }
    if (ring1.current) ring1.current.rotation.z =  t * 0.55
    if (ring2.current) { ring2.current.rotation.x = t * 0.3; ring2.current.rotation.z = t * 0.2 }
    if (ring3.current) { ring3.current.rotation.y = t * 0.25; ring3.current.rotation.x = -t * 0.15 }
  })

  return (
    <group>
      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[3, 32, 32]} />
        <meshBasicMaterial color="#DC2626" transparent opacity={0.028} side={THREE.BackSide} />
      </mesh>

      {/* Wireframe icosahedron */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[2.0, 1]} />
        <meshBasicMaterial color="#DC2626" wireframe transparent opacity={0.12} />
      </mesh>

      {/* Solid gem */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial
          color="#DC2626"
          emissive="#DC2626"
          emissiveIntensity={4}
          metalness={0.9}
          roughness={0.06}
        />
      </mesh>

      {/* Orbiting rings */}
      <mesh ref={ring1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.4, 0.013, 8, 128]} />
        <meshBasicMaterial color="#DC2626" transparent opacity={0.7} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 3, 0, Math.PI / 6]}>
        <torusGeometry args={[3.2, 0.008, 8, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} />
      </mesh>
      <mesh ref={ring3} rotation={[-Math.PI / 4, Math.PI / 4, 0]}>
        <torusGeometry args={[4.2, 0.006, 8, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.10} />
      </mesh>

      {/* Stadium atmosphere rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[10, 0.018, 8, 200]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[14, 0.012, 8, 200]} />
        <meshBasicMaterial color="#DC2626" transparent opacity={0.035} />
      </mesh>
    </group>
  )
}

// ── Stadium grid floor ─────────────────────────────────────────────────────

function GroundGrid() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
      <planeGeometry args={[80, 80, 40, 40]} />
      <meshBasicMaterial color="#DC2626" wireframe transparent opacity={0.04} />
    </mesh>
  )
}

// ── Flicker red point lights ────────────────────────────────────────────────

function FlickerLights() {
  const l1 = useRef<THREE.PointLight>(null)
  const l2 = useRef<THREE.PointLight>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (l1.current) l1.current.intensity = 7 + Math.sin(t * 3.1) * 0.8 + Math.sin(t * 7.3) * 0.4
    if (l2.current) l2.current.intensity = 2.5 + Math.sin(t * 2.4 + 1) * 0.5
  })

  return (
    <>
      <pointLight ref={l1} position={[0,   0, 0]} color="#DC2626" intensity={7}   distance={14} />
      <pointLight ref={l2} position={[0, 2.5, 3]} color="#FF4444" intensity={2.5} distance={8}  />
    </>
  )
}

// ── Camera rig ─────────────────────────────────────────────────────────────

function CameraRig() {
  const { camera } = useThree()
  const elapsed    = useRef(0)

  useEffect(() => {
    camera.position.set(0, 1.5, 16)
    camera.lookAt(0, 0, 0)
  }, [camera])

  useFrame((_, delta) => {
    elapsed.current += delta
    const t = elapsed.current

    // Cubic ease-out intro zoom: z 16→8 over 3.5 s
    const prog  = Math.min(t / 3.5, 1)
    const eased = 1 - Math.pow(1 - prog, 3)
    camera.position.z = 16 - 8 * eased

    // Gentle drift begins after 1 s
    if (t > 1) {
      const w = Math.min((t - 1) / 2.5, 1)
      const targetX = Math.sin(t * 0.09) * 1.8 * w
      const targetY = 0.8 + Math.sin(t * 0.06) * 0.5 * w
      camera.position.x += (targetX - camera.position.x) * 0.016
      camera.position.y += (targetY - camera.position.y) * 0.016
    }

    camera.lookAt(0, 0, 0)
  })

  return null
}

// ── Inner scene (inside Canvas) ───────────────────────────────────────────

function InnerScene({ particleCount, mobile }: { particleCount: number; mobile: boolean }) {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog   attach="fog"        args={['#000000', 10, 38]} />

      <ambientLight intensity={0.04} />

      {/* Stadium floodlights */}
      <spotLight position={[ 14, 18,  8]} color="#ffffff" intensity={2.5} angle={0.35} penumbra={0.6} distance={40} />
      <spotLight position={[-14, 18,  8]} color="#ffffff" intensity={2.5} angle={0.35} penumbra={0.6} distance={40} />
      <spotLight position={[  0, 18,-12]} color="#aaccff" intensity={1.8} angle={0.35} penumbra={0.7} distance={40} />
      <spotLight position={[  0, 14, 12]} color="#ffffff" intensity={1.5} angle={0.40} penumbra={0.8} distance={35} />

      <FlickerLights />
      <FloatingParticles count={particleCount} />
      <CenterOrb />
      <GroundGrid />
      <CameraRig />

      {!mobile && (
        <Suspense fallback={null}>
          <EffectComposer>
            <Bloom intensity={1.8} luminanceThreshold={0.25} luminanceSmoothing={0.85} mipmapBlur />
            <Vignette offset={0.42} darkness={0.92} />
          </EffectComposer>
        </Suspense>
      )}
    </>
  )
}

// ── Root export ────────────────────────────────────────────────────────────

export default function CinematicCanvas() {
  const [dpr, setDpr]       = useState<[number, number]>([1, 1.5])
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const w = window.innerWidth
    if (w < 768) {
      setMobile(true)
      setDpr([1, 1])
    }
  }, [])

  const particleCount = mobile ? 2000 : 5000

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 1.5, 16], fov: 55, near: 0.1, far: 100 }}
      gl={{
        antialias: !mobile,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
      }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr([1, 1])}
        onIncline={() => setDpr([1, mobile ? 1 : 1.5])}
      >
        <AdaptiveDpr pixelated />
        <InnerScene particleCount={particleCount} mobile={mobile} />
      </PerformanceMonitor>
    </Canvas>
  )
}
