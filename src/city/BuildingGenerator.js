import * as THREE from 'three';
import { SimplexNoise } from '../utils/Noise.js';
import { randomRange, randomInt, clamp } from '../utils/helpers.js';
import { TextureGenerator } from './TextureGenerator.js';

class BuildingGenerator {
  constructor(params) {
    this.mapSize = params.mapSize;
    this.halfMap = this.mapSize / 2;
    this.density = params.density;
    this.minHeight = params.minHeight;
    this.maxHeight = params.maxHeight;
    this.waterRatio = params.waterRatio;
    this.seed = params.seed || 42;
    this.noise = new SimplexNoise(this.seed);
    this.textureGen = new TextureGenerator(this.seed);
    this.buildingData = [];
    this.streetLights = [];
  }
  
  generate(plots) {
    this.buildingData = [];
    this.streetLights = [];
    this.waterMask = this.createWaterMask();
    
    const zoneBuildings = {
      commercial: [],
      residential: [],
      industrial: []
    };
    
    for (const plot of plots) {
      if (this.isWater(plot.x, plot.z)) continue;
      
      const numBuildings = this.calculateBuildingsPerPlot(plot);
      
      for (let i = 0; i < numBuildings; i++) {
        if (Math.random() > this.density) continue;
        
        const offsetX = randomRange(-plot.width * 0.3, plot.width * 0.3);
        const offsetZ = randomRange(-plot.depth * 0.3, plot.depth * 0.3);
        
        const buildingPlot = {
          x: plot.x + offsetX,
          z: plot.z + offsetZ,
          width: plot.width / Math.max(1, Math.sqrt(numBuildings)) * randomRange(0.7, 0.95),
          depth: plot.depth / Math.max(1, Math.sqrt(numBuildings)) * randomRange(0.7, 0.95),
          zone: plot.zone,
          rotation: plot.rotation
        };
        
        const height = this.calculateBuildingHeight(buildingPlot);
        if (height < this.minHeight * 0.3) continue;
        if (buildingPlot.width < 2 || buildingPlot.depth < 2) continue;
        
        const building = {
          x: buildingPlot.x,
          z: buildingPlot.z,
          width: buildingPlot.width,
          depth: buildingPlot.depth,
          height,
          zone: plot.zone,
          rotation: plot.rotation + randomRange(-0.1, 0.1),
          seed: Math.floor(Math.random() * 10000)
        };
        
        this.buildingData.push(building);
        zoneBuildings[plot.zone].push(building);
      }
    }
    
    this.generateStreetLights();
    
    return { zoneBuildings, waterMask: this.waterMask, streetLights: this.streetLights };
  }
  
  calculateBuildingsPerPlot(plot) {
    const area = plot.width * plot.depth;
    let baseCount = 1;
    
    if (plot.zone === 'residential') {
      baseCount = Math.min(4, Math.max(1, Math.floor(area / 30)));
    } else if (plot.zone === 'commercial') {
      baseCount = Math.min(2, Math.max(1, Math.floor(area / 80)));
    } else {
      baseCount = Math.min(3, Math.max(1, Math.floor(area / 50)));
    }
    
    return baseCount;
  }
  
  calculateBuildingHeight(plot) {
    const centerDist = Math.sqrt(plot.x * plot.x + plot.z * plot.z) / this.halfMap;
    const distFactor = 1 - centerDist * 0.7;
    
    let heightMultiplier = 1;
    switch (plot.zone) {
      case 'commercial':
        heightMultiplier = 1.5 + distFactor * 0.8;
        break;
      case 'residential':
        heightMultiplier = 0.4 + distFactor * 0.3;
        break;
      case 'industrial':
        heightMultiplier = 0.5 + Math.random() * 0.5;
        break;
    }
    
    const noiseFactor = 0.8 + this.noise.fbm(plot.x * 0.02, plot.z * 0.02, 3) * 0.4;
    const randomFactor = 0.7 + Math.random() * 0.6;
    
    const height = this.minHeight + 
      (this.maxHeight - this.minHeight) * heightMultiplier * noiseFactor * randomFactor * 0.5;
    
    return clamp(height, this.minHeight * 0.5, this.maxHeight);
  }
  
  createWaterMask() {
    const resolution = 100;
    const mask = [];
    
    for (let i = 0; i < resolution; i++) {
      mask[i] = [];
      for (let j = 0; j < resolution; j++) {
        const x = (i / resolution - 0.5) * this.mapSize;
        const z = (j / resolution - 0.5) * this.mapSize;
        
        let waterNoise = this.noise.fbm(x * 0.008, z * 0.008, 4);
        waterNoise += this.noise.fbm(x * 0.02, z * 0.02, 2) * 0.3;
        
        const threshold = 1 - this.waterRatio * 2;
        mask[i][j] = waterNoise > threshold;
      }
    }
    
    return mask;
  }
  
