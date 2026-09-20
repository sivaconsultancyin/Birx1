import * as THREE from 'three';
import { Card as GameCard } from '../../types.ts';

// Cache generated textures so we don't recreate them every frame
const textureCache = new Map<string, THREE.CanvasTexture>();
let sharedBackTexture: THREE.CanvasTexture | null = null;

/**
 * Creates a high-resolution canvas texture for the back of a luxury casino card
 */
export function getCardBackTexture(): THREE.CanvasTexture {
  if (sharedBackTexture) return sharedBackTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 716;
  const ctx = canvas.getContext('2d')!;

  // Background deep crimson red gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 716);
  grad.addColorStop(0, '#85121f');
  grad.addColorStop(0.5, '#4a0710');
  grad.addColorStop(1, '#1b0206');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 716);

  // Outer Gold Margin
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, 512 - 36, 716 - 36);

  // Inner White/Gold Hairline
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 32, 512 - 64, 716 - 64);

  // Guilloche lattice pattern
  ctx.save();
  ctx.beginPath();
  ctx.rect(36, 36, 512 - 72, 716 - 72);
  ctx.clip();

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
  ctx.lineWidth = 1.5;
  const step = 20;
  for (let x = -716; x < 512 + 716; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 716, 716);
    ctx.moveTo(x, 716);
    ctx.lineTo(x + 716, 0);
  }
  ctx.stroke();
  ctx.restore();

  // Center Medallion
  ctx.fillStyle = '#2b0409';
  ctx.beginPath();
  ctx.ellipse(256, 358, 100, 140, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Gold Spade Emblem in Center
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 96px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♠', 256, 350);

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 24px sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('ROYAL VIP', 256, 440);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  sharedBackTexture = texture;
  return texture;
}

/**
 * Creates a high-resolution canvas texture for the face of a playing card
 */
export function getCardFaceTexture(suit: string, rank: string): THREE.CanvasTexture {
  const key = `${rank}_${suit}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 716;
  const ctx = canvas.getContext('2d')!;

  // Crisp Ivory White Card Face with Subtle Radial Vignette
  const bgGrad = ctx.createRadialGradient(256, 358, 50, 256, 358, 420);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.85, '#faf7f2');
  bgGrad.addColorStop(1, '#eee7da');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 716);

  // Subtle Border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, 512 - 32, 716 - 32);

  const isRed = suit === 'H' || suit === 'D' || suit === 'hearts' || suit === 'diamonds';
  const color = isRed ? '#dc2626' : '#111827';

  let symbol = '♠';
  if (suit === 'H' || suit === 'hearts') symbol = '♥';
  if (suit === 'D' || suit === 'diamonds') symbol = '♦';
  if (suit === 'C' || suit === 'clubs') symbol = '♣';

  ctx.fillStyle = color;

  // Top Left Index
  ctx.font = 'bold 72px "Cinzel", "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText(rank, 65, 85);
  ctx.font = '54px sans-serif';
  ctx.fillText(symbol, 65, 140);

  // Bottom Right Inverted Index
  ctx.save();
  ctx.translate(512 - 65, 716 - 85);
  ctx.rotate(Math.PI);
  ctx.font = 'bold 72px "Cinzel", "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText(rank, 0, 0);
  ctx.font = '54px sans-serif';
  ctx.fillText(symbol, 0, 55);
  ctx.restore();

  // Center Court / Pip Artwork
  const isFaceCard = ['J', 'Q', 'K'].includes(rank);
  if (isFaceCard) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(120, 150, 512 - 240, 716 - 300);

    ctx.font = '120px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rank, 256, 310);
    ctx.font = '90px sans-serif';
    ctx.fillText(symbol, 256, 420);
  } else if (rank === 'A') {
    ctx.font = '220px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 256, 358);
  } else {
    // Number card center pips
    ctx.font = '110px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 256, 358);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textureCache.set(key, texture);
  return texture;
}

export interface ThreeCardObject {
  mesh: THREE.Mesh;
  suit: string;
  rank: string;
  isFaceUp: boolean;
  targetPos: THREE.Vector3;
  targetRot: THREE.Euler;
  currentFlightProgress: number; // 0 to 1
  flightDuration: number;
  flightElapsed: number;
  flightStartPos: THREE.Vector3;
  flightStartRot: THREE.Euler;
  isFlying: boolean;
  isFlipping: boolean;
  flipProgress: number;
}

/**
 * Creates a physical 3D playing card mesh with realistic rounded proportions
 */
export function create3DPlayingCard(suit: string, rank: string): ThreeCardObject {
  // Card dimensions: width 1.3, height 1.82, depth 0.012
  const width = 1.3;
  const height = 1.82;
  const depth = 0.01;

  const geometry = new THREE.BoxGeometry(width, height, depth);

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f2eb,
    roughness: 0.6,
    metalness: 0.05
  });

  const faceTexture = getCardFaceTexture(suit, rank);
  const backTexture = getCardBackTexture();

  const faceMaterial = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.35,
    metalness: 0.08
  });

  const backMaterial = new THREE.MeshStandardMaterial({
    map: backTexture,
    roughness: 0.35,
    metalness: 0.15
  });

  // BoxGeometry order: [+X, -X, +Y, -Y, +Z (Face), -Z (Back)]
  const materials: THREE.Material[] = [
    edgeMaterial, // right edge
    edgeMaterial, // left edge
    edgeMaterial, // top edge
    edgeMaterial, // bottom edge
    faceMaterial, // front face (+Z)
    backMaterial  // back face (-Z)
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Face down initially: rotated by Math.PI around Y or X
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = 0;

  return {
    mesh,
    suit,
    rank,
    isFaceUp: false,
    targetPos: new THREE.Vector3(),
    targetRot: new THREE.Euler(),
    currentFlightProgress: 1,
    flightDuration: 0.45,
    flightElapsed: 0,
    flightStartPos: new THREE.Vector3(),
    flightStartRot: new THREE.Euler(),
    isFlying: false,
    isFlipping: false,
    flipProgress: 1
  };
}
