import * as THREE from 'three';

const WEATHER_PRESETS = {
  sunny: {
    name: '晴天',
    skyColor: 0x87ceeb,
    fogColor: 0xb0d8ff,
    fogDensity: 0.0015,
    ambientIntensity: 0.45,
    sunIntensity: 1.3,
    sunColor: 0xffffff,
    hemisphereIntensity: 0.35,
    groundRoughness: 0.9,
    groundMetalness: 0.0,
    buildingRoughness: 0.7,
    buildingMetalness: 0.15,
    lightBoost: 1.0,
    headlightBoost: 1.0,
    toneMappingExposure: 1.1
  },
  cloudy: {
    name: '阴天',
    skyColor: 0x8a8a9a,
    fogColor: 0x9a9aaa,
    fogDensity: 0.003,
    ambientIntensity: 0.55,
    sunIntensity: 0.5,
    sunColor: 0xc0c0d0,
    hemisphereIntensity: 0.45,
    groundRoughness: 0.95,
    groundMetalness: 0.02,
    buildingRoughness: 0.8,
    buildingMetalness: 0.08,
    lightBoost: 1.1,
    headlightBoost: 1.2,
    toneMappingExposure: 0.95
  },
  rainy: {
    name: '雨夜',
    skyColor: 0x1a1a2e,
    fogColor: 0x2a2a3e,
    fogDensity: 0.006,
    ambientIntensity: 0.3,
    sunIntensity: 0.1,
    sunColor: 0x334466,
    hemisphereIntensity: 0.2,
    groundRoughness: 0.2,
    groundMetalness: 0.4,
    buildingRoughness: 0.3,
    buildingMetalness: 0.35,
    lightBoost: 1.5,
    headlightBoost: 2.0,
    toneMappingExposure: 0.7
  }
};

class WeatherSystem {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.currentWeather = 'sunny';
    this.currentPreset = { ...WEATHER_PRESETS.sunny };
    this.targetPreset = { ...WEATHER_PRESETS.sunny };
    this.transitionProgress = 1;
    this.raindrops = null;
    this.rainVelocity = null;
    this.raining = false;
  }
  
  setWeather(weatherType, animate = true) {
    if (!WEATHER_PRESETS[weatherType]) return;
    
    this.currentWeather = weatherType;
    this.targetPreset = { ...WEATHER_PRESETS[weatherType] };
    
    if (!animate) {
      this.currentPreset = { ...this.targetPreset };
      this.transitionProgress = 1;
      this.applyWeather();
    } else {
      this.transitionProgress = 0;
    }
    
    const shouldRain = weatherType === 'rainy';
    if (shouldRain && !this.raining) {
      this.createRain();
    } else if (!shouldRain && this.raining) {
      this.removeRain();
    }
  }
  
  createRain() {
    const rainCount = 8000;
    const rainGeometry = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    this.rainVelocity = new Float32Array(rainCount);
    
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 1000;
      rainPositions[i * 3 + 1] = Math.random() * 400;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
      this.rainVelocity[i] = 15 + Math.random() * 10;
    }
    
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    
    const rainMaterial = new THREE.PointsMaterial({
      color: 0x88aaff,
      size: 0.6,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true
    });
    
    this.raindrops = new THREE.Points(rainGeometry, rainMaterial);
    this.sceneManager.scene.add(this.raindrops);
    this.raining = true;
  }
  
  removeRain() {
    if (this.raindrops) {
      this.sceneManager.scene.remove(this.raindrops);
      this.raindrops.geometry.dispose();
      this.raindrops.material.dispose();
      this.raindrops = null;
    }
    this.raining = false;
  }
  
  update(deltaTime) {
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + deltaTime * 1.5);
      this.lerpPreset();
      this.applyWeather();
    }
    
    if (this.raining && this.raindrops) {
      const positions = this.raindrops.geometry.attributes.position.array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] -= this.rainVelocity[i] * deltaTime;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 400;
          positions[i * 3] = (Math.random() - 0.5) * 1000;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
        }
      }
      this.raindrops.geometry.attributes.position.needsUpdate = true;
      
      if (this.raindrops.material.opacity < this.targetPreset === WEATHER_PRESETS.rainy ? 0.4 : 0) {
        this.raindrops.material.opacity += deltaTime;
      }
    }
  }
  
  lerpPreset() {
    const t = this.transitionProgress;
    const current = this.currentPreset;
    const target = this.targetPreset;
    
    for (const key of Object.keys(target)) {
      if (typeof target[key] === 'number') {
        current[key] = current[key] + (target[key] - current[key]) * t;
      }
    }
  }
  
  applyWeather() {
    const p = this.currentPreset;
    
    this.sceneManager.setSkyColor(p.skyColor, p.fogColor);
    this.sceneManager.scene.fog.density = p.fogDensity;
    this.sceneManager.setAmbientIntensity(p.ambientIntensity);
    this.sceneManager.setSunIntensity(p.sunIntensity);
    this.sceneManager.setSunColor(p.sunColor);
    this.sceneManager.setHemisphereIntensity(p.hemisphereIntensity);
    this.sceneManager.renderer.toneMappingExposure = p.toneMappingExposure;
  }
  
  getLightBoost() {
    return this.currentPreset.lightBoost;
  }
  
  getHeadlightBoost() {
    return this.currentPreset.headlightBoost;
  }
  
  getGroundMaterialModifiers() {
    return {
      roughness: this.currentPreset.groundRoughness,
      metalness: this.currentPreset.groundMetalness
    };
  }
  
  getBuildingMaterialModifiers() {
    return {
      roughness: this.currentPreset.buildingRoughness,
      metalness: this.currentPreset.buildingMetalness
    };
  }
  
  getWeatherType() {
    return this.currentWeather;
  }
  
  dispose() {
    this.removeRain();
  }
}

export { WeatherSystem, WEATHER_PRESETS };
