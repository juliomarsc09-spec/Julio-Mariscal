import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { feature as topojsonFeature, mesh as topojsonMesh } from 'topojson-client';
import countriesAtlas from 'world-atlas/countries-110m.json';
import { Compass, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { JAKARTA_HUB_GEO } from '../data/worldCountryCoords';
import { ThemeMode } from '../types';

export interface MapCountryPoint {
  name: string;
  displayName: string;
  code: string;
  region: string;
  lat: number;
  lon: number;
  count: number;
  topCommodities: { name: string; count: number }[];
}

interface ConventionalMap3DProps {
  mode: 'IMPOR' | 'EKSPOR';
  countries: MapCountryPoint[];
  hoveredCountry: string | null;
  focusedCountry: string | null;
  focusSeq?: number;
  onHoverCountry: (name: string | null) => void;
  onSelectCountry?: (name: string) => void;
  themeMode?: ThemeMode;
}

const MAP_W = 8.4;
const MAP_D = 4.2;
const BORDER_PAD_W = 0.14;
const BORDER_PAD_D = 0.14;
const MAP_FOV = 34;
const LAND_SURFACE_Y = 0.046;
const HUB_SURFACE_Y = 0.072;

function computeFitDistance(containerW: number, containerH: number): number {
  const aspect = Math.max(containerW / Math.max(containerH, 1), 0.5);
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad(MAP_FOV / 2));
  const halfOuterW = (MAP_W + BORDER_PAD_W) / 2;
  const halfOuterD = (MAP_D + BORDER_PAD_D) / 2;
  const pad = 1.03;
  const dH = (halfOuterD * pad) / tanHalfV;
  const dW = (halfOuterW * pad) / (aspect * tanHalfV);
  return Math.max(dH, dW);
}

// Module-level reusable math scratchpads (zero GC in animation loop)
const _vA = new THREE.Vector3();
const _mouse = new THREE.Vector2();
const _tmpColor = new THREE.Color();

interface CachedCountryPart {
  atlasId: string;
  atlasName: string;
  isIndonesia: boolean;
  geometries: THREE.BufferGeometry[];
}

let cachedCountriesGeoJson: any = null;
let cachedBorderPositions: Float32Array | null = null;
let cachedCountryParts: CachedCountryPart[] | null = null;
let cachedIndonesiaLandGeom: THREE.BufferGeometry | null = null;

// ISO Alpha-2 -> world-atlas/countries-110m.json numeric ID mapping
const ISO2_TO_ATLAS_ID: Record<string, string> = {
  AF: '004', AL: '008', DZ: '012', AO: '024', AR: '032', AM: '051', AU: '036', AT: '040',
  AZ: '031', BS: '044', BD: '050', BY: '112', BE: '056', BZ: '084', BJ: '204', BT: '064',
  BO: '068', BA: '070', BW: '072', BR: '076', BN: '096', BG: '100', BF: '854', BI: '108',
  KH: '116', CM: '120', CA: '124', CF: '140', TD: '148', CL: '152', CN: '156', CO: '170',
  CG: '178', CD: '180', CR: '188', CI: '384', HR: '191', CU: '192', CY: '196', CZ: '203',
  DK: '208', DJ: '262', DO: '214', EC: '218', EG: '818', SV: '222', GQ: '226', ER: '232',
  EE: '233', ET: '231', FJ: '242', FI: '246', FR: '250', GA: '266', GM: '270', GE: '268',
  DE: '276', GH: '288', GR: '300', GL: '304', GT: '320', GN: '324', GW: '624', GY: '328',
  HT: '332', HN: '340', HU: '348', IS: '352', IN: '356', ID: '360', IR: '364', IQ: '368',
  IE: '372', IL: '376', IT: '380', JM: '388', JP: '392', JO: '400', KZ: '398', KE: '404',
  KP: '408', KR: '410', KW: '414', KG: '417', LA: '418', LV: '428', LB: '422', LS: '426',
  LR: '430', LY: '434', LT: '440', LU: '442', MG: '450', MW: '454', MY: '458', ML: '466',
  MR: '478', MX: '484', MD: '498', MN: '496', ME: '499', MA: '504', MZ: '508', MM: '104',
  NA: '516', NP: '524', NL: '528', NC: '540', NZ: '554', NI: '558', NE: '562', NG: '566',
  MK: '807', NO: '578', OM: '512', PK: '586', PS: '275', PA: '591', PG: '598', PY: '600',
  PE: '604', PH: '608', PL: '616', PT: '620', PR: '630', QA: '634', RO: '642', RU: '643',
  RW: '646', SA: '682', SN: '686', RS: '688', SL: '694', SK: '703', SI: '705', SB: '090',
  SO: '706', ZA: '710', SS: '728', ES: '724', LK: '144', SD: '729', SR: '740', SZ: '748',
  SE: '752', CH: '756', SY: '760', TW: '158', TJ: '762', TZ: '834', TH: '764', TL: '626',
  TG: '768', TT: '780', TN: '788', TR: '792', TM: '795', UG: '800', UA: '804', AE: '784',
  GB: '826', US: '840', UY: '858', UZ: '860', VU: '548', VE: '862', VN: '704', YE: '887',
  ZM: '894', ZW: '716',
};

