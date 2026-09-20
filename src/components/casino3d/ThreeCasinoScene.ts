import * as THREE from 'three';
import { create3DDealer, DealerRig } from './ThreeDealerModel.ts';
import { create3DPlayingCard, ThreeCardObject } from './ThreeCardSystem.ts';
import { casinoAudio } from '../../utils/casinoAudio.ts';

export type Casino3DState =
  | 'IDLE'
  | 'SHUFFLE'
  | 'DECK_HANDLING'
  | 'DEAL'
  | 'REVEAL'
  | 'RESULT'
  | 'RESET';

export interface DealCardRequest {
  id: string;
  suit: string;
  rank: string;
  targetPos: { x: number; y: number; z: number };
  targetRotY?: number;
  isFaceUp: boolean;
  dealerSide?: 'left' | 'right';
  delayMs?: number;
}

export class ThreeCasinoScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  // Dealers
  public elenaDealer: DealerRig;
  public marcusDealer: DealerRig;

  // Table and Environment
  public tableGroup: THREE.Group;
  public shoeMesh: THREE.Mesh;
  public deckMesh: THREE.Group;

  // Shuffle Cards
  public leftShufflePacket: THREE.Mesh;
  public rightShufflePacket: THREE.Mesh;
  public shuffleRiffleLeaves: THREE.Mesh[] = [];

  // Active Dealt Cards
  public cards: Map<string, ThreeCardObject> = new Map();

  // State Machine
  public state: Casino3DState = 'IDLE';
  private shuffleProgress: number = 0;
  private shuffleStartTime: number = 0;
  private shuffleDuration: number = 4.2; // 4.2s realistic human shuffle sequence
  private isShuffling: boolean = false;
  private onShuffleCompleteCallback: (() => void) | null = null;

  // Animation Frame
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private clock: THREE.Clock;
  private isDisposed: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // 1. Scene & Background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060e0a);
    this.scene.fog = new THREE.FogExp2(0x060e0a, 0.08);

    // 2. Camera: Cinematic Broadcast View looking down onto table
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 3.8, 4.6);
    this.camera.lookAt(0, 0.6, -0.2);

    // 3. Renderer with Mobile Optimization
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting Rig
    this.setupLighting();

    // 5. Environment & Casino Table
    this.tableGroup = new THREE.Group();
    this.scene.add(this.tableGroup);
    this.buildCasinoTable();

    // 6. Two Realistic 3D Human Dealers
    this.elenaDealer = create3DDealer('Elena', true, -1.9);
    this.marcusDealer = create3DDealer('Marcus', false, 1.9);
    this.scene.add(this.elenaDealer.root);
    this.scene.add(this.marcusDealer.root);

    // 7. Physical Shuffle Packets & Shoe
    this.deckMesh = new THREE.Group();
    this.shoeMesh = this.buildDealingShoe();
    const shufflePackets = this.buildShufflePackets();
    this.leftShufflePacket = shufflePackets.left;
    this.rightShufflePacket = shufflePackets.right;
    this.shuffleRiffleLeaves = shufflePackets.leaves;

    // Start Rendering Loop
    this.lastTime = performance.now();
    this.render = this.render.bind(this);
    this.animationFrameId = requestAnimationFrame(this.render);
  }

  private setupLighting() {
    // Soft Studio Ambient
    const ambientLight = new THREE.AmbientLight(0xfff3e0, 0.9);
    this.scene.add(ambientLight);

    // Overhead Table Spotlight with warm golden casino tone
    const tableSpot = new THREE.SpotLight(0xfff8e7, 4.2);
    tableSpot.position.set(0, 6.2, 0.5);
    tableSpot.angle = Math.PI / 3.4;
    tableSpot.penumbra = 0.6;
    tableSpot.decay = 1.2;
    tableSpot.castShadow = true;
    tableSpot.shadow.mapSize.width = 1024;
    tableSpot.shadow.mapSize.height = 1024;
    tableSpot.shadow.bias = -0.001;
    this.scene.add(tableSpot);

    // Elena Rim Light
    const elenaLight = new THREE.DirectionalLight(0xfef08a, 1.8);
    elenaLight.position.set(-4, 4.5, -1);
    this.scene.add(elenaLight);

    // Marcus Rim Light
    const marcusLight = new THREE.DirectionalLight(0x93c5fd, 1.4);
    marcusLight.position.set(4, 4.5, -1);
    this.scene.add(marcusLight);
  }

  private buildCasinoTable() {
    // Table Felt (Curved Stadium / Oval Felt)
    const feltGeo = new THREE.CylinderGeometry(3.6, 3.6, 0.12, 48);
    feltGeo.scale(1.25, 1, 0.85);

    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x073522, // Deep Emerald Microfiber Felt
      roughness: 0.8,
      metalness: 0.05
    });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.set(0, 0, 0);
    felt.receiveShadow = true;
    this.tableGroup.add(felt);

    // Lacquered Mahogany Wood Rim / Armrest
    const rimGeo = new THREE.TorusGeometry(3.6, 0.22, 16, 48);
    rimGeo.scale(1.25, 0.85, 1);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x421a08,
      roughness: 0.25,
      metalness: 0.15
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.08;
    rim.castShadow = true;
    this.tableGroup.add(rim);

    // Outer Padded Leather Rail
    const railGeo = new THREE.TorusGeometry(3.88, 0.18, 16, 48);
    railGeo.scale(1.25, 0.85, 1);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x111112,
      roughness: 0.5,
      metalness: 0.1
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 0.1;
    this.tableGroup.add(rail);

    // Dealer Chip Tray (Banker Chips)
    const chipTrayGroup = new THREE.Group();
    chipTrayGroup.position.set(0, 0.1, -1.4);

    const trayBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.7 })
    );
    chipTrayGroup.add(trayBase);

    // Stacks of physical casino chips
    const chipColors = [0xdc2626, 0x2563eb, 0x16a34a, 0x9333ea, 0xf59e0b];
    for (let col = 0; col < 5; col++) {
      for (let c = 0; c < 6; c++) {
        const chip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.024, 16),
          new THREE.MeshStandardMaterial({
            color: chipColors[col],
            roughness: 0.3,
            metalness: 0.2
          })
        );
        chip.position.set(-0.56 + col * 0.28, 0.06 + c * 0.026, 0);
        chip.castShadow = true;
        chipTrayGroup.add(chip);
      }
    }
    this.tableGroup.add(chipTrayGroup);
  }

  private buildDealingShoe(): THREE.Mesh {
    // Transparent / Tinted Acrylic Dealing Shoe placed on right side of table
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(1.9, 0.14, -0.6);
    shoeGroup.rotation.y = -0.45;

    const bodyGeo = new THREE.BoxGeometry(0.7, 0.45, 1.4);
    const shoeMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.45
    });
    const shoe = new THREE.Mesh(bodyGeo, shoeMat);
    shoe.castShadow = true;
    shoeGroup.add(shoe);

    // Visual cards loaded inside the shoe
    const cardsInShoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.35, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x660a15, roughness: 0.4 })
    );
    cardsInShoe.position.set(0, 0.02, -0.05);
    cardsInShoe.rotation.x = 0.15;
    shoeGroup.add(cardsInShoe);

    this.tableGroup.add(shoeGroup);
    return shoe;
  }

  private buildShufflePackets() {
    const leftPacketGeo = new THREE.BoxGeometry(0.9, 0.14, 1.3);
    const rightPacketGeo = new THREE.BoxGeometry(0.9, 0.14, 1.3);
    const packetMat = new THREE.MeshStandardMaterial({
      color: 0x5a0711,
      roughness: 0.4,
      metalness: 0.1
    });

    const left = new THREE.Mesh(leftPacketGeo, packetMat);
    const right = new THREE.Mesh(rightPacketGeo, packetMat);
    left.castShadow = true;
    right.castShadow = true;

    left.position.set(0, -10, 0); // Hide initially below table
    right.position.set(0, -10, 0);

    this.scene.add(left);
    this.scene.add(right);

    // Create small card leaves for riffle interleave animation
    const leaves: THREE.Mesh[] = [];
    const leafGeo = new THREE.BoxGeometry(0.9, 0.012, 1.3);
    for (let i = 0; i < 14; i++) {
      const leaf = new THREE.Mesh(leafGeo, packetMat);
      leaf.position.set(0, -10, 0);
      this.scene.add(leaf);
      leaves.push(leaf);
    }

    return { left, right, leaves };
  }

  /**
   * Triggers the realistic human casino shuffle sequence:
   * "Reach → Pick Up Deck → Split Deck → Shuffle/Interleave → Combine → Square Deck → Place Deck"
   */
  public startShuffle(onComplete?: () => void) {
    this.state = 'SHUFFLE';
    this.isShuffling = true;
    this.shuffleStartTime = performance.now();
    this.shuffleProgress = 0;
    this.onShuffleCompleteCallback = onComplete || null;

    // Reset existing cards from previous round
    this.cards.forEach((c) => {
      this.scene.remove(c.mesh);
    });
    this.cards.clear();

    // Show shuffle packets at center
    this.leftShufflePacket.position.set(-0.6, 0.15, -0.3);
    this.rightShufflePacket.position.set(0.6, 0.15, -0.3);

    casinoAudio.playCardDeal();
  }

  /**
   * Adds a card to be dealt with 3D parabolic trajectory, banking rotation, and placement
   */
  public dealCard(req: DealCardRequest, onComplete?: () => void) {
    const cardObj = create3DPlayingCard(req.suit, req.rank);

    // Start position: Acrylic Dealing Shoe at (1.9, 0.35, -0.6)
    const shoePos = new THREE.Vector3(1.9, 0.35, -0.6);
    cardObj.mesh.position.copy(shoePos);
    cardObj.mesh.rotation.set(-Math.PI / 2, 0, -0.45);

    cardObj.flightStartPos.copy(shoePos);
    cardObj.flightStartRot.copy(cardObj.mesh.rotation);

    cardObj.targetPos.set(req.targetPos.x, req.targetPos.y + 0.08, req.targetPos.z);
    cardObj.targetRot.set(-Math.PI / 2, 0, req.targetRotY || 0);

    cardObj.isFlying = true;
    cardObj.currentFlightProgress = 0;
    cardObj.flightElapsed = 0;
    cardObj.flightDuration = 0.46; // 460ms natural dealing flight speed

    // Face orientation
    if (req.isFaceUp) {
      // Rotate around X to face up
      cardObj.targetRot.x = Math.PI / 2;
      cardObj.isFaceUp = true;
    } else {
      cardObj.targetRot.x = -Math.PI / 2;
      cardObj.isFaceUp = false;
    }

    this.scene.add(cardObj.mesh);
    this.cards.set(req.id, cardObj);

    // Audio cue
    casinoAudio.playCardDeal();

    // Trigger dealer arm dealing motion
    const dealer = req.dealerSide === 'left' ? this.elenaDealer : this.marcusDealer;
    this.triggerDealerDealMotion(dealer, req.targetPos);

    setTimeout(() => {
      if (req.isFaceUp) {
        casinoAudio.playCardFlip();
      }
      if (onComplete) onComplete();
    }, 480);
  }

  /**
   * Smoothly reveals (flips) a card currently on the table
   */
  public flipCard(cardId: string) {
    const card = this.cards.get(cardId);
    if (!card || card.isFaceUp) return;

    card.isFlipping = true;
    card.flipProgress = 0;
    card.isFaceUp = true;
    casinoAudio.playCardFlip();
  }

  private triggerDealerDealMotion(dealer: DealerRig, targetPos: { x: number; y: number; z: number }) {
    // Animate dealer's arm pitching forward to deliver the card
    const arm = dealer.isFemale ? dealer.leftHand : dealer.rightHand;
    const initialUpperRot = arm.upperArm.rotation.clone();
    const initialForearmRot = arm.forearm.rotation.clone();
    const initialWristRot = arm.wrist.rotation.clone();

    // Reach towards table center
    arm.upperArm.rotation.x = 0.95;
    arm.forearm.rotation.x = 0.45;
    arm.wrist.rotation.x = -0.15;

    // Curl index and middle fingers as if gripping and pitching
    arm.fingers.forEach((f, idx) => {
      f.rotation.x = idx < 2 ? 0.35 : 0.15;
    });

    // Ease back to rest position
    setTimeout(() => {
      arm.upperArm.rotation.copy(initialUpperRot);
      arm.forearm.rotation.copy(initialForearmRot);
      arm.wrist.rotation.copy(initialWristRot);
      arm.fingers.forEach((f) => {
        f.rotation.x = 0;
      });
    }, 420);
  }

  private updateShuffleAnimation(progress: number) {
    // 7 Physical Stages:
    // 0.0 - 0.15: Reach & Hands approach center deck
    // 0.15 - 0.30: Pick up deck & split into two 26-card packets
    // 0.30 - 0.50: Angle & bevel grip with thumbs
    // 0.50 - 0.72: Riffle flutter & interleaving
    // 0.72 - 0.85: Bridge arch & waterfall cascade
    // 0.85 - 0.95: Square deck flush
    // 0.95 - 1.00: Place deck in shoe

    const t = progress;

    if (t < 0.15) {
      // 1. REACH
      const subT = t / 0.15;
      this.elenaDealer.leftHand.upperArm.rotation.x = 0.65 + subT * 0.3;
      this.marcusDealer.rightHand.upperArm.rotation.x = 0.65 + subT * 0.3;
      this.leftShufflePacket.position.set(-0.2, 0.14, -0.3);
      this.rightShufflePacket.position.set(0.2, 0.14, -0.3);
    } else if (t < 0.35) {
      // 2. PICKUP & SPLIT
      const subT = (t - 0.15) / 0.2;
      const spread = 0.2 + subT * 0.5; // Spread packets to -0.7 and +0.7
      this.leftShufflePacket.position.set(-spread, 0.18, -0.3);
      this.rightShufflePacket.position.set(spread, 0.18, -0.3);
      this.leftShufflePacket.rotation.z = -subT * 0.15;
      this.rightShufflePacket.rotation.z = subT * 0.15;
    } else if (t < 0.7) {
      // 3. RIFFLE INTERLEAVE
      const subT = (t - 0.35) / 0.35;
      const interleave = 0.7 - subT * 0.45;
      this.leftShufflePacket.position.set(-interleave, 0.15, -0.3);
      this.rightShufflePacket.position.set(interleave, 0.15, -0.3);

      // Show animated flutter leaves
      const leafCount = this.shuffleRiffleLeaves.length;
      this.shuffleRiffleLeaves.forEach((leaf, idx) => {
        const isLeft = idx % 2 === 0;
        const leafProgress = Math.min(1, Math.max(0, subT * 1.3 - idx / leafCount));
        leaf.position.set(
          isLeft ? -0.35 + leafProgress * 0.35 : 0.35 - leafProgress * 0.35,
          0.14 + idx * 0.006,
          -0.3
        );
        leaf.rotation.z = (isLeft ? -1 : 1) * (1 - leafProgress) * 0.2;
      });
    } else if (t < 0.85) {
      // 4. BRIDGE CASCADE
      const subT = (t - 0.7) / 0.15;
      const archHeight = Math.sin(subT * Math.PI) * 0.2;
      this.leftShufflePacket.position.set(-0.15, 0.15 + archHeight, -0.3);
      this.rightShufflePacket.position.set(0.15, 0.15 + archHeight, -0.3);
      this.leftShufflePacket.rotation.y = -subT * 0.1;
      this.rightShufflePacket.rotation.y = subT * 0.1;

      // Hide leaves
      this.shuffleRiffleLeaves.forEach((l) => l.position.set(0, -10, 0));
    } else if (t < 0.95) {
      // 5. SQUARE DECK
      const subT = (t - 0.85) / 0.1;
      this.leftShufflePacket.position.set(-0.02, 0.14, -0.3);
      this.rightShufflePacket.position.set(0.02, 0.14, -0.3);
      this.leftShufflePacket.rotation.set(0, 0, 0);
      this.rightShufflePacket.rotation.set(0, 0, 0);

      // Hands gently tap edges flush
      this.elenaDealer.leftHand.upperArm.rotation.x = 0.85 - subT * 0.1;
      this.marcusDealer.rightHand.upperArm.rotation.x = 0.85 - subT * 0.1;
    } else {
      // 6. PLACE IN SHOE
      this.leftShufflePacket.position.set(0, -10, 0);
      this.rightShufflePacket.position.set(0, -10, 0);
    }
  }

  private updateCardFlights(delta: number) {
    this.cards.forEach((card) => {
      // Flight trajectory animation
      if (card.isFlying) {
        card.flightElapsed += delta;
        const rawProgress = card.flightElapsed / card.flightDuration;
        const progress = Math.min(1, rawProgress);
        card.currentFlightProgress = progress;

        // Smooth cubic ease out
        const ease = 1 - Math.pow(1 - progress, 3);

        // Bezier Arc with Elevation peak
        const x = THREE.MathUtils.lerp(card.flightStartPos.x, card.targetPos.x, ease);
        const z = THREE.MathUtils.lerp(card.flightStartPos.z, card.targetPos.z, ease);
        const arcY = Math.sin(progress * Math.PI) * 0.55; // 0.55 unit natural parabolic curve
        const y = THREE.MathUtils.lerp(card.flightStartPos.y, card.targetPos.y, ease) + arcY;

        card.mesh.position.set(x, y, z);

        // Banking tilt during flight
        card.mesh.rotation.z = THREE.MathUtils.lerp(
          card.flightStartRot.z,
          card.targetRot.z,
          ease
        );
        card.mesh.rotation.y = Math.sin(progress * Math.PI) * 0.35;

        if (progress >= 1) {
          card.isFlying = false;
          card.mesh.position.copy(card.targetPos);
          card.mesh.rotation.copy(card.targetRot);
        }
      }

      // 3D Flip animation
      if (card.isFlipping) {
        card.flipProgress += delta * 3.4; // ~300ms flip
        const p = Math.min(1, card.flipProgress);
        const ease = 1 - Math.pow(1 - p, 2);

        // Rotate 180 degrees around X to reveal face
        card.mesh.rotation.x = -Math.PI / 2 + ease * Math.PI;
        // Subtle hop during flip
        card.mesh.position.y = card.targetPos.y + Math.sin(p * Math.PI) * 0.12;

        if (p >= 1) {
          card.isFlipping = false;
          card.mesh.rotation.x = Math.PI / 2;
          card.mesh.position.y = card.targetPos.y;
        }
      }
    });
  }

  private updateDealerIdles(elapsedTime: number) {
    // Elena subtle breathing & head micro-sway
    const elenaBreath = Math.sin(elapsedTime * 1.8) * 0.02;
    this.elenaDealer.torso.position.y = elenaBreath;
    this.elenaDealer.head.rotation.y = Math.sin(elapsedTime * 0.8) * 0.04;
    this.elenaDealer.head.rotation.x = Math.sin(elapsedTime * 1.2) * 0.02;

    // Marcus subtle breathing & head micro-sway
    const marcusBreath = Math.cos(elapsedTime * 1.7) * 0.02;
    this.marcusDealer.torso.position.y = marcusBreath;
    this.marcusDealer.head.rotation.y = Math.cos(elapsedTime * 0.75) * 0.04;
    this.marcusDealer.head.rotation.x = Math.cos(elapsedTime * 1.1) * 0.02;

    // Blinking eye cycles
    const isBlinkingElena = Math.sin(elapsedTime * 3.5) > 0.985;
    this.elenaDealer.leftEye.scale.y = isBlinkingElena ? 0.1 : 1;
    this.elenaDealer.rightEye.scale.y = isBlinkingElena ? 0.1 : 1;

    const isBlinkingMarcus = Math.cos(elapsedTime * 3.1) > 0.985;
    this.marcusDealer.leftEye.scale.y = isBlinkingMarcus ? 0.1 : 1;
    this.marcusDealer.rightEye.scale.y = isBlinkingMarcus ? 0.1 : 1;
  }

  public handleResize() {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 300;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private render() {
    if (this.isDisposed) return;

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Shuffle State Progression
    if (this.isShuffling) {
      const elapsedShuffle = (now - this.shuffleStartTime) / 1000;
      this.shuffleProgress = Math.min(1, elapsedShuffle / this.shuffleDuration);

      this.updateShuffleAnimation(this.shuffleProgress);

      if (this.shuffleProgress >= 1) {
        this.isShuffling = false;
        this.state = 'IDLE';
        if (this.onShuffleCompleteCallback) {
          const cb = this.onShuffleCompleteCallback;
          this.onShuffleCompleteCallback = null;
          cb();
        }
      }
    }

    // 2. Card Flights & Flips
    this.updateCardFlights(delta);

    // 3. Human Dealer Breathing & Micro-Motions
    this.updateDealerIdles(elapsedTime);

    // 4. Render 3D Frame
    this.renderer.render(this.scene, this.camera);

    this.animationFrameId = requestAnimationFrame(this.render);
  }

  public resetRound() {
    this.cards.forEach((c) => {
      this.scene.remove(c.mesh);
    });
    this.cards.clear();
    this.leftShufflePacket.position.set(0, -10, 0);
    this.rightShufflePacket.position.set(0, -10, 0);
    this.shuffleRiffleLeaves.forEach((l) => l.position.set(0, -10, 0));
    this.state = 'IDLE';
  }

  public dispose() {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
