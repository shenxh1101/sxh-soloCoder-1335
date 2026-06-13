import * as THREE from 'three';
import { SimplexNoise } from '../utils/Noise.js';
import { randomRange, randomInt } from '../utils/helpers.js';

const ROAD_TYPES = {
  GRID: 'grid',
  RADIAL: 'radial',
  ORGANIC: 'organic'
};

class RoadGenerator {
  constructor(params, zoneEditor = null) {
    this.mapSize = params.mapSize;
    this.roadType = params.roadType || ROAD_TYPES.GRID;
    this.halfMap = this.mapSize / 2;
    this.noise = new SimplexNoise(params.seed || 42);
    this.majorRoadSpacing = 35;
    this.minorRoadSpacing = 10;
    this.roadWidth = 5;
    this.minorRoadWidth = 3;
    this.zoneEditor = zoneEditor;
  }
  
  setZoneEditor(zoneEditor) {
    this.zoneEditor = zoneEditor;
  }
  
  generate() {
    this.plots = [];
    this.roads = [];
    this.roadSegments = [];
    this.curvedRoadPaths = [];
    
    switch (this.roadType) {
      case ROAD_TYPES.GRID:
        this.generateGridRoads();
        break;
      case ROAD_TYPES.RADIAL:
        this.generateRadialRoads();
        break;
      case ROAD_TYPES.ORGANIC:
        this.generateOrganicRoads();
        break;
    }
    
    this.generatePlots();
    return { 
      roads: this.roads, 
      roadSegments: this.roadSegments, 
      plots: this.plots,
      curvedRoadPaths: this.curvedRoadPaths
    };
  }
  
  generateGridRoads() {
    for (let x = -this.halfMap; x <= this.halfMap; x += this.majorRoadSpacing) {
      this.addRoadSegment(
        { x, z: -this.halfMap },
        { x, z: this.halfMap },
        this.roadWidth,
        true
      );
    }
    for (let z = -this.halfMap; z <= this.halfMap; z += this.majorRoadSpacing) {
      this.addRoadSegment(
        { x: -this.halfMap, z },
        { x: this.halfMap, z },
        this.roadWidth,
        true
      );
    }
    
    for (let x = -this.halfMap + this.minorRoadSpacing; x < this.halfMap; x += this.minorRoadSpacing) {
      if (Math.abs(x % this.majorRoadSpacing) < 1) continue;
      const jitter = this.noise.noise2D(x * 0.01, 0) * 2;
      this.addRoadSegment(
        { x: x + jitter, z: -this.halfMap },
        { x: x + jitter, z: this.halfMap },
        this.minorRoadWidth,
        false
      );
    }
    for (let z = -this.halfMap + this.minorRoadSpacing; z < this.halfMap; z += this.minorRoadSpacing) {
      if (Math.abs(z % this.majorRoadSpacing) < 1) continue;
      const jitter = this.noise.noise2D(0, z * 0.01) * 2;
      this.addRoadSegment(
        { x: -this.halfMap, z: z + jitter },
        { x: this.halfMap, z: z + jitter },
        this.minorRoadWidth,
        false
      );
    }
  }
  
  generateRadialRoads() {
    const numRadials = 12;
    const numRings = Math.floor(this.halfMap / this.majorRoadSpacing);
    
    for (let i = 0; i < numRadials; i++) {
      const angle = (i / numRadials) * Math.PI * 2;
      const points = [];
      const segments = 20;
      
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const radius = t * this.halfMap;
        const jitter = this.noise.fbm(
          Math.cos(angle) * radius * 0.008,
          Math.sin(angle) * radius * 0.008,
          3
        ) * 8;
        points.push({
          x: Math.cos(angle) * (radius + jitter),
          z: Math.sin(angle) * (radius + jitter)
        });
      }
      
      this.addCurvedRoad(points, this.roadWidth, true);
    }
    
    for (let r = 1; r <= numRings; r++) {
      const baseRadius = r * this.majorRoadSpacing;
      if (baseRadius > this.halfMap) break;
      
      const isMajor = r % 2 === 0;
      const segments = 40 + r * 4;
      const width = isMajor ? this.roadWidth : this.minorRoadWidth;
      
      const ringPoints = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const jitter = this.noise.fbm(
          Math.cos(angle) * baseRadius * 0.008,
          Math.sin(angle) * baseRadius * 0.008,
          3
        ) * 5;
        ringPoints.push({
          x: Math.cos(angle) * (baseRadius + jitter),
          z: Math.sin(angle) * (baseRadius + jitter)
        });
      }
      
