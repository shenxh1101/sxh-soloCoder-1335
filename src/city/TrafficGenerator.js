import * as THREE from 'three';
import { randomRange, randomInt, clamp } from '../utils/helpers.js';

class TrafficGenerator {
  constructor(mapSize) {
    this.mapSize = mapSize;
    this.halfMap = mapSize / 2;
    this.vehicles = [];
    this.vehicleGroup = new THREE.Group();
    this.nightFactor = 0;
    this.weatherBoost = 1.0;
    this.roadType = 'grid';
  }
  
  generate(roadPaths, roadType = 'grid') {
    this.vehicles = [];
    this.clear();
    this.roadType = roadType;
    
    const majorRoads = roadPaths.filter(p => p.isMajor || p.level === 'major');
    const minorRoads = roadPaths.filter(p => !p.isMajor && p.level !== 'major');
    
    const trafficMultiplier = this.getTrafficMultiplier(roadType);
    const majorVehicleRatio = this.getMajorVehicleRatio(roadType);
    
    const totalVehicles = Math.min(180, Math.floor(this.mapSize * 0.5 * trafficMultiplier));
    const majorVehiclesCount = Math.floor(totalVehicles * majorVehicleRatio);
    const minorVehiclesCount = totalVehicles - majorVehiclesCount;
    
    const numLightVehicles = Math.min(35, Math.floor(this.mapSize * 0.1));
    
    let vehicleIdx = 0;
    
    for (let i = 0; i < majorVehiclesCount; i++) {
      if (majorRoads.length === 0) break;
      const roadPath = majorRoads[Math.floor(Math.random() * majorRoads.length)];
      if (!roadPath || roadPath.points.length < 2) continue;
      
      const hasLight = vehicleIdx < numLightVehicles;
      const vehicle = this.createVehicle(roadPath, hasLight, true);
      if (vehicle) {
        this.vehicles.push(vehicle);
        this.vehicleGroup.add(vehicle.mesh);
        if (vehicle.headlightMesh) this.vehicleGroup.add(vehicle.headlightMesh);
        vehicleIdx++;
      }
    }
    
    for (let i = 0; i < minorVehiclesCount; i++) {
      if (minorRoads.length === 0) break;
      const roadPath = minorRoads[Math.floor(Math.random() * minorRoads.length)];
      if (!roadPath || roadPath.points.length < 2) continue;
      
      const hasLight = vehicleIdx < numLightVehicles;
      const vehicle = this.createVehicle(roadPath, hasLight, false);
      if (vehicle) {
        this.vehicles.push(vehicle);
        this.vehicleGroup.add(vehicle.mesh);
        if (vehicle.headlightMesh) this.vehicleGroup.add(vehicle.headlightMesh);
        vehicleIdx++;
      }
    }
    
    return this.vehicleGroup;
  }
  
  getTrafficMultiplier(roadType) {
    switch (roadType) {
      case 'grid':
        return 1.0;
      case 'radial':
        return 1.15;
      case 'organic':
        return 0.85;
      default:
        return 1.0;
    }
  }
  
  getMajorVehicleRatio(roadType) {
    switch (roadType) {
      case 'grid':
        return 0.45;
      case 'radial':
        return 0.6;
      case 'organic':
        return 0.35;
      default:
        return 0.5;
    }
  }
  
  createVehicle(roadPath, hasLight = false, isMajorRoad = false) {
    const points = roadPath.points;
    const t = Math.random();
    const pointIndex = Math.floor(t * (points.length - 1));
    const pointT = (t * (points.length - 1)) % 1;
    
    const p1 = points[pointIndex];
    const p2 = points[Math.min(pointIndex + 1, points.length - 1)];
    
    const x = p1.x + (p2.x - p1.x) * pointT;
    const z = p1.z + (p2.z - p1.z) * pointT;
    
    let baseSpeed, speedVariance;
    if (isMajorRoad) {
      baseSpeed = this.roadType === 'radial' ? 1.0 : 0.85;
      speedVariance = 0.4;
    } else {
      baseSpeed = this.roadType === 'organic' ? 0.35 : 0.5;
      speedVariance = 0.25;
    }
    
    const speed = clamp(baseSpeed + (Math.random() - 0.5) * speedVariance, 0.2, 1.4);
    const direction = Math.random() > 0.5 ? 1 : -1;
    
    const vehicleType = Math.random();
    let headlightColor, headlightIntensity, bodyColor;
    
    if (vehicleType < 0.7) {
      headlightColor = new THREE.Color(0xffffee);
      headlightIntensity = randomRange(0.8, 1.5);
      bodyColor = new THREE.Color().setHSL(Math.random() * 0.1 + 0.55, 0.3, 0.3);
    } else if (vehicleType < 0.9) {
      headlightColor = new THREE.Color(0xffaa44);
      headlightIntensity = randomRange(0.6, 1.0);
      bodyColor = new THREE.Color().setHSL(Math.random() * 0.05 + 0.08, 0.6, 0.35);
    } else {
      headlightColor = new THREE.Color(0xffffff);
      headlightIntensity = randomRange(1.2, 2.0);
      bodyColor = new THREE.Color().setHSL(Math.random() * 0.05, 0.2, 0.4);
    }
    
    const bodySize = isMajorRoad ? [0.9, 0.35, 1.7] : [0.7, 0.28, 1.3];
    const bodyGeometry = new THREE.BoxGeometry(...bodySize);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: bodyColor,
      transparent: true,
      opacity: 0.25
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(x, 0.2, z);
    
    const headlightSize = hasLight ? (isMajorRoad ? 0.22 : 0.18) : (isMajorRoad ? 0.13 : 0.1);
    const headlightGeometry = new THREE.SphereGeometry(headlightSize, 8, 8);
    const headlightMaterial = new THREE.MeshBasicMaterial({
      color: headlightColor,
      transparent: true,
      opacity: 0
    });
    const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    headlight.position.set(x, 0.35, z);
    
    let pointLight = null;
    if (hasLight) {
      pointLight = new THREE.PointLight(
        headlightColor,
        0,
        isMajorRoad ? 12 : 7,
        2
      );
      pointLight.position.set(x, 0.5, z);
      headlight.add(pointLight);
    }
    
    return {
      mesh: body,
      headlightMesh: headlight,
      light: pointLight,
      path: roadPath,
      pathIndex: pointIndex,
      pathT: pointT,
      speed,
      baseSpeed,
      direction,
      isMajor: isMajorRoad,
      headlightColor,
      headlightIntensity,
      hasLight,
      dayVisibility: randomRange(0.05, 0.15),
      nightVisibility: randomRange(0.75, 1.0)
    };
  }
  
