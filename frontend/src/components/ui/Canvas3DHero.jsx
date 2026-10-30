import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Sprout } from 'lucide-react';

export function Canvas3DHero({ className = '' }) {
  const containerRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    // 1. Accessibility & Mobile Optimization checks
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;

    if (prefersReducedMotion || isMobile) {
      setUseFallback(true);
      return;
    }

    // 2. WebGL Availability check
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setUseFallback(true);
        return;
      }
    } catch (e) {
      setUseFallback(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 400;
    let height = container.clientHeight || 400;

    // 3. Three.js Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 18;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      container.appendChild(renderer.domElement);
    } catch (e) {
      setUseFallback(true);
      return;
    }

    // 4. Create Agricultural Particles & Geometric Ring (sprout / field contour metaphor)
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(0x10b981); // Emerald
    const color2 = new THREE.Color(0x34d399); // Light green
    const color3 = new THREE.Color(0xf59e0b); // Golden harvest amber

    for (let i = 0; i < particleCount; i++) {
      const theta = (i / particleCount) * Math.PI * 4;
      const radius = 3.5 + Math.sin(theta * 3) * 1.5;
      
      const x = Math.cos(theta) * radius + (Math.random() - 0.5) * 1.2;
      const y = Math.sin(theta) * radius * 0.8 + (Math.random() - 0.5) * 1.2;
      const z = (Math.random() - 0.5) * 3;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const mixedColor = Math.random() > 0.3 ? color1.clone().lerp(color2, Math.random()) : color3;
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Subtle inner glowing seed core
    const coreGeometry = new THREE.IcosahedronGeometry(1.6, 2);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x059669,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    // Mouse movement interaction
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / height - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      points.rotation.y += 0.003;
      points.rotation.x += 0.001;

      core.rotation.y -= 0.005;
      core.rotation.x -= 0.002;

      // Gentle mouse tracking
      scene.rotation.y += (mouseX * 0.4 - scene.rotation.y) * 0.05;
      scene.rotation.x += (mouseY * 0.4 - scene.rotation.x) * 0.05;

      renderer.render(scene, camera);
    };
    animate();

    // Resize handling
    const onResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationFrameId);
      geometry.dispose();
      material.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  if (useFallback) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <div className="w-56 h-56 rounded-full bg-gradient-to-tr from-emerald-600/20 via-teal-500/10 to-transparent flex items-center justify-center border border-emerald-500/30 animate-pulse">
          <div className="w-40 h-40 rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center shadow-2xl shadow-emerald-950/60">
            <Sprout className="w-16 h-16 text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[320px] sm:h-[400px] flex items-center justify-center ${className}`}
    />
  );
}

