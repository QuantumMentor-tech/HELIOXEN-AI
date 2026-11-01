import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { AiCoreProps, AiCoreState, CoreVisualizerTheme } from './types'

const stateThemes: Record<AiCoreState, CoreVisualizerTheme> = {
  idle: {
    primaryColor: 0x00f0ff, // Cyan
    secondaryColor: 0x38bdf8, // Sky
    accentColor: 0x0284c7,
    rotationSpeed: 0.006,
    pulseRate: 0.002,
    particleCount: 160
  },
  listening: {
    primaryColor: 0x00f0ff,
    secondaryColor: 0x67e8f9,
    accentColor: 0x06b6d4,
    rotationSpeed: 0.012,
    pulseRate: 0.005,
    particleCount: 220
  },
  thinking: {
    primaryColor: 0x38bdf8,
    secondaryColor: 0x818cf8,
    accentColor: 0x00f0ff,
    rotationSpeed: 0.024,
    pulseRate: 0.008,
    particleCount: 260
  },
  speaking: {
    primaryColor: 0x00f0ff,
    secondaryColor: 0xa5f3fc,
    accentColor: 0x38bdf8,
    rotationSpeed: 0.016,
    pulseRate: 0.006,
    particleCount: 240
  },
  executing: {
    primaryColor: 0x22d3ee,
    secondaryColor: 0x38bdf8,
    accentColor: 0x00f0ff,
    rotationSpeed: 0.03,
    pulseRate: 0.01,
    particleCount: 280
  },
  'awaiting-confirmation': {
    primaryColor: 0xf59e0b, // Amber Gold
    secondaryColor: 0xfbbf24,
    accentColor: 0xd97706,
    rotationSpeed: 0.008,
    pulseRate: 0.004,
    particleCount: 180
  },
  disconnected: {
    primaryColor: 0x64748b, // Slate Muted
    secondaryColor: 0x475569,
    accentColor: 0x334155,
    rotationSpeed: 0.002,
    pulseRate: 0.001,
    particleCount: 80
  },
  recovering: {
    primaryColor: 0x06b6d4,
    secondaryColor: 0x00f0ff,
    accentColor: 0x38bdf8,
    rotationSpeed: 0.01,
    pulseRate: 0.003,
    particleCount: 140
  },
  error: {
    primaryColor: 0xef4444, // Crimson Red
    secondaryColor: 0xf87171,
    accentColor: 0xb91c1c,
    rotationSpeed: 0.018,
    pulseRate: 0.008,
    particleCount: 200
  }
}