  isWater(x, z) {
    if (!this.waterMask) return false;
    const resolution = this.waterMask.length;
    const i = Math.floor((x / this.mapSize + 0.5) * resolution);
    const j = Math.floor((z / this.mapSize + 0.5) * resolution);
    
    if (i < 0 || i >= resolution || j < 0 || j >= resolution) return false;
    return this.waterMask[i][j];
  }
  
  generateStreetLights() {
    const spacing = 25;
    const halfCells = Math.floor(this.halfMap / spacing);
    
    for (let gx = -halfCells; gx <= halfCells; gx++) {
      for (let gz = -halfCells; gz <= halfCells; gz++) {
        const x = gx * spacing;
        const z = gz * spacing;
        
        if (this.isWater(x, z)) continue;
        if (Math.abs(x) > this.halfMap - 5 || Math.abs(z) > this.halfMap - 5) continue;
        
        if (Math.random() < 0.6) {
          this.streetLights.push({
            x: x + randomRange(-3, 3),
            z: z + randomRange(-3, 3),
            intensity: randomRange(0.8, 1.2)
          });
        }
      }
    }
  }
  
  createInstancedBuildings(zoneBuildings) {
    const group = new THREE.Group();
    this.instancedMeshes = [];
    
    for (const zone of ['commercial', 'residential', 'industrial']) {
      const buildings = zoneBuildings[zone];
      if (buildings.length === 0) continue;
      
      const templates = this.createBuildingTemplates(zone, buildings);
      
      for (const template of templates) {
        const { geometry, material, buildings: templateBuildings } = template;
        
        const instancedMesh = new THREE.InstancedMesh(
          geometry,
          material,
          templateBuildings.length
        );
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        
        for (let i = 0; i < templateBuildings.length; i++) {
          const b = templateBuildings[i];
          
          dummy.position.set(b.x, b.height / 2, b.z);
          dummy.scale.set(b.width / template.baseWidth, b.height / template.baseHeight, b.depth / template.baseDepth);
          dummy.rotation.y = b.rotation;
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
          
          if (material.vertexColors) {
            const brightness = 0.85 + Math.random() * 0.3;
            color.setHSL(0, 0, brightness);
            instancedMesh.setColorAt(i, color);
          }
        }
        
        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        
        this.instancedMeshes.push(instancedMesh);
        group.add(instancedMesh);
      }
    }
    
    return group;
  }
  
  createBuildingTemplates(zone, buildings) {
    const templates = [];
    const numTemplates = Math.min(5, Math.ceil(buildings.length / 50));
    
    const heightBuckets = {};
    for (const b of buildings) {
      const bucket = Math.floor(b.height / 20);
      if (!heightBuckets[bucket]) heightBuckets[bucket] = [];
      heightBuckets[bucket].push(b);
    }
    
    let bucketIdx = 0;
    for (const bucket of Object.keys(heightBuckets)) {
      const bucketBuildings = heightBuckets[bucket];
      const templateIdx = bucketIdx % numTemplates;
      
      if (!templates[templateIdx]) {
        const avgHeight = bucketBuildings.reduce((s, b) => s + b.height, 0) / bucketBuildings.length;
        templates[templateIdx] = this.createSingleTemplate(zone, avgHeight, templateIdx);
        templates[templateIdx].buildings = [];
      }
      
      for (const b of bucketBuildings) {
        templates[templateIdx].buildings.push(b);
      }
      bucketIdx++;
    }
    
    return templates.filter(t => t && t.buildings && t.buildings.length > 0);
  }
  
  createSingleTemplate(zone, height, seed) {
    const baseWidth = randomRange(5, 10);
    const baseDepth = randomRange(5, 10);
    const baseHeight = height;
    
    let geometry;
    
    if (zone === 'commercial' && height > 40) {
      geometry = this.createSkyscraperGeometry(baseWidth, baseHeight, baseDepth);
    } else if (zone === 'industrial') {
      geometry = this.createIndustrialGeometry(baseWidth, baseHeight, baseDepth);
    } else if (zone === 'residential') {
      geometry = this.createResidentialGeometry(baseWidth, baseHeight, baseDepth);
    } else {
      geometry = this.createBoxGeometry(baseWidth, baseHeight, baseDepth);
    }
    
    const texData = this.textureGen.createBuildingTexture(zone, height, seed);
    const emissiveMap = this.textureGen.createWindowEmissiveMap(zone, height, seed);
    
    const material = new THREE.MeshStandardMaterial({
      map: texData.texture,
      emissiveMap: emissiveMap,
      emissive: new THREE.Color(0xffffaa),
      emissiveIntensity: 0.0,
      roughness: zone === 'commercial' ? 0.5 : 0.8,
      metalness: zone === 'commercial' ? 0.3 : 0.05
    });
    
    material.userData = { emissiveMap, zone, baseHeight };
    
    return {
      geometry,
      material,
      baseWidth,
      baseHeight,
      baseDepth,
      buildings: []
    };
  }
  
