import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { feature as topojsonFeature, mesh as topojsonMesh } from 'topojson-client';
import countriesAtlas from 'world-atlas/countries-110m.json';
import { Compass, Pause, Play, ZoomIn, ZoomOut } from 'lucide-react';
import { JAKARTA_HUB_GEO } from '../data/worldCountryCoords';
import { ThemeMode } from '../types';

export interface GlobeCountryPoint {
  name: string;
  displayName: string;
  code: string;
  region: string;
  lat: number;
  lon: number;
  count: number;
  topCommodities: { name: string; count: number }[];
}

interface GlobeMap3DProps {
  mode: 'IMPOR' | 'EKSPOR';
  countries: GlobeCountryPoint[];
  hoveredCountry: string | null;
  focusedCountry: string | null;
  onHoverCountry: (name: string | null) => void;
  onSelectCountry?: (name: string) => void;
  themeMode?: ThemeMode;
}

// Module-level reusable math scratchpads (zero GC in animation loop)
const _vA = new THREE.Vector3();
const _vUp = new THREE.Vector3(0, 1, 0);
const _mouse = new THREE.Vector2();

// Cached parsed Natural Earth country polygons & border vertices
let cachedCountriesGeoJson: any = null;
let cachedBorderPositions: Float32Array | null = null;

function getParsedWorldAtlas() {
  if (!cachedCountriesGeoJson) {
    const atlas: any = countriesAtlas;
    cachedCountriesGeoJson = topojsonFeature(atlas, atlas.objects.countries);

    // Build crisp 3D border LineSegments directly from TopoJSON mesh
    const borderMesh: any = topojsonMesh(atlas, atlas.objects.countries);
    const pts: number[] = [];
    const lines: number[][][] =
      borderMesh.type === 'MultiLineString' ? borderMesh.coordinates : [borderMesh.coordinates];

    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();

    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [lon1, lat1] = line[i];
        const [lon2, lat2] = line[i + 1];
        // Skip antimeridian wrap lines
        if (Math.abs(lon1 - lon2) > 180) continue;
        latLonToVector3(lat1, lon1, 1.003, pA);
        latLonToVector3(lat2, lon2, 1.003, pB);
        pts.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      }
    }
    cachedBorderPositions = new Float32Array(pts);
  }
  return {
    countriesGeoJson: cachedCountriesGeoJson,
    borderPositions: cachedBorderPositions!,
  };
}

export function latLonToVector3(
  lat: number,
  lon: number,
  radius = 1,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) * Math.PI) / 180;
  const sinTheta = Math.sin(theta);
  return out.set(
    -radius * Math.cos(phi) * sinTheta,
    radius * Math.cos(theta),
    radius * Math.sin(phi) * sinTheta
  );
}

// Unwrap rings crossing ±180° longitude for clean equirectangular canvas rendering
function drawGeoPolygonRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  w: number,
  h: number,
  offsetLon = 0
) {
  if (ring.length === 0) return;
  let prevLon = ring[0][0] + offsetLon;
  ctx.moveTo(((prevLon + 180) / 360) * w, ((90 - ring[0][1]) / 180) * h);
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0] + offsetLon;
    const lat = ring[i][1];
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    ctx.lineTo(((lon + 180) / 360) * w, ((90 - lat) / 180) * h);
  }
}

