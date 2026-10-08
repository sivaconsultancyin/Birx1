import * as THREE from 'three';

export interface DealerHandRig {
  shoulder: THREE.Group;
  upperArm: THREE.Group;
  elbow: THREE.Group;
  forearm: THREE.Group;
  wrist: THREE.Group;
  palm: THREE.Group;
  thumb: THREE.Group;
  fingers: THREE.Group[];
}

export interface DealerRig {
  root: THREE.Group;
  spine: THREE.Group;
  torso: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftHand: DealerHandRig;
  rightHand: DealerHandRig;
  name: string;
  isFemale: boolean;
  basePosition: THREE.Vector3;
}

/**
 * Creates an anatomically proportioned human hand with five articulated fingers
 */
function createArticulatedHand(
  skinMaterial: THREE.Material,
  isLeft: boolean
): { palm: THREE.Group; thumb: THREE.Group; fingers: THREE.Group[] } {
  const palmGroup = new THREE.Group();

  // Palm Geometry: Anatomical wedge
  const palmGeo = new THREE.BoxGeometry(0.38, 0.46, 0.12);
  const palmMesh = new THREE.Mesh(palmGeo, skinMaterial);
  palmMesh.castShadow = true;
  palmMesh.receiveShadow = true;
  palmGroup.add(palmMesh);

  // Thumb: 2 segments + base knuckle
  const thumbBase = new THREE.Group();
  thumbBase.position.set(isLeft ? 0.22 : -0.22, -0.08, 0.04);
  thumbBase.rotation.z = isLeft ? -0.45 : 0.45;
  thumbBase.rotation.y = isLeft ? 0.25 : -0.25;

  const thumbPhalanx1Geo = new THREE.CylinderGeometry(0.065, 0.06, 0.18, 8);
  const thumb1 = new THREE.Mesh(thumbPhalanx1Geo, skinMaterial);
  thumb1.position.y = 0.09;
  thumb1.castShadow = true;
  thumbBase.add(thumb1);

  const thumbJoint2 = new THREE.Group();
  thumbJoint2.position.y = 0.18;
  const thumbPhalanx2Geo = new THREE.CylinderGeometry(0.055, 0.045, 0.16, 8);
  const thumb2 = new THREE.Mesh(thumbPhalanx2Geo, skinMaterial);
  thumb2.position.y = 0.08;
  thumb2.castShadow = true;
  thumbJoint2.add(thumb2);
  thumbBase.add(thumbJoint2);

  palmGroup.add(thumbBase);

  // 4 Fingers: Index, Middle, Ring, Pinky
  const fingerConfigs = [
    { offset: isLeft ? 0.13 : -0.13, len: 0.32, radius: 0.052 },  // Index
    { offset: isLeft ? 0.04 : -0.04, len: 0.36, radius: 0.054 },  // Middle
    { offset: isLeft ? -0.05 : 0.05, len: 0.33, radius: 0.050 }, // Ring
    { offset: isLeft ? -0.13 : 0.13, len: 0.27, radius: 0.044 }  // Pinky
  ];

  const fingers: THREE.Group[] = [];

  fingerConfigs.forEach((cfg) => {
    const fingerBase = new THREE.Group();
    fingerBase.position.set(cfg.offset, 0.23, 0);

    // Proximal Phalanx
    const p1Geo = new THREE.CylinderGeometry(cfg.radius, cfg.radius * 0.92, cfg.len * 0.44, 8);
    const p1 = new THREE.Mesh(p1Geo, skinMaterial);
    p1.position.y = (cfg.len * 0.44) / 2;
    p1.castShadow = true;
    fingerBase.add(p1);

    // Intermediate Joint
    const j2 = new THREE.Group();
    j2.position.y = cfg.len * 0.44;
    const p2Geo = new THREE.CylinderGeometry(cfg.radius * 0.9, cfg.radius * 0.8, cfg.len * 0.34, 8);
    const p2 = new THREE.Mesh(p2Geo, skinMaterial);
    p2.position.y = (cfg.len * 0.34) / 2;
    p2.castShadow = true;
    j2.add(p2);
    fingerBase.add(j2);

    // Distal Joint / Tip
    const j3 = new THREE.Group();
    j3.position.y = cfg.len * 0.34;
    const p3Geo = new THREE.CylinderGeometry(cfg.radius * 0.78, cfg.radius * 0.6, cfg.len * 0.26, 8);
    const p3 = new THREE.Mesh(p3Geo, skinMaterial);
    p3.position.y = (cfg.len * 0.26) / 2;
    p3.castShadow = true;
    j3.add(p3);
    j2.add(j3);

    palmGroup.add(fingerBase);
    fingers.push(fingerBase);
  });

  return { palm: palmGroup, thumb: thumbBase, fingers };
}