function computeTrafficChoroplethColor(
  count: number,
  maxCount: number,
  isDay: boolean,
  outColor: THREE.Color
): THREE.Color {
  if (count <= 0 || maxCount <= 0) {
    return outColor.set(isDay ? '#dbe4f0' : '#1b283f');
  }

  // Sqrt normalization spreads mid-volume partners clearly across the palette
  const ratio = THREE.MathUtils.clamp(Math.sqrt(count / maxCount), 0, 1);

  if (ratio < 0.25) {
    // Low traffic: Sky/Teal
    const c1 = new THREE.Color(isDay ? '#7dd3fc' : '#0c4a6e');
    const c2 = new THREE.Color(isDay ? '#2dd4bf' : '#0f766e');
    return outColor.copy(c1).lerp(c2, ratio / 0.25);
  }
  if (ratio < 0.55) {
    // Moderate traffic: Emerald-Yellow / Warm Gold
    const c1 = new THREE.Color(isDay ? '#2dd4bf' : '#0f766e');
    const c2 = new THREE.Color('#f59e0b');
    return outColor.copy(c1).lerp(c2, (ratio - 0.25) / 0.3);
  }
  if (ratio < 0.8) {
    // High traffic: Amber -> Vivid Orange
    const c1 = new THREE.Color('#f59e0b');
    const c2 = new THREE.Color('#f97316');
    return outColor.copy(c1).lerp(c2, (ratio - 0.55) / 0.25);
  }
  // Peak traffic: Vivid Orange -> Crimson Red
  const c1 = new THREE.Color('#f97316');
  const c2 = new THREE.Color('#ef4444');
  return outColor.copy(c1).lerp(c2, (ratio - 0.8) / 0.2);
}

function buildTrafficLookup(countries: MapCountryPoint[]) {
  const byAtlasId = new Map<string, MapCountryPoint>();
  const byName = new Map<string, MapCountryPoint>();

  countries.forEach((c) => {
    const code = (c.code || '').toUpperCase();
    const atlasId = ISO2_TO_ATLAS_ID[code];
    if (atlasId) {
      const existing = byAtlasId.get(atlasId);
      if (!existing || c.count > existing.count) {
        byAtlasId.set(atlasId, c);
      }
    }
    const cleanName = (c.name || '').trim().toUpperCase();
    const cleanDisp = (c.displayName || '').trim().toUpperCase();
    if (cleanName) byName.set(cleanName, c);
    if (cleanDisp) byName.set(cleanDisp, c);
  });

  const matchFeature = (atlasId: string, atlasName: string): MapCountryPoint | undefined => {
    if (atlasId && byAtlasId.has(atlasId)) return byAtlasId.get(atlasId);
    const upper = atlasName.trim().toUpperCase();
    if (!upper) return undefined;
    if (byName.has(upper)) return byName.get(upper);
    return undefined;
  };

  return { matchFeature };
}

export function latLonToMapPos(
  lat: number,
  lon: number,
  y = LAND_SURFACE_Y,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const clampedLon = THREE.MathUtils.clamp(lon, -180, 180);
  const clampedLat = THREE.MathUtils.clamp(lat, -64, 84);
  const x = (clampedLon / 180) * (MAP_W / 2);
  const z = (-clampedLat / 90) * (MAP_D / 2);
  return out.set(x, y, z);
}

function buildUnwrappedShapePoints(ring: number[][]): THREE.Vector2[] {
  if (ring.length < 3) return [];
  const pts: THREE.Vector2[] = [];
  let prevLon = ring[0][0];

  for (let i = 0; i < ring.length; i++) {
    let lon = ring[i][0];
    const lat = THREE.MathUtils.clamp(ring[i][1], -62, 83);
    if (i > 0) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    prevLon = lon;
    const clampedLon = THREE.MathUtils.clamp(lon, -180, 180);
    const x = (clampedLon / 180) * (MAP_W / 2);
    const shapeY = (lat / 90) * (MAP_D / 2);
    pts.push(new THREE.Vector2(x, shapeY));
  }
  return pts;
}