function createProceduralWorldTextures(
  mode: 'IMPOR' | 'EKSPOR',
  themeMode: ThemeMode,
  maxAnisotropy: number
) {
  const { countriesGeoJson } = getParsedWorldAtlas();
  const isDay = themeMode === 'day';
  const isImpor = mode === 'IMPOR';

  const W = 2048;
  const H = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const ctx = colorCanvas.getContext('2d')!;

  // Roughness map (glossy oceans vs matte terrain)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 1024;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;

  // 1. Ocean Bathymetry Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
  if (isDay) {
    if (isImpor) {
      oceanGrad.addColorStop(0, '#0f3654');
      oceanGrad.addColorStop(0.5, '#134e6f');
      oceanGrad.addColorStop(1, '#0d2c46');
    } else {
      oceanGrad.addColorStop(0, '#0c2f59');
      oceanGrad.addColorStop(0.5, '#134a7e');
      oceanGrad.addColorStop(1, '#092446');
    }
  } else {
    oceanGrad.addColorStop(0, '#040c1d');
    oceanGrad.addColorStop(0.5, '#071732');
    oceanGrad.addColorStop(1, '#030a18');
  }
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, W, H);

  rCtx.fillStyle = '#383838'; // ~0.22 roughness for water specular
  rCtx.fillRect(0, 0, 1024, 512);

  // 2. Subtle Latitude / Longitude Graticule
  ctx.strokeStyle = isDay ? 'rgba(148, 210, 255, 0.14)' : 'rgba(56, 189, 248, 0.1)';
  ctx.lineWidth = 1;
  for (let lon = -165; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Highlight Equator
  ctx.strokeStyle = isImpor ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // 3. Draw Real Countries & Continents
  const defaultLandFill = isDay
    ? isImpor
      ? '#d1fae5'
      : '#e0f2fe'
    : isImpor
    ? '#132a2e'
    : '#11223a';
  const defaultLandStroke = isDay
    ? isImpor
      ? '#34d399'
      : '#38bdf8'
    : isImpor
    ? '#10b981'
    : '#0ea5e9';
  const idFill = isImpor ? '#10b981' : '#0ea5e9';

  for (const feat of countriesGeoJson.features) {
    const geom = feat.geometry;
    if (!geom) continue;
    const isIndonesia = String(feat.id) === '360' || feat.properties?.name === 'Indonesia';

    const drawPolygons = (polygons: number[][][][]) => {
      for (const poly of polygons) {
        for (const shift of [0, -360, 360]) {
          ctx.beginPath();
          poly.forEach((ring) => drawGeoPolygonRing(ctx, ring, W, H, shift));
          ctx.closePath();
          ctx.fillStyle = isIndonesia ? idFill : defaultLandFill;
          ctx.fill();
          ctx.strokeStyle = defaultLandStroke;
          ctx.lineWidth = isIndonesia ? 2.2 : 1.0;
          ctx.stroke();

          // Matte terrain roughness
          rCtx.beginPath();
          poly.forEach((ring) => drawGeoPolygonRing(rCtx, ring, 1024, 512, shift));
          rCtx.closePath();
          rCtx.fillStyle = '#b8b8b8'; // ~0.72 roughness for land
          rCtx.fill();
        }
      }
    };

    if (geom.type === 'Polygon') {
      drawPolygons([geom.coordinates]);
    } else if (geom.type === 'MultiPolygon') {
      drawPolygons(geom.coordinates);
    }
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.anisotropy = Math.min(maxAnisotropy, 8);
  colorTexture.needsUpdate = true;

  const roughnessTexture = new THREE.CanvasTexture(roughCanvas);
  roughnessTexture.anisotropy = Math.min(maxAnisotropy, 4);
  roughnessTexture.needsUpdate = true;

  return { colorTexture, roughnessTexture };
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const GlobeMap3D: React.FC<GlobeMap3DProps> = ({
  mode,
  countries,
  hoveredCountry,
  focusedCountry,
  onHoverCountry,
  onSelectCountry,
  themeMode = 'night' as ThemeMode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [tooltipData, setTooltipData] = useState<GlobeCountryPoint | null>(null);

  // Live mutable refs so state updates never tear down the WebGL context
  const hoveredRef = useRef<string | null>(hoveredCountry);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const onHoverRef = useRef(onHoverCountry);
  const onSelectRef = useRef(onSelectCountry);
  const flyTargetRef = useRef<THREE.Vector3 | null>(null);
  const zoomDeltaRef = useRef<number>(0);

  hoveredRef.current = hoveredCountry;
  autoRotateRef.current = autoRotate;
  onHoverRef.current = onHoverCountry;
  onSelectRef.current = onSelectCountry;

  // Update tooltip when hoveredCountry changes externally (from cards below map)
  useEffect(() => {
    if (!hoveredCountry) {
      setTooltipData(null);
      return;
    }
    const found = countries.find((c) => c.name === hoveredCountry);
    setTooltipData(found || null);
  }, [hoveredCountry, countries]);

  // Smooth camera fly-to when a country is focused via click
  useEffect(() => {
    if (!focusedCountry) return;
    if (focusedCountry === 'INDONESIA') {
      flyTargetRef.current = latLonToVector3(JAKARTA_HUB_GEO.lat, JAKARTA_HUB_GEO.lon, 2.72);
      return;
    }
    const target = countries.find((c) => c.name === focusedCountry);
    if (target) {
      flyTargetRef.current = latLonToVector3(target.lat, target.lon, 2.65);
    }
  }, [focusedCountry, countries]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const resolvedTheme: ThemeMode = themeMode === 'day' ? 'day' : 'night';
    const isDay = resolvedTheme === 'day';
    const isImpor = mode === 'IMPOR';
    const accentHex = isImpor ? 0x10b981 : 0x38bdf8;
    const accentSecondaryHex = isImpor ? 0x34d399 : 0x0ea5e9;
    const isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 260);

    // 1. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDay ? 1.15 : 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene & Studio Environment Reflection
    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 3. Camera facing Indonesia Hub at startup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 40);
    const initialCamPos = latLonToVector3(
      isImpor ? 4 : -2,
      isImpor ? 98 : 108,
      2.75
    );
    camera.position.copy(initialCamPos);
    camera.lookAt(0, 0, 0);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 1.65;
    controls.maxDistance = 4.6;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.8;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.autoRotate = !isSoftwareGl && autoRotateRef.current;
    controls.autoRotateSpeed = 0.45;

    const onControlStart = () => {
      // Stop scripted fly-to if user grabs the globe
      flyTargetRef.current = null;
    };
    controls.addEventListener('start', onControlStart);

    // 5. Studio 3-Point Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      isDay ? 0xe0f2fe : 0x7dd3fc,
      isDay ? 0x1e293b : 0x090d1a,
      isDay ? 1.15 : 0.9
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, isDay ? 1.85 : 1.55);
    keyLight.position.set(5, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(accentHex, isDay ? 0.95 : 1.35);
    rimLight.position.set(-5, 2, -4);
    scene.add(rimLight);

    // 6. Tracked disposables
    const disposables: Array<{ dispose: () => void }> = [];
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // 7. Procedural Textured 3D Globe Sphere
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { colorTexture, roughnessTexture } = createProceduralWorldTextures(
      mode,
      resolvedTheme,
      maxAniso
    );
    disposables.push(colorTexture, roughnessTexture);

    const globeGeom = new THREE.SphereGeometry(1, 56, 40);
    const globeMat = new THREE.MeshStandardMaterial({
      map: colorTexture,
      roughnessMap: roughnessTexture,
      roughness: 0.72,
      metalness: 0.18,
      envMapIntensity: isDay ? 0.75 : 0.9,
    });
    const globeMesh = new THREE.Mesh(globeGeom, globeMat);
    globeGroup.add(globeMesh);
    disposables.push(globeGeom, globeMat);

    // 8. 3D Vector Coastlines & Country Borders Mesh (LineSegments)
    const { borderPositions } = getParsedWorldAtlas();
    const borderGeom = new THREE.BufferGeometry();
    borderGeom.setAttribute('position', new THREE.BufferAttribute(borderPositions, 3));
    const borderMat = new THREE.LineBasicMaterial({
      color: isDay ? (isImpor ? 0x059669 : 0x0284c7) : accentSecondaryHex,
      transparent: true,
      opacity: isDay ? 0.45 : 0.42,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const borderLines = new THREE.LineSegments(borderGeom, borderMat);
    globeGroup.add(borderLines);
    disposables.push(borderGeom, borderMat);

    // 9. Atmospheric Fresnel Halo Shell
    const atmosGeom = new THREE.SphereGeometry(1.085, 48, 32);
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(accentHex) },
        uIntensity: { value: isDay ? 0.55 : 0.78 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 uColor;
        uniform float uIntensity;
        void main() {
          float fresnel = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
          gl_FragColor = vec4(uColor, clamp(fresnel * uIntensity, 0.0, 0.65));
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeom, atmosMat);
    globeGroup.add(atmosMesh);
    disposables.push(atmosGeom, atmosMat);

    // 10. Subtle Orbital Telemetry Ring around Globe
    const orbitRingGeom = new THREE.RingGeometry(1.19, 1.202, 96);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: isDay ? 0.2 : 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const orbitRing = new THREE.Mesh(orbitRingGeom, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2 - 0.12;
    orbitRing.rotation.y = 0.25;
    globeGroup.add(orbitRing);
    disposables.push(orbitRingGeom, orbitRingMat);

    // 11. Multi-Part 3D Jakarta Hub Beacon (4 distinct parts)
    const hubPos = latLonToVector3(JAKARTA_HUB_GEO.lat, JAKARTA_HUB_GEO.lon, 1.0);
    const hubNormal = hubPos.clone().normalize();
    const hubGroup = new THREE.Group();
    hubGroup.position.copy(hubPos);
    hubGroup.quaternion.setFromUnitVectors(_vUp, hubNormal);
    globeGroup.add(hubGroup);

    const hubBaseGeom = new THREE.RingGeometry(0.022, 0.044, 32);
    const hubBaseMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const hubBaseMesh = new THREE.Mesh(hubBaseGeom, hubBaseMat);
    hubBaseMesh.rotation.x = -Math.PI / 2;
    hubBaseMesh.position.y = 0.004;
    hubGroup.add(hubBaseMesh);
    disposables.push(hubBaseGeom, hubBaseMat);

    const hubCollarGeom = new THREE.TorusGeometry(0.026, 0.005, 12, 24);
    const hubCollarMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      metalness: 0.9,
      roughness: 0.2,
    });
    const hubCollarMesh = new THREE.Mesh(hubCollarGeom, hubCollarMat);
    hubCollarMesh.rotation.x = Math.PI / 2;
    hubCollarMesh.position.y = 0.008;
    hubGroup.add(hubCollarMesh);
    disposables.push(hubCollarGeom, hubCollarMat);

    const hubSpireGeom = new THREE.CylinderGeometry(0.006, 0.014, 0.14, 16);
    const hubSpireMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.8,
      metalness: 0.35,
      roughness: 0.25,
    });
    const hubSpireMesh = new THREE.Mesh(hubSpireGeom, hubSpireMat);
    hubSpireMesh.position.y = 0.072;
    hubGroup.add(hubSpireMesh);
    disposables.push(hubSpireGeom, hubSpireMat);

    const hubGemGeom = new THREE.OctahedronGeometry(0.024, 0);
    const hubGemMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: accentHex,
      emissiveIntensity: 1.2,
      roughness: 0.15,
      metalness: 0.65,
    });
    const hubGemMesh = new THREE.Mesh(hubGemGeom, hubGemMat);
    hubGemMesh.position.y = 0.155;
    hubGroup.add(hubGemMesh);
    disposables.push(hubGemGeom, hubGemMat);

    const hubPulseGeom = new THREE.RingGeometry(0.03, 0.038, 32);
    const hubPulseMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const hubPulseMesh = new THREE.Mesh(hubPulseGeom, hubPulseMat);
    hubPulseMesh.rotation.x = -Math.PI / 2;
    hubPulseMesh.position.y = 0.006;
    hubGroup.add(hubPulseMesh);
    disposables.push(hubPulseGeom, hubPulseMat);

    // 12. 3D Country Beacons & Great-Circle Trade Arcs
    const activeCountries = countries
      .filter((c) => c.code !== 'ID')
      .slice(0, 28);
    const maxCount = Math.max(1, ...activeCountries.map((c) => c.count));

    interface CountryVisualHandle {
      data: GlobeCountryPoint;
      pillarMat: THREE.MeshStandardMaterial;
      tipMat: THREE.MeshStandardMaterial;
      ringMat: THREE.MeshBasicMaterial;
      tubeMat?: THREE.MeshBasicMaterial;
      group: THREE.Group;
    }

    const countryHandles: CountryVisualHandle[] = [];
    const clickableProxies: THREE.Object3D[] = [];
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);

    interface AnimatedCargo {
      mesh: THREE.Mesh;
      curve: THREE.CatmullRomCurve3;
      speed: number;
      offset: number;
    }
    const cargoPulses: AnimatedCargo[] = [];

    // Shared geometries for pillars/tips/rings/cargo
    const baseRingGeom = new THREE.RingGeometry(0.015, 0.026, 20);
    const tipSphereGeom = new THREE.SphereGeometry(0.016, 14, 14);
    const hitProxyGeom = new THREE.SphereGeometry(0.055, 10, 10);
    const cargoGeom = new THREE.SphereGeometry(0.012, 10, 10);
    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const cargoMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    disposables.push(baseRingGeom, tipSphereGeom, hitProxyGeom, cargoGeom, hitProxyMat, cargoMat);

    activeCountries.forEach((country, idx) => {
      const surfacePos = latLonToVector3(country.lat, country.lon, 1.0);
      const normal = surfacePos.clone().normalize();
      const pillarHeight = 0.045 + 0.16 * (Math.sqrt(country.count) / Math.sqrt(maxCount));

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(surfacePos);
      nodeGroup.quaternion.setFromUnitVectors(_vUp, normal);
      globeGroup.add(nodeGroup);

      // Ring
      const ringMat = new THREE.MeshBasicMaterial({
        color: accentSecondaryHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      });
      const ringMesh = new THREE.Mesh(baseRingGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.004;
      nodeGroup.add(ringMesh);
      disposables.push(ringMat);

      // 3D Pillar
      const pillarGeom = new THREE.CylinderGeometry(0.006, 0.011, pillarHeight, 12);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: accentSecondaryHex,
        emissive: accentHex,
        emissiveIntensity: 0.45,
        metalness: 0.3,
        roughness: 0.35,
      });
      const pillarMesh = new THREE.Mesh(pillarGeom, pillarMat);
      pillarMesh.position.y = pillarHeight / 2;
      nodeGroup.add(pillarMesh);
      disposables.push(pillarGeom, pillarMat);

      // Tip Sphere
      const tipMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: accentHex,
        emissiveIntensity: 0.85,
        metalness: 0.2,
        roughness: 0.2,
      });
      const tipMesh = new THREE.Mesh(tipSphereGeom, tipMat);
      tipMesh.position.y = pillarHeight + 0.008;
      nodeGroup.add(tipMesh);
      disposables.push(tipMat);

      // Invisible Raycast Proxy on Layer 1
      const proxy = new THREE.Mesh(hitProxyGeom, hitProxyMat);
      proxy.position.y = pillarHeight * 0.65;
      proxy.layers.set(1);
      proxy.userData.countryPoint = country;
      nodeGroup.add(proxy);
      clickableProxies.push(proxy);

      const handle: CountryVisualHandle = {
        data: country,
        pillarMat,
        tipMat,
        ringMat,
        group: nodeGroup,
      };

      // Top 14 Trade Corridors get 3D Great-Circle Tube Arcs + Animated Cargo Pulses
      if (idx < 14) {
        const startVec = (isImpor ? surfacePos : hubPos).clone();
        const endVec = (isImpor ? hubPos : surfacePos).clone();
        const dirA = startVec.clone().normalize();
        const dirB = endVec.clone().normalize();
        const angle = dirA.angleTo(dirB);
        const arcPeak = 0.08 + 0.34 * (angle / Math.PI);

        const arcPoints: THREE.Vector3[] = [];
        const steps = 28;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          // Great circle slerp-like interpolation
          const interp = new THREE.Vector3().lerpVectors(dirA, dirB, t).normalize();
          const alt = 1.006 + arcPeak * Math.sin(Math.PI * t);
          arcPoints.push(interp.multiplyScalar(alt));
        }

        const curve = new THREE.CatmullRomCurve3(arcPoints);
        const tubeRadius = idx < 4 ? 0.0055 : 0.0036;
        const tubeGeom = new THREE.TubeGeometry(curve, 36, tubeRadius, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: idx < 4 ? accentHex : accentSecondaryHex,
          transparent: true,
          opacity: idx < 4 ? 0.62 : 0.36,
        });
        const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
        globeGroup.add(tubeMesh);
        disposables.push(tubeGeom, tubeMat);
        handle.tubeMat = tubeMat;

        // Animated Cargo Pulses (2 per major route, 1 for secondary)
        const pulseCount = idx < 5 ? 2 : 1;
        for (let p = 0; p < pulseCount; p++) {
          const cargoMesh = new THREE.Mesh(cargoGeom, cargoMat);
          globeGroup.add(cargoMesh);
          cargoPulses.push({
            mesh: cargoMesh,
            curve,
            speed: 0.22 + (idx % 4) * 0.035,
            offset: (idx * 0.17 + p * 0.5) % 1,
          });
        }
      }

      countryHandles.push(handle);
    });

    // 13. Pre-warm Shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 14. Pointer Raycasting (throttled ~40ms) & Click Focus
    let lastRaycast = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastRaycast < 40) return;
      lastRaycast = now;

      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(clickableProxies, false);
      if (hits.length > 0) {
        const pt = hits[0].object.userData.countryPoint as GlobeCountryPoint;
        renderer.domElement.style.cursor = 'pointer';
        if (hoveredRef.current !== pt.name) {
          onHoverRef.current(pt.name);
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
        if (hoveredRef.current !== null) {
          onHoverRef.current(null);
        }
      }
    };

    let pointerDownPos = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Was a drag, not a click
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(clickableProxies, false);
      if (hits.length > 0) {
        const pt = hits[0].object.userData.countryPoint as GlobeCountryPoint;
        flyTargetRef.current = latLonToVector3(pt.lat, pt.lon, 2.62);
        onHoverRef.current(pt.name);
        onSelectRef.current?.(pt.name);
      }
    };

    const onPointerLeave = () => {
      renderer.domElement.style.cursor = 'grab';
      if (hoveredRef.current !== null) {
        onHoverRef.current(null);
      }
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    // 15. ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 280);
        const h = Math.max(entry.contentRect.height, 240);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // 16. Animation Loop (Software-WebGL paced with afterDraw)
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Update zoom button requests
      if (zoomDeltaRef.current !== 0) {
        const dist = camera.position.length();
        const nextDist = THREE.MathUtils.clamp(dist + zoomDeltaRef.current, 1.65, 4.6);
        camera.position.setLength(nextDist);
        zoomDeltaRef.current = 0;
      }

      // Smooth damped camera fly-to target
      if (flyTargetRef.current) {
        const dampLambda = 4.5;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          flyTargetRef.current.x,
          dampLambda,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          flyTargetRef.current.y,
          dampLambda,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          flyTargetRef.current.z,
          dampLambda,
          delta
        );
        camera.position.setLength(
          THREE.MathUtils.clamp(camera.position.length(), 2.2, 3.2)
        );
        if (camera.position.distanceTo(flyTargetRef.current) < 0.04) {
          flyTargetRef.current = null;
        }
      }

      // Pause auto-rotation when hovering a node or flying to a target
      controls.autoRotate =
        !isSoftwareGl &&
        autoRotateRef.current &&
        !hoveredRef.current &&
        !flyTargetRef.current;
      controls.update();

      // Hub crystal spin + beacon ring pulse
      hubGemMesh.rotation.y += delta * 1.4;
      const pulsePhase = (elapsed * 0.7) % 1;
      const pulseScale = 1 + pulsePhase * 2.2;
      hubPulseMesh.scale.set(pulseScale, pulseScale, 1);
      hubPulseMat.opacity = (1 - pulsePhase) * 0.7;

      // Update Cargo Beads along 3D Great-Circle Curves
      for (let i = 0; i < cargoPulses.length; i++) {
        const p = cargoPulses[i];
        const t = (elapsed * p.speed + p.offset) % 1;
        p.curve.getPointAt(t, _vA);
        p.mesh.position.copy(_vA);
      }

      // Highlight Hovered Country smoothly
      const activeHover = hoveredRef.current;
      for (let i = 0; i < countryHandles.length; i++) {
        const h = countryHandles[i];
        const isHit = activeHover === h.data.name;
        const targetScale = isHit ? 1.38 : 1.0;
        const curScale = THREE.MathUtils.damp(h.group.scale.x, targetScale, 10, delta);
        h.group.scale.set(curScale, curScale, curScale);
        h.pillarMat.emissiveIntensity = isHit ? 1.4 : 0.45;
        h.tipMat.emissiveIntensity = isHit ? 1.8 : 0.85;
        h.ringMat.opacity = isHit ? 1.0 : 0.7;
        if (h.tubeMat) {
          h.tubeMat.opacity = isHit ? 0.95 : activeHover ? 0.2 : 0.55;
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      disposables.forEach((d) => d.dispose());
      envTarget.dispose();
      renderer.dispose();
    };
  }, [mode, countries, themeMode]);

  const isDay = themeMode === 'day';
  const isImpor = mode === 'IMPOR';
  const accentText = isImpor
    ? isDay
      ? 'text-emerald-700'
      : 'text-emerald-300'
    : isDay
    ? 'text-sky-700'
    : 'text-sky-300';

  return (
    <div
      className="relative w-full h-72 sm:h-80 my-3 rounded-2xl overflow-hidden border border-white/70 dark:border-white/10 shadow-inner select-none"
      style={{
        background: isDay
          ? isImpor
            ? 'radial-gradient(circle at 50% 45%, #e0f2fe 0%, #cffafe 55%, #dbeafe 100%)'
            : 'radial-gradient(circle at 50% 45%, #e0f2fe 0%, #dbeafe 55%, #e0e7ff 100%)'
          : 'radial-gradient(circle at 50% 45%, #0b1936 0%, #050c1d 65%, #020617 100%)',
      }}
    >
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top-Left Direction Indicator (solid/rgba surface, no backdrop-filter over WebGL) */}
      <div
        className="absolute top-2.5 left-2.5 pointer-events-none px-2.5 py-1 rounded-lg border text-[10px] font-extrabold tracking-wide uppercase flex items-center space-x-1.5"
        style={{
          backgroundColor: isDay ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.82)',
          borderColor: isDay ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.14)',
        }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: isImpor ? '#10b981' : '#38bdf8' }}
        />
        <span className={accentText}>
          Globe 3D • {isImpor ? 'Arus Masuk Impor' : 'Arus Keluar Ekspor'}
        </span>
      </div>

      {/* Top-Right Compact 3D Camera Controls */}
      <div
        className="absolute top-2.5 right-2.5 flex items-center space-x-1 p-1 rounded-xl border"
        style={{
          backgroundColor: isDay ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.82)',
          borderColor: isDay ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.14)',
        }}
      >
        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          title={autoRotate ? 'Jeda Rotasi Globe' : 'Putar Globe Otomatis'}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
        >
          {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            flyTargetRef.current = latLonToVector3(
              JAKARTA_HUB_GEO.lat,
              JAKARTA_HUB_GEO.lon,
              2.68
            );
          }}
          title="Fokus ke Indonesia (BBKHIT DKI Jakarta)"
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
        >
          <Compass className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            zoomDeltaRef.current = -0.35;
          }}
          title="Perbesar Globe"
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            zoomDeltaRef.current = 0.35;
          }}
          title="Perkecil Globe"
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hovered Country Info Card */}
      {tooltipData && (
        <div
          className="absolute bottom-9 right-2.5 max-w-[240px] pointer-events-none px-3 py-2 rounded-xl border shadow-lg text-xs"
          style={{
            backgroundColor: isDay ? 'rgba(255, 255, 255, 0.94)' : 'rgba(9, 15, 32, 0.9)',
            borderColor: isImpor ? 'rgba(16, 185, 129, 0.45)' : 'rgba(56, 189, 248, 0.45)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-slate-900 dark:text-white truncate">
              {tooltipData.displayName}
            </span>
            <span className={`text-[10px] font-extrabold tabular-nums shrink-0 ${accentText}`}>
              {tooltipData.count.toLocaleString('id-ID')} Dok
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Kawasan: {tooltipData.region} ({tooltipData.code})
          </p>
          {tooltipData.topCommodities.length > 0 && (
            <p className="text-[10px] text-slate-700 dark:text-slate-200 mt-1 line-clamp-2 font-medium">
              Komoditas: {tooltipData.topCommodities.map((k) => k.name).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Bottom Telemetry Strip */}
      <div
        className="absolute bottom-2 left-2.5 pointer-events-none text-[9px] font-mono px-2 py-0.5 rounded-md border"
        style={{
          backgroundColor: isDay ? 'rgba(255, 255, 255, 0.85)' : 'rgba(15, 23, 42, 0.8)',
          borderColor: isDay ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.12)',
          color: isDay ? '#334155' : '#cbd5e1',
        }}
      >
        HUB: 6.10°S, 106.88°E • SERET PUTAR 3D • SCROLL ZOOM
      </div>
    </div>
  );
};