  update(deltaTime) {
    const timeFlowFactor = this.getTimeFlowFactor();
    const roadSpeedBoost = this.roadType === 'radial' ? 1.1 : 1.0;
    
    for (const vehicle of this.vehicles) {
      const points = vehicle.path.points;
      if (points.length < 2) continue;
      
      const effectiveSpeed = vehicle.speed * timeFlowFactor * roadSpeedBoost;
      vehicle.pathT += vehicle.direction * effectiveSpeed * deltaTime * 0.18;
      
      if (vehicle.pathT >= 1) {
        vehicle.pathIndex++;
        vehicle.pathT = 0;
        if (vehicle.pathIndex >= points.length - 1) {
          if (Math.random() > 0.5) {
            vehicle.direction = -1;
            vehicle.pathIndex = points.length - 2;
            vehicle.pathT = 1;
          } else {
            vehicle.pathIndex = 0;
            vehicle.pathT = 0;
          }
        }
      } else if (vehicle.pathT <= 0) {
        vehicle.pathIndex--;
        vehicle.pathT = 1;
        if (vehicle.pathIndex < 0) {
          if (Math.random() > 0.5) {
            vehicle.direction = 1;
            vehicle.pathIndex = 0;
            vehicle.pathT = 0;
          } else {
            vehicle.pathIndex = points.length - 2;
            vehicle.pathT = 1;
          }
        }
      }
      
      vehicle.pathIndex = Math.max(0, Math.min(points.length - 2, vehicle.pathIndex));
      
      const p1 = points[vehicle.pathIndex];
      const p2 = points[Math.min(vehicle.pathIndex + 1, points.length - 1)];
      
      const x = p1.x + (p2.x - p1.x) * vehicle.pathT;
      const z = p1.z + (p2.z - p1.z) * vehicle.pathT;
      
      vehicle.mesh.position.set(x, 0.2, z);
      vehicle.headlightMesh.position.set(x, 0.35, z);
      if (vehicle.light) {
        vehicle.light.position.set(x, 0.5, z);
      }
      
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const angle = Math.atan2(dx, dz);
      vehicle.mesh.rotation.y = vehicle.direction > 0 ? angle : angle + Math.PI;
      vehicle.headlightMesh.rotation.y = vehicle.mesh.rotation.y;
      
      const nightIntensity = this.nightFactor * vehicle.headlightIntensity * this.weatherBoost;
      const dayIntensity = vehicle.dayVisibility * vehicle.headlightIntensity * (1 - this.nightFactor);
      const totalIntensity = (nightIntensity + dayIntensity) * this.weatherBoost;
      
      if (vehicle.light) {
        vehicle.light.intensity = totalIntensity;
      }
      
      const headlightBrightness = this.nightFactor * vehicle.nightVisibility + (1 - this.nightFactor) * vehicle.dayVisibility;
      const finalBrightness = headlightBrightness * this.weatherBoost;
      vehicle.headlightMesh.material.opacity = clamp(finalBrightness, 0.05, 1.0);
      if (vehicle.hasLight) {
        vehicle.headlightMesh.scale.setScalar(1 + finalBrightness * 0.6);
      }
      vehicle.mesh.material.opacity = (this.nightFactor * 0.5 + (1 - this.nightFactor) * 0.18) * (0.7 + this.weatherBoost * 0.3);
    }
  }
  
  getTimeFlowFactor() {
    if (this.nightFactor > 0.7) {
      return 0.55 + this.roadType === 'radial' ? 0.1 : 0;
    } else if (this.nightFactor < 0.2) {
      return 1.2;
    } else {
      return 0.9 + 0.3 * (0.5 - Math.abs(this.nightFactor - 0.5));
    }
  }
  
  setNightFactor(factor) {
    this.nightFactor = factor;
  }
  
  setWeatherBoost(boost) {
    this.weatherBoost = boost;
  }
  
  clear() {
    while (this.vehicleGroup.children.length > 0) {
      const child = this.vehicleGroup.children[0];
      this.vehicleGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      if (child.children) {
        for (const c of child.children) {
          if (c.dispose) c.dispose();
        }
      }
    }
    this.vehicles = [];
  }
  
  getStats() {
    const majorCount = this.vehicles.filter(v => v.isMajor).length;
    const minorCount = this.vehicles.filter(v => !v.isMajor).length;
    return {
      total: this.vehicles.length,
      major: majorCount,
      minor: minorCount
    };
  }
  
  dispose() {
    this.clear();
  }
}

export { TrafficGenerator };