/**
 * Creates an arm with shoulder, upper arm, elbow, forearm, cuff, wrist, and articulated hand
 */
function createDealerArm(
  suitMaterial: THREE.Material,
  shirtMaterial: THREE.Material,
  skinMaterial: THREE.Material,
  isLeft: boolean
): DealerHandRig {
  const shoulder = new THREE.Group();

  // Upper Arm
  const upperArm = new THREE.Group();
  shoulder.add(upperArm);

  const upperArmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.16, 0.95, 12),
    suitMaterial
  );
  upperArmMesh.position.y = -0.475;
  upperArmMesh.castShadow = true;
  upperArm.add(upperArmMesh);

  // Elbow Joint
  const elbow = new THREE.Group();
  elbow.position.y = -0.95;
  upperArm.add(elbow);

  // Forearm
  const forearm = new THREE.Group();
  elbow.add(forearm);

  const forearmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.13, 0.85, 12),
    suitMaterial
  );
  forearmMesh.position.y = -0.425;
  forearmMesh.castShadow = true;
  forearm.add(forearmMesh);

  // White Shirt French Cuff with Gold Cufflink
  const cuffMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.14, 0.12, 12),
    shirtMaterial
  );
  cuffMesh.position.y = -0.86;
  forearm.add(cuffMesh);

  const cufflinkGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8);
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.2
  });
  const cufflink = new THREE.Mesh(cufflinkGeo, goldMaterial);
  cufflink.position.set(isLeft ? 0.14 : -0.14, -0.86, 0);
  cufflink.rotation.z = Math.PI / 2;
  forearm.add(cufflink);

  // Wrist Joint
  const wrist = new THREE.Group();
  wrist.position.y = -0.92;
  forearm.add(wrist);

  // Articulated Hand
  const hand = createArticulatedHand(skinMaterial, isLeft);
  hand.palm.position.y = -0.24;
  wrist.add(hand.palm);

  return {
    shoulder,
    upperArm,
    elbow,
    forearm,
    wrist,
    palm: hand.palm,
    thumb: hand.thumb,
    fingers: hand.fingers
  };
}

/**
 * Builds a realistic 3D Human Casino Croupier Model
 */