export const AiCoreVisualizer: React.FC<AiCoreProps> = ({
  state = 'idle',
  className = '',
  size = 280,
  ariaLabel,
  onStateClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFallback2D, setIsFallback2D] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Detect reduced-motion preference
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setPrefersReducedMotion(mediaQuery.matches)

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches)
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    return undefined
  }, [])

  // WebGL 3D Real-Time Render Pipeline
  useEffect(() => {
    if (isFallback2D || !containerRef.current) return undefined

    const container = containerRef.current
    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let animationFrameId: number | null = null
    let isDisposed = false

    // Clean any prior children
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    try {
      // 1. Scene & Camera Setup
      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
      camera.position.z = 5.2

      // 2. WebGL Renderer with Alpha & Antialiasing
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      })
      renderer.setSize(size, size)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      container.appendChild(renderer.domElement)

      // Handle WebGL Context Loss gracefully
      const handleContextLost = (e: Event) => {
        e.preventDefault()
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
        setIsFallback2D(true)
      }
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost)

      // 3. Procedural Geometry Construction
      const theme = stateThemes[state]

      // Central Energy Core Sphere
      const coreGeometry = new THREE.IcosahedronGeometry(0.85, 2)
      const coreWireGeometry = new THREE.IcosahedronGeometry(0.88, 1)

      const coreMaterial = new THREE.MeshBasicMaterial({
        color: theme.primaryColor,
        wireframe: true,
        transparent: true,
        opacity: 0.85
      })

      const innerCoreMaterial = new THREE.MeshBasicMaterial({
        color: theme.secondaryColor,
        transparent: true,
        opacity: 0.25
      })

      const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial)
      const innerMesh = new THREE.Mesh(coreWireGeometry, innerCoreMaterial)
      scene.add(coreMesh)
      scene.add(innerMesh)

      // Orbital Concentric Rings
      const ringGroup = new THREE.Group()
      scene.add(ringGroup)

      const createOrbitalRing = (radius: number, tiltX: number, tiltY: number, color: number) => {
        const ringGeo = new THREE.TorusGeometry(radius, 0.012, 8, 80)
        const ringMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.75
        })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.rotation.x = tiltX
        ring.rotation.y = tiltY
        ringGroup.add(ring)
        return { mesh: ring, geo: ringGeo, mat: ringMat }
      }

      const ring1 = createOrbitalRing(1.6, Math.PI / 2.2, 0.2, theme.primaryColor)
      const ring2 = createOrbitalRing(1.9, -Math.PI / 3.5, 0.5, theme.secondaryColor)
      const ring3 = createOrbitalRing(2.2, Math.PI / 6.0, -0.4, theme.accentColor)

      // Surrounding Orbital Particles
      const particleGeo = new THREE.BufferGeometry()
      const particleCount = theme.particleCount
      const positions = new Float32Array(particleCount * 3)

      for (let i = 0; i < particleCount; i++) {
        const u = Math.random()
        const v = Math.random()
        const theta = u * 2.0 * Math.PI
        const phi = Math.acos(2.0 * v - 1.0)
        const r = 1.4 + Math.random() * 1.1

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = r * Math.cos(phi)
      }

      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const particleMat = new THREE.PointsMaterial({
        color: theme.primaryColor,
        size: 0.04,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      })

      const particles = new THREE.Points(particleGeo, particleMat)
      scene.add(particles)

      // 4. Animation Loop
      let clockTime = 0
      const animate = () => {
        if (isDisposed) return

        if (!prefersReducedMotion) {
          clockTime += 0.015

          // Gentle rotation & counter-rotations
          coreMesh.rotation.y += theme.rotationSpeed
          coreMesh.rotation.x += theme.rotationSpeed * 0.5
          innerMesh.rotation.y -= theme.rotationSpeed * 0.7

          ring1.mesh.rotation.z += theme.rotationSpeed * 1.2
          ring2.mesh.rotation.z -= theme.rotationSpeed * 0.9
          ring3.mesh.rotation.x += theme.rotationSpeed * 0.6

          particles.rotation.y += theme.rotationSpeed * 0.4
          particles.rotation.x -= theme.rotationSpeed * 0.2

          // Breathing scale pulse
          const pulse = 1 + Math.sin(clockTime * 2) * 0.04
          coreMesh.scale.set(pulse, pulse, pulse)
        } else {
          // Static, restrained arrangement under reduced-motion mode
          coreMesh.scale.set(1, 1, 1)
        }

        if (renderer && scene && camera) {
          renderer.render(scene, camera)
        }

        if (!prefersReducedMotion) {
          animationFrameId = requestAnimationFrame(animate)
        }
      }

      // Start initial render or RAF loop
      if (prefersReducedMotion) {
        renderer.render(scene, camera)
      } else {
        animationFrameId = requestAnimationFrame(animate)
      }

      // Cleanup hook
      return () => {
        isDisposed = true
        if (animationFrameId) cancelAnimationFrame(animationFrameId)

        // Dispose geometries & materials
        coreGeometry.dispose()
        coreWireGeometry.dispose()
        coreMaterial.dispose()
        innerCoreMaterial.dispose()

        ring1.geo.dispose()
        ring1.mat.dispose()
        ring2.geo.dispose()
        ring2.mat.dispose()
        ring3.geo.dispose()
        ring3.mat.dispose()

        particleGeo.dispose()
        particleMat.dispose()

        if (renderer) {
          renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        }
      }
    } catch (err) {
      console.warn('WebGL initialization failed, falling back to 2D Canvas:', err)
      setIsFallback2D(true)
      return undefined
    }
  }, [state, size, isFallback2D, prefersReducedMotion])

  // 2D Canvas Fallback Pipeline (for low-power GPUs, software rendering, or context lost)
  useEffect(() => {
    if (!isFallback2D || !containerRef.current) return undefined

    const container = containerRef.current
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    const canvas = document.createElement('canvas')
    canvas.width = size * 2
    canvas.height = size * 2
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    container.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const center = size
    let angle = 0
    let animId: number | null = null

    const draw2D = () => {
      ctx.clearRect(0, 0, size * 2, size * 2)

      // Central glowing gradient
      const grad = ctx.createRadialGradient(center, center, 10, center, center, size * 0.45)
      grad.addColorStop(0, '#00f0ff')
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)')
      grad.addColorStop(1, 'rgba(7, 10, 16, 0)')

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(center, center, size * 0.45, 0, Math.PI * 2)
      ctx.fill()

      // Orbital Rings
      ctx.save()
      ctx.translate(center, center)
      ctx.rotate(angle)

      ctx.strokeStyle = '#00f0ff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(0, 0, size * 0.7, size * 0.28, Math.PI / 4, 0, Math.PI * 2)
      ctx.stroke()

      ctx.strokeStyle = '#38bdf8'
      ctx.beginPath()
      ctx.ellipse(0, 0, size * 0.8, size * 0.32, -Math.PI / 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      if (!prefersReducedMotion) {
        angle += 0.015
        animId = requestAnimationFrame(draw2D)
      }
    }

    draw2D()

    return () => {
      if (animId) cancelAnimationFrame(animId)
      if (container.contains(canvas)) {
        container.removeChild(canvas)
      }
    }
  }, [isFallback2D, size, prefersReducedMotion])

  const defaultAriaLabel = `HELIOXEN Orbital AI Core: Status ${state.toUpperCase()}`

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      onClick={() => onStateClick?.(state)}
      role="img"
      aria-label={ariaLabel || defaultAriaLabel}
    >
      {/* 3D / 2D Canvas Mount Container */}
      <div
        ref={containerRef}
        style={{ width: size, height: size }}
        className="flex items-center justify-center overflow-hidden"
      />

      {/* Semantic Accessible Status Tag */}
      <div className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-hx-space/90 border border-hx-border-glow shadow-hx-glow-cyan-sm text-[10px] font-mono tracking-wider uppercase text-hx-cyan pointer-events-none">
        {state}
      </div>
    </div>
  )
}