      this.addCurvedRoad(ringPoints, width, isMajor);
    }
  }
  
  generateOrganicRoads() {
    const numMainRoads = 6;
    const mainRoadCurves = [];
    
    for (let i = 0; i < numMainRoads; i++) {
      const startAngle = (i / numMainRoads) * Math.PI * 2 + Math.PI / numMainRoads;
      const numPoints = randomInt(8, 15);
      const curvePoints = [];
      
      let currentAngle = startAngle;
      let currentRadius = 0;
      
      for (let p = 0; p < numPoints; p++) {
        const t = p / (numPoints - 1);
        currentRadius = t * this.halfMap * randomRange(0.9, 1.1);
        
        const angleJitter = this.noise.fbm(
          Math.cos(currentAngle) * currentRadius * 0.005,
          Math.sin(currentAngle) * currentRadius * 0.005,
          3
        ) * 0.8;
        currentAngle += angleJitter;
        
        const radiusJitter = this.noise.fbm(
          currentAngle * 2,
          t * 5,
          2
        ) * 15;
        
        curvePoints.push({
          x: Math.cos(currentAngle) * (currentRadius + radiusJitter),
          z: Math.sin(currentAngle) * (currentRadius + radiusJitter)
        });
      }
      
      mainRoadCurves.push(curvePoints);
      this.addCurvedRoad(curvePoints, this.roadWidth, true);
    }
    
    const numSecondaryRoads = 10;
    for (let i = 0; i < numSecondaryRoads; i++) {
      const curvePoints = [];
      const numPoints = randomInt(6, 10);
      
      const startX = randomRange(-this.halfMap * 0.7, this.halfMap * 0.7);
      const startZ = randomRange(-this.halfMap * 0.7, this.halfMap * 0.7);
      
      let x = startX;
      let z = startZ;
      let angle = randomRange(0, Math.PI * 2);
      
      for (let p = 0; p < numPoints; p++) {
        curvePoints.push({ x, z });
        
        const turnAmount = this.noise.fbm(x * 0.01, z * 0.01, 2) * 0.6;
        angle += turnAmount;
        
        const step = randomRange(15, 25);
        x += Math.cos(angle) * step;
        z += Math.sin(angle) * step;
        
        x = Math.max(-this.halfMap * 0.95, Math.min(this.halfMap * 0.95, x));
        z = Math.max(-this.halfMap * 0.95, Math.min(this.halfMap * 0.95, z));
      }
      
      this.addCurvedRoad(curvePoints, this.minorRoadWidth, false);
    }
    
    const numLocalRoads = 15;
    for (let i = 0; i < numLocalRoads; i++) {
      const curvePoints = [];
      const numPoints = randomInt(5, 8);
      
      let x = randomRange(-this.halfMap * 0.8, this.halfMap * 0.8);
      let z = randomRange(-this.halfMap * 0.8, this.halfMap * 0.8);
      let angle = randomRange(0, Math.PI * 2);
      
      for (let p = 0; p < numPoints; p++) {
        curvePoints.push({ x, z });
        
        const turnAmount = this.noise.fbm(x * 0.02, z * 0.02, 2) * 0.8;
        angle += turnAmount;
        
        const step = randomRange(10, 18);
        x += Math.cos(angle) * step;
        z += Math.sin(angle) * step;
        
        x = Math.max(-this.halfMap * 0.95, Math.min(this.halfMap * 0.95, x));
        z = Math.max(-this.halfMap * 0.95, Math.min(this.halfMap * 0.95, z));
      }
      
      this.addCurvedRoad(curvePoints, this.minorRoadWidth * 0.8, false);
    }
  }
  
  addRoadSegment(start, end, width, isMajor) {
    this.roadSegments.push({ start, end, width, isMajor });
  }
  
  addCurvedRoad(points, width, isMajor) {
    if (points.length < 2) return;
    
    this.curvedRoadPaths.push({ points, width, isMajor });
    
    const subdivided = this.subdivideCurve(points, 3);
    
    for (let i = 0; i < subdivided.length - 1; i++) {
      this.addRoadSegment(
        subdivided[i],
        subdivided[i + 1],
        width,
        isMajor
      );
    }
  }
  
  subdivideCurve(points, subdivisions = 2) {
    if (points.length < 3) return points;
    
    const result = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[Math.min(points.length - 1, i + 1)];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      for (let t = 0; t < subdivisions; t++) {
        const tt = t / subdivisions;
        const point = this.catmullRom(p0, p1, p2, p3, tt);
        result.push(point);
      }
    }
    
    result.push(points[points.length - 1]);
    return result;
  }
  
  catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    const v0x = (p2.x - p0.x) * 0.5;
    const v0z = (p2.z - p0.z) * 0.5;
    const v1x = (p3.x - p1.x) * 0.5;
    const v1z = (p3.z - p1.z) * 0.5;
    
    return {
      x: (2 * p1.x - 2 * p2.x + v0x + v1x) * t3 +
       (-3 * p1.x + 3 * p2.x - 2 * v0x - v1x) * t2 +
       v0x * t + p1.x,
      z: (2 * p1.z - 2 * p2.z + v0z + v1z) * t3 +
       (-3 * p1.z + 3 * p2.z - 2 * v0z - v1z) * t2 +
       v0z * t + p1.z
    };
  }
  
  generatePlots() {
    const cellSize = this.minorRoadSpacing;
    const halfCells = Math.floor(this.halfMap / cellSize);
    
    for (let gx = -halfCells; gx < halfCells; gx++) {
      for (let gz = -halfCells; gz < halfCells; gz++) {
        const plotX = gx * cellSize + cellSize / 2;
        const plotZ = gz * cellSize + cellSize / 2;
        
        if (this.isOnRoad(plotX, plotZ)) continue;
        
        const noiseVal = this.noise.fbm(plotX * 0.01, plotZ * 0.01, 4);
        const centerDist = Math.sqrt(plotX * plotX + plotZ * plotZ) / this.halfMap;
        
        let zone;
        if (this.zoneEditor) {
          zone = this.zoneEditor.getZoneAt(plotX, plotZ, noiseVal);
        } else {
          zone = 'residential';
          if (centerDist < 0.3 && noiseVal > 0.2) {
            zone = 'commercial';
          } else if (centerDist > 0.7 && noiseVal < -0.1) {
            zone = 'industrial';
          } else if (noiseVal > 0.3) {
            zone = 'commercial';
          } else if (noiseVal < -0.2) {
            zone = 'industrial';
          }
        }
        
        const plotSize = cellSize - this.minorRoadWidth - 1;
        
        this.plots.push({
          x: plotX,
          z: plotZ,
          width: plotSize * randomRange(0.6, 0.95),
          depth: plotSize * randomRange(0.6, 0.95),
          zone,
          rotation: 0
        });
      }
    }
  }
  
  isOnRoad(x, z) {
    const margin = this.roadWidth / 2 + 1;
    for (const seg of this.roadSegments) {
      const dist = this.pointToSegmentDistance(x, z, seg);
      if (dist < seg.width / 2 + 0.5) return true;
    }
    return false;
  }
  
  pointToSegmentDistance(px, pz, seg) {
    const { start, end } = seg;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lenSq = dx * dx + dz * dz;
    
    if (lenSq === 0) {
      const ddx = px - start.x;
      const ddz = pz - start.z;
      return Math.sqrt(ddx * ddx + ddz * ddz);
    }
    
    let t = ((px - start.x) * dx + (pz - start.z) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    
    const projX = start.x + t * dx;
    const projZ = start.z + t * dz;
    
    const ddx = px - projX;
    const ddz = pz - projZ;
    return Math.sqrt(ddx * ddx + ddz * ddz);
  }
  
  createRoadMeshes() {
    const group = new THREE.Group();
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.9,
      metalness: 0.0
    });
    
    for (const seg of this.roadSegments) {
      const dx = seg.end.x - seg.start.x;
      const dz = seg.end.z - seg.start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      
      if (length < 0.5) continue;
      
      const geometry = new THREE.PlaneGeometry(seg.width, length);
      const mesh = new THREE.Mesh(geometry, roadMaterial);
      
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.x = (seg.start.x + seg.end.x) / 2;
      mesh.position.z = (seg.start.z + seg.end.z) / 2;
      mesh.position.y = 0.02;
      
      const angle = Math.atan2(dx, dz);
      mesh.rotation.z = angle;
      
      mesh.receiveShadow = true;
      group.add(mesh);
      
      if (seg.isMajor) {
        const lineGeometry = new THREE.PlaneGeometry(0.3, length * 0.95);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.copy(mesh.rotation);
        line.position.copy(mesh.position);
        line.position.y = 0.03;
        group.add(line);
      }
    }
    
    return group;
  }
  
  getCurvedRoadPaths() {
    return this.curvedRoadPaths || [];
  }
  
  getMajorRoadSegments() {
    return this.roadSegments.filter(s => s.isMajor);
  }
  
  getAllRoadPoints() {
    const allPoints = [];
    for (const path of this.curvedRoadPaths || []) {
      for (const p of path.points) {
        allPoints.push({ ...p, isMajor: path.isMajor, width: path.width });
      }
    }
    return allPoints;
  }
}

export { RoadGenerator, ROAD_TYPES };