  createBoxGeometry(w, h, d) {
    return new THREE.BoxGeometry(w, h, d);
  }
  
  createSkyscraperGeometry(w, h, d) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    return geometry;
  }
  
  createIndustrialGeometry(w, h, d) {
    const geometry = new THREE.BoxGeometry(w, h * 0.7, d);
    return geometry;
  }
  
  createResidentialGeometry(w, h, d) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    return geometry;
  }
  
  setNightEmissiveIntensity(intensity) {
    if (!this.instancedMeshes) return;
    for (const mesh of this.instancedMeshes) {
      if (mesh.material && mesh.material.emissiveIntensity !== undefined) {
        mesh.material.emissiveIntensity = intensity;
      }
    }
  }
  
  createGround() {
    const groundTexture = this.textureGen.createGroundTexture();
    const pavementTexture = this.textureGen.createPavementTexture();
    
    const groundGeometry = new THREE.PlaneGeometry(this.mapSize * 1.5, this.mapSize * 1.5);
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.95,
      metalness: 0.0
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    
    return ground;
  }
  
  createWater() {
    if (this.waterRatio <= 0) return null;
    
    const waterTexture = this.textureGen.createWaterTexture();
    
    const waterGeometry = new THREE.PlaneGeometry(this.mapSize * 1.2, this.mapSize * 1.2, 50, 50);
    const waterMaterial = new THREE.MeshStandardMaterial({
      map: waterTexture,
      color: 0x1e5799,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.3
    });
    
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.1;
    
    const maskResolution = this.waterMask.length;
    const positions = waterGeometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      
      const mi = Math.floor((x / (this.mapSize * 1.2) + 0.5) * maskResolution);
      const mj = Math.floor((z / (this.mapSize * 1.2) + 0.5) * maskResolution);
      
      let isWater = false;
      if (mi >= 0 && mi < maskResolution && mj >= 0 && mj < maskResolution) {
        isWater = this.waterMask[mi][mj];
      }
      
      if (!isWater) {
        positions.setZ(i, -100);
      }
    }
    
    waterGeometry.computeVertexNormals();
    
    return water;
  }
  
  createStreetLightMeshes() {
    const group = new THREE.Group();
    this.lightObjects = [];
    
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.15, 5, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const bulbGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    
    for (const light of this.streetLights) {
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(light.x, 2.5, light.z);
      pole.castShadow = true;
      group.add(pole);
      
      const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
      bulb.position.set(light.x, 5.2, light.z);
      group.add(bulb);
      
      const pointLight = new THREE.PointLight(0xffdd88, 0, 20, 2);
      pointLight.position.set(light.x, 5, light.z);
      pointLight.userData.baseIntensity = light.intensity * 0.5;
      group.add(pointLight);
      this.lightObjects.push(pointLight);
    }
    
    return group;
  }
  
  setStreetLightIntensity(intensity) {
    if (!this.lightObjects) return;
    for (const light of this.lightObjects) {
      light.intensity = intensity * light.userData.baseIntensity;
    }
  }
  
  getBuildingCount() {
    return this.buildingData.length;
  }
  
  getCityDataJSON() {
    return {
      metadata: {
        mapSize: this.mapSize,
        density: this.density,
        minHeight: this.minHeight,
        maxHeight: this.maxHeight,
        waterRatio: this.waterRatio,
        seed: this.seed,
        buildingCount: this.buildingData.length,
        streetLightCount: this.streetLights.length,
        generatedAt: new Date().toISOString()
      },
      buildings: this.buildingData.map(b => ({
        position: { x: b.x, z: b.z },
        dimensions: { width: b.width, height: b.height, depth: b.depth },
        zone: b.zone,
        rotation: b.rotation
      })),
      streetLights: this.streetLights.map(l => ({
        position: { x: l.x, z: l.z },
        intensity: l.intensity
      })),
      zones: {
        commercial: this.buildingData.filter(b => b.zone === 'commercial').length,
        residential: this.buildingData.filter(b => b.zone === 'residential').length,
        industrial: this.buildingData.filter(b => b.zone === 'industrial').length
      }
    };
  }
}

export { BuildingGenerator };
