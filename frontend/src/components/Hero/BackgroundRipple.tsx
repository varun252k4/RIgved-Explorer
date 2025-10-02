import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const BackgroundRipple: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    currentMount.appendChild(renderer.domElement);

    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '-1';
    renderer.domElement.style.pointerEvents = 'none';

    camera.position.z = 5;

    // More visible colors and slower animation
    const auraUniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };

    const auraMaterial = new THREE.ShaderMaterial({
      uniforms: auraUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;

        void main() {
          vec2 uv = gl_FragCoord.xy / resolution.xy;
          float aspect = resolution.x / resolution.y;
          vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);
          float dist = length(centered);

          // Very slow, large ripples
          float ripple1 = sin((dist * 3.0 - time * 0.5) * 4.0);
          float ripple2 = sin((dist * 4.0 - time * 0.7) * 5.0);
          float ripple = (ripple1 + ripple2) * 0.5;

          // Strong color variation
          vec3 color1 = vec3(1.0, 0.6, 0.2); // Saffron
          vec3 color2 = vec3(0.07, 0.53, 0.03); // Green
          vec3 color = mix(color1, color2, smoothstep(0.0, 1.0, dist));

          // High visibility with fade
          float fade = 1.0 - smoothstep(0.0, 0.8, dist);
          float alpha = (ripple * 0.5 + 0.5) * fade * 0.6;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const auraGeometry = new THREE.PlaneGeometry(10, 10, 1, 1);
    const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
    scene.add(auraMesh);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      auraUniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Very slow animation
    const animate = () => {
      requestAnimationFrame(animate);
      auraUniforms.time.value += 0.005; // Very slow
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} />;
};

export default BackgroundRipple;