function getParsedConventionalMapGeometry() {
  if (!cachedCountriesGeoJson) {
    const atlas: any = countriesAtlas;
    cachedCountriesGeoJson = topojsonFeature(atlas, atlas.objects.countries);

    // 1. Crisp 3D Border LineSegments (skip Antarctica below -62° and antimeridian wraps)
    const borderMesh: any = topojsonMesh(atlas, atlas.objects.countries);
    const linePts: number[] = [];
    const lines: number[][][] =
      borderMesh.type === 'MultiLineString' ? borderMesh.coordinates : [borderMesh.coordinates];
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();

    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [lon1, lat1] = line[i];
        const [lon2, lat2] = line[i + 1];
        if (Math.abs(lon1 - lon2) > 180) continue;
        if (lat1 < -62 && lat2 < -62) continue;
        latLonToMapPos(lat1, lon1, LAND_SURFACE_Y + 0.005, pA);
        latLonToMapPos(lat2, lon2, LAND_SURFACE_Y + 0.005, pB);
        linePts.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      }
    }
    cachedBorderPositions = new Float32Array(linePts);

    // 2. Extruded 3D Continental & Country Relief Geometry grouped per country feature for choropleth coloring
    const partsByCountry: CachedCountryPart[] = [];
    const idParts: THREE.BufferGeometry[] = [];

    const addExtrudedPolygon = (rings: number[][][], targetArr: THREE.BufferGeometry[], depth: number) => {
      if (!rings || rings.length === 0) return;
      const outerPts = buildUnwrappedShapePoints(rings[0]);
      if (outerPts.length < 3) return;

      let minX = Infinity;
      let maxX = -Infinity;
      let avgLat = 0;
      for (const p of outerPts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        avgLat += (p.y / (MAP_D / 2)) * 90;
      }
      avgLat /= outerPts.length;
      if (avgLat < -60) return;
      if (maxX - minX > MAP_W * 0.72) return;

      const shape = new THREE.Shape(outerPts);
      for (let h = 1; h < rings.length; h++) {
        const holePts = buildUnwrappedShapePoints(rings[h]);
        if (holePts.length >= 3) {
          shape.holes.push(new THREE.Path(holePts));
        }
      }

      try {
        const extrude = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelThickness: 0.004,
          bevelSize: 0.004,
          bevelSegments: 1,
          curveSegments: 4,
        });
        extrude.rotateX(-Math.PI / 2);
        const nonIdx = extrude.index ? extrude.toNonIndexed() : extrude;
        nonIdx.deleteAttribute('uv');
        targetArr.push(nonIdx);
      } catch {
        // Ignore degenerate rings
      }
    };

    for (const feat of cachedCountriesGeoJson.features) {
      const geom = feat.geometry;
      if (!geom) continue;
      const atlasId = feat.id ? String(feat.id) : '';
      const atlasName = String(feat.properties?.name || '');
      const isIndonesia = atlasId === '360' || atlasName === 'Indonesia';
      const depth = isIndonesia ? 0.064 : 0.038;
      const featParts: THREE.BufferGeometry[] = [];

      if (geom.type === 'Polygon') {
        addExtrudedPolygon(geom.coordinates, isIndonesia ? idParts : featParts, depth);
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          addExtrudedPolygon(poly, isIndonesia ? idParts : featParts, depth);
        }
      }

      if (!isIndonesia && featParts.length > 0) {
        partsByCountry.push({
          atlasId,
          atlasName,
          isIndonesia: false,
          geometries: featParts,
        });
      }
    }

    cachedCountryParts = partsByCountry;
    cachedIndonesiaLandGeom =
      idParts.length > 0 ? mergeGeometries(idParts, false) : new THREE.BufferGeometry();
    idParts.forEach((g) => g.dispose());
  }

  return {
    countriesGeoJson: cachedCountriesGeoJson,
    borderPositions: cachedBorderPositions!,
    countryParts: cachedCountryParts!,
    indonesiaLandGeom: cachedIndonesiaLandGeom!,
  };
}

