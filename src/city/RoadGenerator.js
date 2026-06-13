import * as THREE from 'three';
import { SimplexNoise } from '../utils/Noise.js';
import { randomRange } from '../utils/helpers.js';

const ROAD_TYPES = {
  GRID: 'grid',
  RADIAL: 'radial',
  ORGANIC: 'organic'
};

class RoadGenerator {
  constructor(params) {
    this.mapSize = params.mapSize;
    this.roadType = params.roadType || ROAD_TYPES.GRID;
    this.halfMap = this.mapSize / 2;
    this.noise = new SimplexNoise(params.seed || 42);
    this.majorRoadSpacing = 35;
    this.minorRoadSpacing = 10;
    this.roadWidth = 5;
    this.minorRoadWidth = 3;
  }
  
  generate() {
    this.plots = [];
    this.roads = [];
    this.roadSegments = [];
    
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
    return { roads: this.roads, roadSegments: this.roadSegments, plots: this.plots };
  }
  
  generateGridRoads() {
    for (let x = -this.halfMap; x <= this.halfMap; x += this.majorRoadSpacing) {
      this.roadSegments.push({
        start: { x, z: -this.halfMap },
        end: { x, z: this.halfMap },
        width: this.roadWidth,
        isMajor: true
      });
    }
    for (let z = -this.halfMap; z <= this.halfMap; z += this.majorRoadSpacing) {
      this.roadSegments.push({
        start: { x: -this.halfMap, z },
        end: { x: this.halfMap, z },
        width: this.roadWidth,
        isMajor: true
      });
    }
    
    for (let x = -this.halfMap + this.minorRoadSpacing; x < this.halfMap; x += this.minorRoadSpacing) {
      if (Math.abs(x % this.majorRoadSpacing) < 1) continue;
      const jitter = this.noise.noise2D(x * 0.01, 0) * 2;
      this.roadSegments.push({
        start: { x: x + jitter, z: -this.halfMap },
        end: { x: x + jitter, z: this.halfMap },
        width: this.minorRoadWidth,
        isMajor: false
      });
    }
    for (let z = -this.halfMap + this.minorRoadSpacing; z < this.halfMap; z += this.minorRoadSpacing) {
      if (Math.abs(z % this.majorRoadSpacing) < 1) continue;
      const jitter = this.noise.noise2D(0, z * 0.01) * 2;
      this.roadSegments.push({
        start: { x: -this.halfMap, z: z + jitter },
        end: { x: this.halfMap, z: z + jitter },
        width: this.minorRoadWidth,
        isMajor: false
      });
    }
  }
  
  generateRadialRoads() {
    const numRadials = 12;
    const numRings = Math.floor(this.halfMap / this.majorRoadSpacing);
    
    for (let i = 0; i < numRadials; i++) {
      const angle = (i / numRadials) * Math.PI * 2;
      const jitter = this.noise.noise2D(i * 0.5, 0) * 0.05;
      this.roadSegments.push({
        start: { x: 0, z: 0 },
        end: {
          x: Math.cos(angle + jitter) * this.halfMap,
          z: Math.sin(angle + jitter) * this.halfMap
        },
        width: this.roadWidth,
        isMajor: true
      });
    }
    
    for (let r = 1; r <= numRings; r++) {
      const radius = r * this.majorRoadSpacing;
      if (radius > this.halfMap) break;
      const segments = 32 + r * 4;
      for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        const jitter1 = this.noise.noise2D(
          Math.cos(angle1) * radius * 0.01,
          Math.sin(angle1) * radius * 0.01
        ) * 3;
        const jitter2 = this.noise.noise2D(
          Math.cos(angle2) * radius * 0.01,
          Math.sin(angle2) * radius * 0.01
        ) * 3;
        this.roadSegments.push({
          start: {
            x: Math.cos(angle1) * (radius + jitter1),
            z: Math.sin(angle1) * (radius + jitter1)
          },
          end: {
            x: Math.cos(angle2) * (radius + jitter2),
            z: Math.sin(angle2) * (radius + jitter2)
          },
          width: r % 2 === 0 ? this.roadWidth : this.minorRoadWidth,
          isMajor: r % 2 === 0
        });
      }
    }
    
    this.generateGridRoads();
  }
  
  generateOrganicRoads() {
    const numPoints = 80;
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: randomRange(-this.halfMap, this.halfMap),
        z: randomRange(-this.halfMap, this.halfMap),
        connections: []
      });
    }
    
    for (let i = 0; i < points.length; i++) {
      const distances = [];
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const dx = points[j].x - points[i].x;
        const dz = points[j].z - points[i].z;
        distances.push({ j, dist: Math.sqrt(dx * dx + dz * dz) });
      }
      distances.sort((a, b) => a.dist - b.dist);
      
      const numConnections = randomInt(2, 4);
      for (let k = 0; k < Math.min(numConnections, distances.length); k++) {
        const j = distances[k].j;
        if (!points[i].connections.includes(j) && distances[k].dist < 60) {
          points[i].connections.push(j);
          points[j].connections.push(i);
          
          this.roadSegments.push({
            start: { x: points[i].x, z: points[i].z },
            end: { x: points[j].x, z: points[j].z },
            width: distances[k].dist < 30 ? this.minorRoadWidth : this.roadWidth,
            isMajor: distances[k].dist >= 30
          });
        }
      }
    }
    
    this.generateGridRoads();
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
        
        let zone = 'residential';
        if (centerDist < 0.3 && noiseVal > 0.2) {
          zone = 'commercial';
        } else if (centerDist > 0.7 && noiseVal < -0.1) {
          zone = 'industrial';
        } else if (noiseVal > 0.3) {
          zone = 'commercial';
        } else if (noiseVal < -0.2) {
          zone = 'industrial';
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
}

export { RoadGenerator, ROAD_TYPES };

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
