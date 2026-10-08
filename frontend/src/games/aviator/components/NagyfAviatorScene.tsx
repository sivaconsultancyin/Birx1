import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  phase: string;
  multiplier: number;
  crashMultiplier?: number | null;
  countdown?: number;
};

function createCloud(material: THREE.Material) {
  const group = new THREE.Group();
  const parts = [
    [-18, 0, 0, 18], [0, 5, 0, 24], [20, 0, 0, 20], [6, -5, 5, 16],
  ] as const;
  for (const [x, y, z, r] of parts) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
  return group;
}

function createAirplane() {
  const plane = new THREE.Group();
  const red = new THREE.MeshPhongMaterial({ color: 0xf25346, flatShading: true });
  const white = new THREE.MeshPhongMaterial({ color: 0xd8d0d1, flatShading: true });
  const dark = new THREE.MeshPhongMaterial({ color: 0x59332e, flatShading: true });
  const glass = new THREE.MeshPhongMaterial({ color: 0x68c3c0, transparent: true, opacity: 0.82, flatShading: true });

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(48, 28, 28), red);
  cockpit.position.x = -5;
  plane.add(cockpit);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(16, 28, 28), white);
  engine.position.x = 27;
  plane.add(engine);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 4, 92), white);
  wing.position.set(3, -5, 0);
  plane.add(wing);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(12, 25, 7), red);
  tail.position.set(-27, 14, 0);
  plane.add(tail);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 8), glass);
  nose.position.set(20, 7, 0);
  nose.scale.set(1.15, 0.65, 1);
  plane.add(nose);

  const propeller = new THREE.Group();
  const bladeGeometry = new THREE.BoxGeometry(3, 34, 3);
  for (let i = 0; i < 2; i += 1) {
    const blade = new THREE.Mesh(bladeGeometry, dark);
    blade.rotation.x = i * Math.PI / 2;
    propeller.add(blade);
  }
  propeller.position.x = 36;
  plane.add(propeller);
  plane.userData.propeller = propeller;

  plane.rotation.y = Math.PI;
  plane.scale.setScalar(0.9);
  return plane;
}

export const NagyfAviatorScene: React.FC<Props> = ({ phase, multiplier, crashMultiplier }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ phase, multiplier, crashMultiplier });

  useEffect(() => {
    stateRef.current = { phase, multiplier, crashMultiplier };
  }, [phase, multiplier, crashMultiplier]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf7d9aa, 320, 1700);

    const camera = new THREE.PerspectiveCamera(58, 1, 1, 4000);
    camera.position.set(210, 125, 300);
    camera.lookAt(0, 45, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xfff1dc, 0x476f75, 1.35);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-300, 500, 250);
    sun.castShadow = true;
    scene.add(sun);

    const seaGeometry = new THREE.PlaneGeometry(3000, 3000, 70, 70);
    seaGeometry.rotateX(-Math.PI / 2);
    const seaMaterial = new THREE.MeshPhongMaterial({
      color: 0x68c3c0,
      flatShading: true,
      shininess: 35,
      transparent: true,
      opacity: 0.92,
    });
    const sea = new THREE.Mesh(seaGeometry, seaMaterial);
    sea.position.y = -145;
    sea.receiveShadow = true;
    scene.add(sea);

    const skyMaterial = new THREE.MeshBasicMaterial({ color: 0xf3d6ae, side: THREE.DoubleSide });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(3200, 1800), skyMaterial);
    sky.position.set(-350, 420, -800);
    scene.add(sky);

    const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xfffaf0, transparent: true, opacity: 0.8 });
    const clouds: THREE.Object3D[] = [];
    for (let i = 0; i < 9; i += 1) {
      const cloud = createCloud(cloudMaterial);
      cloud.position.set(
        -650 + (i * 330) % 1700,
        80 + (i % 4) * 80,
        -450 - (i % 3) * 120
      );
      cloud.scale.setScalar(0.65 + (i % 3) * 0.25);
      scene.add(cloud);
      clouds.push(cloud);
    }

    const airplane = createAirplane();
    airplane.castShadow = true;
    scene.add(airplane);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const positions = seaGeometry.attributes.position;
    const baseY = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i += 1) baseY[i] = positions.getY(i);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const state = stateRef.current;
      const running = state.phase === 'running';
      const crashed = state.phase === 'crashed';
      const m = Math.max(1, Number(state.multiplier || 1));
      const target = crashed ? Math.max(1, Number(state.crashMultiplier || m)) : m;

      const flight = running || crashed ? Math.log(target) : 0;
      const time = now / 1000;

      airplane.position.x = -20 + Math.min(680, flight * 240);
      airplane.position.y = 25 + Math.min(230, flight * 82);
      airplane.position.z = Math.sin(time * 0.7) * 12;
      airplane.rotation.z = running ? -0.16 - Math.min(0.35, flight * 0.025) : crashed ? -0.28 : -0.05;
      airplane.rotation.x = Math.sin(time * 2.1) * 0.025;
      airplane.rotation.y = Math.PI + Math.sin(time * 0.7) * 0.04;

      const propeller = airplane.userData.propeller as THREE.Group;
      propeller.rotation.x += dt * 18;

      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        positions.setY(i, baseY[i] + Math.sin(x * 0.018 + time * 1.4) * 7 + Math.cos(z * 0.021 + time) * 5);
      }
      positions.needsUpdate = true;

      clouds.forEach((cloud, i) => {
        cloud.position.x -= dt * (5 + i * 0.8);
        cloud.rotation.y += dt * 0.01;
        if (cloud.position.x < -950) cloud.position.x = 950;
      });

      sea.rotation.z = Math.sin(time * 0.08) * 0.008;

      const targetCameraX = running || crashed ? airplane.position.x - 150 : 210;
      camera.position.x += (targetCameraX - camera.position.x) * Math.min(1, dt * 1.8);
      camera.position.y += ((running ? 115 + flight * 15 : 125) - camera.position.y) * Math.min(1, dt * 1.5);
      camera.lookAt(airplane.position.x + 20, 35 + airplane.position.y * 0.15, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
      seaGeometry.dispose();
      seaMaterial.dispose();
      skyMaterial.dispose();
      cloudMaterial.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="nagyf-aviator-scene" aria-label="Aviator 3D flight scene" />;
};