export function create3DDealer(name: string, isFemale: boolean, xOffset: number): DealerRig {
  const root = new THREE.Group();
  root.position.set(xOffset, 1.3, -2.4);

  // Realistic PBR Materials
  const skinColor = isFemale ? 0xf3d2be : 0xe4beaa;
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.52,
    metalness: 0.08
  });

  const suitMaterial = new THREE.MeshStandardMaterial({
    color: 0x141416, // Tailored Charcoal/Black wool vest
    roughness: 0.7,
    metalness: 0.1
  });

  const shirtMaterial = new THREE.MeshStandardMaterial({
    color: 0xfbfbfd, // Crisp White Collared Shirt
    roughness: 0.45,
    metalness: 0.02
  });

  const bowtieMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c, // Satin Bowtie
    roughness: 0.3,
    metalness: 0.3
  });

  const hairMaterial = new THREE.MeshStandardMaterial({
    color: isFemale ? 0x24140e : 0x1a120b, // Dark Brunette / Espresso Hair
    roughness: 0.65,
    metalness: 0.15
  });

  // Spine & Torso Group (for subtle breathing)
  const spine = new THREE.Group();
  root.add(spine);

  const torso = new THREE.Group();
  spine.add(torso);

  // Torso / Vest Mesh
  const torsoGeo = isFemale
    ? new THREE.CylinderGeometry(0.68, 0.54, 1.5, 16)
    : new THREE.CylinderGeometry(0.78, 0.62, 1.6, 16);
  const torsoMesh = new THREE.Mesh(torsoGeo, suitMaterial);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torso.add(torsoMesh);

  // White Shirt Collar
  const collarMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.48, 0.38, 12, 1, true),
    shirtMaterial
  );
  collarMesh.position.set(0, 0.82, 0.1);
  collarMesh.rotation.x = 0.2;
  torso.add(collarMesh);

  // Satin Bowtie
  const bowCenter = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    bowtieMaterial
  );
  bowCenter.position.set(0, 0.76, 0.34);
  const bowLeft = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.2, 4),
    bowtieMaterial
  );
  bowLeft.position.set(-0.12, 0.76, 0.34);
  bowLeft.rotation.z = Math.PI / 2;
  const bowRight = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.2, 4),
    bowtieMaterial
  );
  bowRight.position.set(0.12, 0.76, 0.34);
  bowRight.rotation.z = -Math.PI / 2;
  torso.add(bowCenter);
  torso.add(bowLeft);
  torso.add(bowRight);

  // Name Tag Badge (Gold & Black)
  const badgeGeo = new THREE.BoxGeometry(0.24, 0.1, 0.02);
  const badgeMat = new THREE.MeshStandardMaterial({
    color: 0x221f1b,
    roughness: 0.3,
    metalness: 0.8
  });
  const badge = new THREE.Mesh(badgeGeo, badgeMat);
  badge.position.set(-0.32, 0.45, 0.34);
  badge.rotation.y = 0.2;
  torso.add(badge);

  // Neck
  const neck = new THREE.Group();
  neck.position.y = 0.88;
  torso.add(neck);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.4, 12),
    skinMaterial
  );
  neckMesh.position.y = 0.18;
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  // Head
  const head = new THREE.Group();
  head.position.y = 0.42;
  neck.add(head);

  // Realistic Head Contour
  const headGeo = new THREE.SphereGeometry(0.42, 20, 20);
  headGeo.scale(1, 1.25, 1.05);
  const headMesh = new THREE.Mesh(headGeo, skinMaterial);
  headMesh.castShadow = true;
  head.add(headMesh);

  // Hair Mesh
  const hairGeo = new THREE.SphereGeometry(0.45, 16, 16);
  hairGeo.scale(1.04, 1.18, 1.15);
  const hairMesh = new THREE.Mesh(hairGeo, hairMaterial);
  hairMesh.position.set(0, 0.12, -0.06);
  hairMesh.castShadow = true;
  head.add(hairMesh);

  if (isFemale) {
    // Elena's elegant bun
    const bunGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const bun = new THREE.Mesh(bunGeo, hairMaterial);
    bun.position.set(0, 0.15, -0.48);
    head.add(bun);
  }

  // Realistic Eyes
  const eyeGeo = new THREE.SphereGeometry(0.048, 12, 12);
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.15,
    metalness: 0.1
  });

  const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
  leftEye.position.set(-0.14, 0.06, 0.38);
  head.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
  rightEye.position.set(0.14, 0.06, 0.38);
  head.add(rightEye);

  // Iris pupils
  const irisMaterial = new THREE.MeshStandardMaterial({
    color: isFemale ? 0x3d2b1f : 0x2b3d30,
    roughness: 0.2
  });
  const irisGeo = new THREE.SphereGeometry(0.024, 8, 8);
  const leftIris = new THREE.Mesh(irisGeo, irisMaterial);
  leftIris.position.set(0, 0, 0.038);
  leftEye.add(leftIris);

  const rightIris = new THREE.Mesh(irisGeo, irisMaterial);
  rightIris.position.set(0, 0, 0.038);
  rightEye.add(rightIris);

  // Left Arm Attachment (Elena's left / dealer's right)
  const leftHandRig = createDealerArm(suitMaterial, shirtMaterial, skinMaterial, true);
  leftHandRig.shoulder.position.set(-0.76, 0.65, 0);
  torso.add(leftHandRig.shoulder);

  // Right Arm Attachment
  const rightHandRig = createDealerArm(suitMaterial, shirtMaterial, skinMaterial, false);
  rightHandRig.shoulder.position.set(0.76, 0.65, 0);
  torso.add(rightHandRig.shoulder);

  // Set resting posture on table
  // Shoulder resting angles
  leftHandRig.upperArm.rotation.set(0.65, 0.15, -0.45);
  leftHandRig.elbow.rotation.set(0.85, 0.35, 0);
  leftHandRig.wrist.rotation.set(-0.3, 0.2, 0);

  rightHandRig.upperArm.rotation.set(0.65, -0.15, 0.45);
  rightHandRig.elbow.rotation.set(0.85, -0.35, 0);
  rightHandRig.wrist.rotation.set(-0.3, -0.2, 0);

  return {
    root,
    spine,
    torso,
    neck,
    head,
    leftEye,
    rightEye,
    leftHand: leftHandRig,
    rightHand: rightHandRig,
    name,
    isFemale,
    basePosition: new THREE.Vector3(xOffset, 1.3, -2.4)
  };
}