function buildColoredWorldLandGeometry(
  countries: MapCountryPoint[],
  maxCount: number,
  isDay: boolean
): THREE.BufferGeometry {
  const { countryParts } = getParsedConventionalMapGeometry();
  const { matchFeature } = buildTrafficLookup(countries);

  const mergedParts: THREE.BufferGeometry[] = [];

  for (const part of countryParts) {
    const matched = matchFeature(part.atlasId, part.atlasName);
    const count = matched ? matched.count : 0;
    computeTrafficChoroplethColor(count, maxCount, isDay, _tmpColor);

    for (const srcGeom of part.geometries) {
      const g = srcGeom.clone();
      const posAttr = g.getAttribute('position');
      const vCount = posAttr.count;
      const colors = new Float32Array(vCount * 3);
      for (let i = 0; i < vCount; i++) {
        colors[i * 3] = _tmpColor.r;
        colors[i * 3 + 1] = _tmpColor.g;
        colors[i * 3 + 2] = _tmpColor.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      mergedParts.push(g);
    }
  }

  const merged =
    mergedParts.length > 0 ? mergeGeometries(mergedParts, false) : new THREE.BufferGeometry();
  mergedParts.forEach((g) => g.dispose());
  return merged;
}

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

function createProceduralOceanBaseTextures(
  mode: 'IMPOR' | 'EKSPOR',
  themeMode: ThemeMode,
  countries: MapCountryPoint[],
  maxCount: number,
  maxAnisotropy: number
) {
  const { countriesGeoJson } = getParsedConventionalMapGeometry();
  const { matchFeature } = buildTrafficLookup(countries);
  const isDay = themeMode === 'day';
  const isImpor = mode === 'IMPOR';

  const W = 2048;
  const H = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const ctx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 1024;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;

  // 1. Ocean Bathymetry Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
  if (isDay) {
    if (isImpor) {
      oceanGrad.addColorStop(0, '#0f3858');
      oceanGrad.addColorStop(0.5, '#155478');
      oceanGrad.addColorStop(1, '#0d2e4a');
    } else {
      oceanGrad.addColorStop(0, '#0e3360');
      oceanGrad.addColorStop(0.5, '#155188');
      oceanGrad.addColorStop(1, '#0a274b');
    }
  } else {
    oceanGrad.addColorStop(0, '#040d20');
    oceanGrad.addColorStop(0.5, '#071a38');
    oceanGrad.addColorStop(1, '#030a18');
  }
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, W, H);

  rCtx.fillStyle = '#323232';
  rCtx.fillRect(0, 0, 1024, 512);

  // 2. Cartographic Lat/Lon Graticule Grid
  ctx.strokeStyle = isDay ? 'rgba(186, 230, 253, 0.16)' : 'rgba(56, 189, 248, 0.11)';
  ctx.lineWidth = 1.1;
  for (let lon = -165; lon <= 165; lon += 15) {
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

  // Equator line
  ctx.strokeStyle = isImpor ? 'rgba(16, 185, 129, 0.28)' : 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // 3. Choropleth-tinted Shallow Coastal Shelf Underlay
  const baseShelfColor = isDay ? 'rgba(148, 163, 184, 0.18)' : 'rgba(30, 41, 59, 0.35)';

  for (const feat of countriesGeoJson.features) {
    const geom = feat.geometry;
    if (!geom) continue;
    const atlasId = feat.id ? String(feat.id) : '';
    const atlasName = String(feat.properties?.name || '');
    const matched = matchFeature(atlasId, atlasName);

    let shelfFill = baseShelfColor;
    if (atlasId === '360' || atlasName === 'Indonesia') {
      shelfFill = isImpor ? 'rgba(16, 185, 129, 0.48)' : 'rgba(56, 189, 248, 0.48)';
    } else if (matched && matched.count > 0) {
      computeTrafficChoroplethColor(matched.count, maxCount, isDay, _tmpColor);
      shelfFill = `rgba(${Math.round(_tmpColor.r * 255)}, ${Math.round(_tmpColor.g * 255)}, ${Math.round(
        _tmpColor.b * 255
      )}, 0.45)`;
    }

    const drawPolys = (polys: number[][][][]) => {
      for (const poly of polys) {
        for (const shift of [0, -360, 360]) {
          ctx.beginPath();
          poly.forEach((ring) => drawGeoPolygonRing(ctx, ring, W, H, shift));
          ctx.closePath();
          ctx.fillStyle = shelfFill;
          ctx.fill();
        }
      }
    };
    if (geom.type === 'Polygon') drawPolys([geom.coordinates]);
    else if (geom.type === 'MultiPolygon') drawPolys(geom.coordinates);
  }

  // 4. Traffic Heatmap Halos for active partner countries (ensures micro-states like Singapore/HK glow visibly)
  countries.forEach((c) => {
    if (c.code === 'ID' || c.count <= 0) return;
    computeTrafficChoroplethColor(c.count, maxCount, isDay, _tmpColor);
    const r = Math.round(_tmpColor.r * 255);
    const g = Math.round(_tmpColor.g * 255);
    const b = Math.round(_tmpColor.b * 255);
    const px = ((c.lon + 180) / 360) * W;
    const py = ((90 - c.lat) / 180) * H;
    const radius = 14 + 28 * Math.sqrt(c.count / Math.max(1, maxCount));
    const halo = ctx.createRadialGradient(px, py, 2, px, py, radius);
    halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.72)`);
    halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  });

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

export const ConventionalMap3D: React.FC<ConventionalMap3DProps> = ({
  mode,
  countries,
  hoveredCountry,
  focusedCountry,
  focusSeq = 0,
  onHoverCountry,
  onSelectCountry,
  themeMode = 'night' as ThemeMode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [tooltipData, setTooltipData] = useState<MapCountryPoint | null>(null);

  const hoveredRef = useRef<string | null>(hoveredCountry);
  const onHoverRef = useRef(onHoverCountry);
  const onSelectRef = useRef(onSelectCountry);
  const flyTargetRef = useRef<{ lookAt: THREE.Vector3; camPos: THREE.Vector3 } | null>(null);
  const zoomDeltaRef = useRef<number>(0);
  const fitDistRef = useRef<number>(7.1);
  const userInteractedRef = useRef<boolean>(false);

  hoveredRef.current = hoveredCountry;
  onHoverRef.current = onHoverCountry;
  onSelectRef.current = onSelectCountry;

  const isImpor = mode === 'IMPOR';

  useEffect(() => {
    if (!hoveredCountry) {
      setTooltipData(null);
      return;
    }
    const found = countries.find((c) => c.name === hoveredCountry);
    setTooltipData(found || null);
  }, [hoveredCountry, countries]);

  useEffect(() => {
    if (!focusedCountry) return;
    userInteractedRef.current = true;
    if (focusedCountry === 'INDONESIA') {
      const hub = latLonToMapPos(JAKARTA_HUB_GEO.lat, JAKARTA_HUB_GEO.lon, HUB_SURFACE_Y);
      flyTargetRef.current = {
        lookAt: new THREE.Vector3(hub.x, 0.06, hub.z),
        camPos: new THREE.Vector3(hub.x, 2.45, hub.z + 0.008),
      };
      return;
    }
    const target = countries.find((c) => c.name === focusedCountry);
    if (target) {
      const pt = latLonToMapPos(target.lat, target.lon, LAND_SURFACE_Y);
      const hub = latLonToMapPos(JAKARTA_HUB_GEO.lat, JAKARTA_HUB_GEO.lon, HUB_SURFACE_Y);
      // Frame cleanly straight overhead around the trade flow / destination country
      const lookX = THREE.MathUtils.lerp(pt.x, hub.x, 0.16);
      const lookZ = THREE.MathUtils.lerp(pt.z, hub.z, 0.16);
      flyTargetRef.current = {
        lookAt: new THREE.Vector3(lookX, 0.06, lookZ),
        camPos: new THREE.Vector3(lookX, 2.25, lookZ + 0.008),
      };
    }
  }, [focusedCountry, focusSeq, countries]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const resolvedTheme: ThemeMode = themeMode === 'day' ? 'day' : 'night';
    const isDay = resolvedTheme === 'day';
    const accentHex = isImpor ? 0x10b981 : 0x38bdf8;
    const isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 180);
    const initialFitDist = computeFitDistance(width, height);
    fitDistRef.current = initialFitDist;
    userInteractedRef.current = false;

    // 1. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDay ? 1.12 : 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene & Studio Environment
    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 3. Straight Level Overhead 3D Camera (Zero tilt/skew, aligned symmetrically to border)
    const camera = new THREE.PerspectiveCamera(MAP_FOV, width / height, 0.1, 45);
    const initLook = new THREE.Vector3(0, 0.04, 0);
    const initCam = new THREE.Vector3(0, initialFitDist, 0.008);
    camera.position.copy(initCam);
    camera.lookAt(initLook);

    // 4. OrbitControls — STATIONARY STRAIGHT MAP: disable rotation, enable crisp planar pan & zoom
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(initLook);
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.enableZoom = true;
    controls.minDistance = 1.5;
    controls.maxDistance = Math.max(initialFitDist * 1.35, 9.5);
    controls.panSpeed = 0.85;
    controls.zoomSpeed = 0.9;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    // Left mouse drag pans smoothly across the straight 3D map
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    const onControlStart = () => {
      flyTargetRef.current = null;
      userInteractedRef.current = true;
    };
    controls.addEventListener('start', onControlStart);

    // 5. Studio 3-Point Lighting Rig (angled key light highlights 3D relief edges from overhead view)
    const hemiLight = new THREE.HemisphereLight(
      isDay ? 0xe0f2fe : 0x7dd3fc,
      isDay ? 0x334155 : 0x090d1a,
      isDay ? 1.2 : 0.95
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, isDay ? 1.7 : 1.55);
    keyLight.position.set(5.0, 7.0, 3.8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(accentHex, isDay ? 0.8 : 1.15);
    rimLight.position.set(-5.0, 3.2, -4.0);
    scene.add(rimLight);

    // 6. Tracked Disposables & Stationary Root Map Group
    const disposables: Array<{ dispose: () => void }> = [];
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    const activeCountries = countries.filter((c) => c.code !== 'ID').slice(0, 48);
    const maxCount = Math.max(1, ...activeCountries.map((c) => c.count));

    // 7. Sleek Architectural Beveled Map Frame Aligned to Viewport Border
    const plinthGeom = new THREE.BoxGeometry(MAP_W + BORDER_PAD_W, 0.14, MAP_D + BORDER_PAD_D);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: isDay ? 0x1e293b : 0x091122,
      roughness: 0.4,
      metalness: 0.65,
    });
    const plinthMesh = new THREE.Mesh(plinthGeom, plinthMat);
    plinthMesh.position.y = -0.075;
    mapGroup.add(plinthMesh);
    disposables.push(plinthGeom, plinthMat);

    // Accent Rim Trim around top border of map table
    const trimPts = [
      new THREE.Vector3(-MAP_W / 2 - 0.025, 0.008, -MAP_D / 2 - 0.025),
      new THREE.Vector3(MAP_W / 2 + 0.025, 0.008, -MAP_D / 2 - 0.025),
      new THREE.Vector3(MAP_W / 2 + 0.025, 0.008, MAP_D / 2 + 0.025),
      new THREE.Vector3(-MAP_W / 2 - 0.025, 0.008, MAP_D / 2 + 0.025),
      new THREE.Vector3(-MAP_W / 2 - 0.025, 0.008, -MAP_D / 2 - 0.025),
    ];
    const trimGeom = new THREE.BufferGeometry().setFromPoints(trimPts);
    const trimMat = new THREE.LineBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.68,
    });
    const trimLine = new THREE.Line(trimGeom, trimMat);
    mapGroup.add(trimLine);
    disposables.push(trimGeom, trimMat);

    // 8. Textured Ocean Map Surface Plane (with Choropleth Coastal Halos)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { colorTexture, roughnessTexture } = createProceduralOceanBaseTextures(
      mode,
      resolvedTheme,
      activeCountries,
      maxCount,
      maxAniso
    );
    disposables.push(colorTexture, roughnessTexture);

    const oceanGeom = new THREE.PlaneGeometry(MAP_W, MAP_D);
    oceanGeom.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      map: colorTexture,
      roughnessMap: roughnessTexture,
      roughness: 0.65,
      metalness: 0.16,
      envMapIntensity: isDay ? 0.85 : 0.95,
    });
    const oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
    oceanMesh.position.y = 0.001;
    mapGroup.add(oceanMesh);
    disposables.push(oceanGeom, oceanMat);

    // 9. Choropleth-Colored 3D Extruded Continents & Indonesia Highlight Mesh
    const { borderPositions, indonesiaLandGeom } = getParsedConventionalMapGeometry();
    const worldLandGeom = buildColoredWorldLandGeometry(activeCountries, maxCount, isDay);
    disposables.push(worldLandGeom);

    const landMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.52,
      metalness: 0.12,
      envMapIntensity: isDay ? 0.65 : 0.78,
    });
    const worldLandMesh = new THREE.Mesh(worldLandGeom, landMat);
    worldLandMesh.position.y = 0.002;
    mapGroup.add(worldLandMesh);
    disposables.push(landMat);

    const indonesiaMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: isDay ? 0.35 : 0.52,
      roughness: 0.35,
      metalness: 0.28,
    });
    const indonesiaMesh = new THREE.Mesh(indonesiaLandGeom, indonesiaMat);
    indonesiaMesh.position.y = 0.003;
    mapGroup.add(indonesiaMesh);
    disposables.push(indonesiaMat);

    // 10. Crisp 3D Border LineSegments over Extruded Terrain
    const borderGeom = new THREE.BufferGeometry();
    borderGeom.setAttribute('position', new THREE.BufferAttribute(borderPositions, 3));
    const borderMat = new THREE.LineBasicMaterial({
      color: isDay ? 0x334155 : 0x94a3b8,
      transparent: true,
      opacity: isDay ? 0.38 : 0.42,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const borderLines = new THREE.LineSegments(borderGeom, borderMat);
    mapGroup.add(borderLines);
    disposables.push(borderGeom, borderMat);

    // 11. Stationary BBKHIT DKI Jakarta Hub Beacon
    const hubPos = latLonToMapPos(JAKARTA_HUB_GEO.lat, JAKARTA_HUB_GEO.lon, HUB_SURFACE_Y);
    const hubGroup = new THREE.Group();
    hubGroup.position.copy(hubPos);
    mapGroup.add(hubGroup);

    const hubBaseGeom = new THREE.RingGeometry(0.04, 0.08, 32);
    const hubBaseMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const hubBaseMesh = new THREE.Mesh(hubBaseGeom, hubBaseMat);
    hubBaseMesh.rotation.x = -Math.PI / 2;
    hubBaseMesh.position.y = 0.004;
    hubGroup.add(hubBaseMesh);
    disposables.push(hubBaseGeom, hubBaseMat);

    const hubCollarGeom = new THREE.TorusGeometry(0.052, 0.01, 12, 24);
    const hubCollarMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      metalness: 0.9,
      roughness: 0.2,
    });
    const hubCollarMesh = new THREE.Mesh(hubCollarGeom, hubCollarMat);
    hubCollarMesh.rotation.x = Math.PI / 2;
    hubCollarMesh.position.y = 0.014;
    hubGroup.add(hubCollarMesh);
    disposables.push(hubCollarGeom, hubCollarMat);

    const hubSpireGeom = new THREE.CylinderGeometry(0.012, 0.026, 0.26, 16);
    const hubSpireMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.85,
      metalness: 0.35,
      roughness: 0.25,
    });
    const hubSpireMesh = new THREE.Mesh(hubSpireGeom, hubSpireMat);
    hubSpireMesh.position.y = 0.14;
    hubGroup.add(hubSpireMesh);
    disposables.push(hubSpireGeom, hubSpireMat);

    const hubGemGeom = new THREE.OctahedronGeometry(0.046, 0);
    const hubGemMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: accentHex,
      emissiveIntensity: 1.25,
      roughness: 0.15,
      metalness: 0.65,
    });
    const hubGemMesh = new THREE.Mesh(hubGemGeom, hubGemMat);
    hubGemMesh.position.y = 0.305;
    hubGroup.add(hubGemMesh);
    disposables.push(hubGemGeom, hubGemMat);

    // 12. 3D Country Volume Bars, Tip Spheres, Raycast Proxies & Clickable Trade Corridor Arcs
    interface CountryVisualHandle {
      data: MapCountryPoint;
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

    const baseRingGeom = new THREE.RingGeometry(0.032, 0.052, 20);
    const tipSphereGeom = new THREE.SphereGeometry(0.03, 14, 14);
    const hitProxyGeom = new THREE.SphereGeometry(0.125, 10, 10);
    const cargoGeom = new THREE.SphereGeometry(0.025, 10, 10);
    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const cargoMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    disposables.push(baseRingGeom, tipSphereGeom, hitProxyGeom, cargoGeom, hitProxyMat, cargoMat);

    activeCountries.slice(0, 28).forEach((country, idx) => {
      const surfacePos = latLonToMapPos(country.lat, country.lon, LAND_SURFACE_Y);
      const pillarHeight = 0.075 + 0.31 * (Math.sqrt(country.count) / Math.sqrt(maxCount));
      computeTrafficChoroplethColor(country.count, maxCount, isDay, _tmpColor);
      const nodeHex = _tmpColor.getHex();

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(surfacePos);
      mapGroup.add(nodeGroup);

      const ringMat = new THREE.MeshBasicMaterial({
        color: nodeHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82,
      });
      const ringMesh = new THREE.Mesh(baseRingGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.004;
      nodeGroup.add(ringMesh);
      disposables.push(ringMat);

      const pillarGeom = new THREE.CylinderGeometry(0.015, 0.025, pillarHeight, 12);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: nodeHex,
        emissive: nodeHex,
        emissiveIntensity: 0.45,
        metalness: 0.28,
        roughness: 0.35,
      });
      const pillarMesh = new THREE.Mesh(pillarGeom, pillarMat);
      pillarMesh.position.y = pillarHeight / 2;
      nodeGroup.add(pillarMesh);
      disposables.push(pillarGeom, pillarMat);

      const tipMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: nodeHex,
        emissiveIntensity: 0.9,
        metalness: 0.2,
        roughness: 0.2,
      });
      const tipMesh = new THREE.Mesh(tipSphereGeom, tipMat);
      tipMesh.position.y = pillarHeight + 0.015;
      nodeGroup.add(tipMesh);
      disposables.push(tipMat);

      // Country pillar hit proxy (Layer 1)
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

      // Top 14 Trade Corridors get 3D Parabolic Tube Arcs + Clickable Flow Hit-Tube + Cargo Pulses
      if (idx < 14) {
        const startVec = isImpor ? surfacePos : hubPos;
        const endVec = isImpor ? hubPos : surfacePos;
        const planarDist = startVec.distanceTo(endVec);
        const arcPeak = 0.18 + Math.min(0.85, planarDist * 0.16);

        const arcPoints: THREE.Vector3[] = [];
        const steps = 28;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = THREE.MathUtils.lerp(startVec.x, endVec.x, t);
          const z = THREE.MathUtils.lerp(startVec.z, endVec.z, t);
          const y = THREE.MathUtils.lerp(startVec.y, endVec.y, t) + arcPeak * Math.sin(Math.PI * t);
          arcPoints.push(new THREE.Vector3(x, y, z));
        }

        const curve = new THREE.CatmullRomCurve3(arcPoints);
        const tubeRadius = idx < 4 ? 0.013 : 0.0085;
        const tubeGeom = new THREE.TubeGeometry(curve, 36, tubeRadius, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: nodeHex,
          transparent: true,
          opacity: idx < 4 ? 0.78 : 0.5,
        });
        const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
        mapGroup.add(tubeMesh);
        disposables.push(tubeGeom, tubeMat);
        handle.tubeMat = tubeMat;

        // Wider invisible raycast tube so clicking any trade corridor flow arc easily triggers auto-zoom
        const flowHitGeom = new THREE.TubeGeometry(curve, 24, 0.055, 6, false);
        const flowHitMesh = new THREE.Mesh(flowHitGeom, hitProxyMat);
        flowHitMesh.layers.set(1);
        flowHitMesh.userData.countryPoint = country;
        mapGroup.add(flowHitMesh);
        clickableProxies.push(flowHitMesh);
        disposables.push(flowHitGeom);

        const pulseCount = idx < 5 ? 2 : 1;
        for (let p = 0; p < pulseCount; p++) {
          const cargoMesh = new THREE.Mesh(cargoGeom, cargoMat);
          mapGroup.add(cargoMesh);
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

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 13. Pointer Raycasting (throttled ~40ms) & Click Auto-Zoom onto Country or Trade Flow Arc
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
        const pt = hits[0].object.userData.countryPoint as MapCountryPoint;
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
      if (dist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(clickableProxies, false);
      if (hits.length > 0) {
        const pt = hits[0].object.userData.countryPoint as MapCountryPoint;
        const pos = latLonToMapPos(pt.lat, pt.lon, LAND_SURFACE_Y);
        const lookX = THREE.MathUtils.lerp(pos.x, hubPos.x, 0.16);
        const lookZ = THREE.MathUtils.lerp(pos.z, hubPos.z, 0.16);
        userInteractedRef.current = true;
        flyTargetRef.current = {
          lookAt: new THREE.Vector3(lookX, 0.06, lookZ),
          camPos: new THREE.Vector3(lookX, 2.25, lookZ + 0.008),
        };
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

    // 14. ResizeObserver — dynamically recalibrate straight fit distance to container border
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 280);
        const h = Math.max(entry.contentRect.height, 160);
        const nextFit = computeFitDistance(w, h);
        fitDistRef.current = nextFit;
        controls.maxDistance = Math.max(nextFit * 1.35, 9.5);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (!userInteractedRef.current && !flyTargetRef.current) {
          controls.target.set(0, 0.04, 0);
          camera.position.set(0, nextFit, 0.008);
          camera.lookAt(controls.target);
        }
      }
    });
    resizeObserver.observe(container);

    // 15. Animation Loop (Stationary map base, cargo pulse + click auto-zoom fly-to)
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

      // Zoom button adjustments along view vector
      if (zoomDeltaRef.current !== 0) {
        _vA.subVectors(camera.position, controls.target);
        const nextLen = THREE.MathUtils.clamp(
          _vA.length() + zoomDeltaRef.current,
          controls.minDistance,
          controls.maxDistance
        );
        _vA.setLength(nextLen);
        camera.position.copy(controls.target).add(_vA);
        zoomDeltaRef.current = 0;
      }

      // Smooth damped camera fly-to target (auto-zoom on clicking flow or country)
      if (flyTargetRef.current) {
        const lam = 5.5;
        controls.target.x = THREE.MathUtils.damp(controls.target.x, flyTargetRef.current.lookAt.x, lam, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, flyTargetRef.current.lookAt.y, lam, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, flyTargetRef.current.lookAt.z, lam, delta);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, flyTargetRef.current.camPos.x, lam, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, flyTargetRef.current.camPos.y, lam, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, flyTargetRef.current.camPos.z, lam, delta);
        if (
          camera.position.distanceTo(flyTargetRef.current.camPos) < 0.03 &&
          controls.target.distanceTo(flyTargetRef.current.lookAt) < 0.025
        ) {
          flyTargetRef.current = null;
        }
      }

      controls.update();

      // Update cargo beads along stationary 3D parabolic trade arcs
      for (let i = 0; i < cargoPulses.length; i++) {
        const p = cargoPulses[i];
        const t = (elapsed * p.speed + p.offset) % 1;
        p.curve.getPointAt(t, _vA);
        p.mesh.position.copy(_vA);
      }

      // Highlight hovered/selected country & trade flow
      const activeHover = hoveredRef.current;
      for (let i = 0; i < countryHandles.length; i++) {
        const h = countryHandles[i];
        const isHit = activeHover === h.data.name;
        const targetScale = isHit ? 1.32 : 1.0;
        const curScale = THREE.MathUtils.damp(h.group.scale.x, targetScale, 10, delta);
        h.group.scale.set(curScale, curScale, curScale);
        h.pillarMat.emissiveIntensity = isHit ? 1.25 : 0.45;
        h.tipMat.emissiveIntensity = isHit ? 1.7 : 0.9;
        h.ringMat.opacity = isHit ? 1.0 : 0.78;
        if (h.tubeMat) {
          h.tubeMat.opacity = isHit ? 0.98 : activeHover ? 0.25 : 0.62;
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
  const accentText = isImpor
    ? isDay
      ? 'text-emerald-700'
      : 'text-emerald-300'
    : isDay
    ? 'text-sky-700'
    : 'text-sky-300';

  return (
    <div
      className="relative w-full max-w-[1000px] mx-auto aspect-[2/1] min-h-[230px] my-3 rounded-2xl overflow-hidden border border-slate-300/70 dark:border-white/15 shadow-inner select-none"
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

      {/* Top-Left Direction Badge */}
      <div
        className="absolute top-2.5 left-2.5 pointer-events-none px-2.5 py-1 rounded-lg border text-[10px] font-extrabold tracking-wide uppercase flex items-center space-x-1.5"
        style={{
          backgroundColor: isDay ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.84)',
          borderColor: isDay ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.14)',
        }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: isImpor ? '#10b981' : '#38bdf8' }}
        />
        <span className={accentText}>
          Peta Konvensional 3D • {isImpor ? 'Arus Masuk Impor' : 'Arus Keluar Ekspor'}
        </span>
      </div>

      {/* Top-Right Compact 3D Camera Controls */}
      <div
        className="absolute top-2.5 right-2.5 flex items-center space-x-1 p-1 rounded-xl border"
        style={{
          backgroundColor: isDay ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.84)',
          borderColor: isDay ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.14)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            userInteractedRef.current = false;
            flyTargetRef.current = {
              lookAt: new THREE.Vector3(0, 0.04, 0),
              camPos: new THREE.Vector3(0, fitDistRef.current, 0.008),
            };
          }}
          title="Reset Tampilan Peta Penuh"
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            userInteractedRef.current = true;
            const hub = latLonToMapPos(JAKARTA_HUB_GEO.lat, JAKARTA_HUB_GEO.lon, HUB_SURFACE_Y);
            flyTargetRef.current = {
              lookAt: new THREE.Vector3(hub.x, 0.06, hub.z),
              camPos: new THREE.Vector3(hub.x, 2.45, hub.z + 0.008),
            };
          }}
          title="Zoom ke Indonesia (BBKHIT DKI Jakarta)"
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
        >
          <Compass className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            userInteractedRef.current = true;
            zoomDeltaRef.current = -0.65;
          }}
          title="Perbesar Peta"
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            userInteractedRef.current = true;
            zoomDeltaRef.current = 0.65;
          }}
          title="Perkecil Peta"
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hovered / Selected Country Info Card */}
      {tooltipData && (
        <div
          className="absolute bottom-10 right-2.5 max-w-[240px] pointer-events-none px-3 py-2 rounded-xl border shadow-lg text-xs"
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

      {/* Choropleth Traffic Density Legend + Interaction Hint */}
      <div className="absolute bottom-2 left-2.5 right-2.5 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        <div
          className="text-[9px] font-mono px-2 py-0.5 rounded-md border"
          style={{
            backgroundColor: isDay ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.82)',
            borderColor: isDay ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.12)',
            color: isDay ? '#334155' : '#cbd5e1',
          }}
        >
          KLIK ARUS / NEGARA AUTO-ZOOM • GESER PETA • SCROLL ZOOM
        </div>

        <div
          className="px-2 py-0.5 rounded-md border flex items-center space-x-1.5 text-[9px] font-bold"
          style={{
            backgroundColor: isDay ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.82)',
            borderColor: isDay ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.12)',
            color: isDay ? '#334155' : '#e2e8f0',
          }}
        >
          <span>Lalu Lintas:</span>
          <span className="text-sky-600 dark:text-sky-300">Rendah</span>
          <span
            className="w-16 h-2 rounded-sm inline-block"
            style={{
              background:
                'linear-gradient(90deg, #38bdf8 0%, #2dd4bf 30%, #f59e0b 60%, #f97316 82%, #ef4444 100%)',
            }}
          />
          <span className="text-rose-600 dark:text-rose-400">Padat</span>
        </div>
      </div>
    </div>
  );
};
