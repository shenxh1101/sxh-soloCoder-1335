import * as THREE from 'three';
import { randomRange, randomInt } from '../utils/helpers.js';

class TrafficGenerator {
  constructor(mapSize) {
    this.mapSize = mapSize;
    this.halfMap = mapSize / 2;
    this.vehicles = [];
    this.vehicleGroup = new THREE.Group();
    this.nightFactor = 0;
  }
  
  generate(roadPaths) {
    this.vehicles = [];
    this.clear();
    
    const numVehicles = Math.min(150, Math.floor(this.mapSize * 0.4));
    const numLightVehicles = Math.min(30, Math.floor(this.mapSize * 0.08));
    
    for (let i = 0; i < numVehicles; i++) {
      const roadPath = roadPaths[Math.floor(Math.random() * roadPaths.length)];
      if (!roadPath || roadPath.points.length < 2) continue;
      
      const hasLight = i < numLightVehicles;
      const vehicle = this.createVehicle(roadPath, hasLight);
      if (vehicle) {
        this.vehicles.push(vehicle);
        this.vehicleGroup.add(vehicle.mesh);
        if (vehicle.headlightMesh) this.vehicleGroup.add(vehicle.headlightMesh);
      }
    }
    
    return this.vehicleGroup;
  }
  
  createVehicle(roadPath, hasLight = false) {
    const points = roadPath.points;
    const t = Math.random();
    const pointIndex = Math.floor(t * (points.length - 1));
    const pointT = (t * (points.length - 1)) % 1;
    
    const p1 = points[pointIndex];
    const p2 = points[Math.min(pointIndex + 1, points.length - 1)];
    
    const x = p1.x + (p2.x - p1.x) * pointT;
    const z = p1.z + (p2.z - p1.z) * pointT;
    
    const isMajor = roadPath.isMajor;
    const speed = isMajor ? randomRange(0.6, 1.2) : randomRange(0.3, 0.7);
    const direction = Math.random() > 0.5 ? 1 : -1;
    
    const vehicleType = Math.random();
    let headlightColor, headlightIntensity;
    
    if (vehicleType < 0.7) {
      headlightColor = new THREE.Color(0xffffee);
      headlightIntensity = randomRange(0.8, 1.5);
    } else if (vehicleType < 0.9) {
      headlightColor = new THREE.Color(0xffaa44);
      headlightIntensity = randomRange(0.6, 1.0);
    } else {
      headlightColor = new THREE.Color(0xffffff);
      headlightIntensity = randomRange(1.2, 2.0);
    }
    
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.3, 1.5);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.5, 0.3),
      transparent: true,
      opacity: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(x, 0.2, z);
    
    const headlightGeometry = new THREE.SphereGeometry(hasLight ? 0.2 : 0.1, 8, 8);
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
        isMajor ? 10 : 6,
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
      direction,
      isMajor,
      headlightColor,
      headlightIntensity,
      hasLight
    };
  }
  
  update(deltaTime) {
    for (const vehicle of this.vehicles) {
      const points = vehicle.path.points;
      if (points.length < 2) continue;
      
      vehicle.pathT += vehicle.direction * vehicle.speed * deltaTime * 0.15;
      
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
      
      const nightIntensity = this.nightFactor * vehicle.headlightIntensity;
      const dayIntensity = 0.1 * vehicle.headlightIntensity * (1 - this.nightFactor);
      const totalIntensity = nightIntensity + dayIntensity;
      
      if (vehicle.light) {
        vehicle.light.intensity = totalIntensity;
      }
      const headlightBrightness = this.nightFactor * 0.9 + (1 - this.nightFactor) * 0.1;
      vehicle.headlightMesh.material.opacity = headlightBrightness;
      if (vehicle.hasLight) {
        vehicle.headlightMesh.scale.setScalar(1 + headlightBrightness * 0.5);
      }
      vehicle.mesh.material.opacity = this.nightFactor * 0.4 + (1 - this.nightFactor) * 0.2;
    }
  }
  
  setNightFactor(factor) {
    this.nightFactor = factor;
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
  
  dispose() {
    this.clear();
  }
}

export { TrafficGenerator };
