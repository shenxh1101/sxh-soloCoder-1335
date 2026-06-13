import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { CameraController, CAMERA_MODES } from './core/CameraController.js';
import { TimeSystem } from './core/TimeSystem.js';
import { WeatherSystem } from './core/WeatherSystem.js';
import { RoadGenerator } from './city/RoadGenerator.js';
import { BuildingGenerator } from './city/BuildingGenerator.js';
import { TrafficGenerator } from './city/TrafficGenerator.js';
import { ZoneEditor } from './city/ZoneEditor.js';
import { UIController } from './ui/UIController.js';
import { downloadBlob } from './utils/helpers.js';

class CityApp {
  constructor() {
    this.canvas = document.getElementById('city-canvas');
    this.sceneManager = new SceneManager(this.canvas);
    this.cameraController = new CameraController(this.sceneManager.camera, this.canvas);
    this.timeSystem = new TimeSystem(this.sceneManager);
    this.weatherSystem = new WeatherSystem(this.sceneManager);
    this.ui = new UIController(this);
    
    this.zoneEditor = null;
    
    this.clock = new THREE.Clock();
    this.fpsFrames = 0;
    this.fpsTime = 0;
    
    this.init();
  }
  
  init() {
    this.cameraController.setMapSize(this.ui.params.mapSize);
    this.timeSystem.setTime(this.ui.params.timeOfDay);
    this.weatherSystem.setWeather(this.ui.params.weather, false);
    this.applyWeatherToMaterials();
    this.generateCity();
    this.animate();
  }
  
  createZoneEditor() {
    const params = this.ui.getParams();
    this.zoneEditor = new ZoneEditor(params.mapSize, {
      preset: params.zonePreset,
      commercialCenterX: params.zoneComX,
      commercialCenterZ: params.zoneComZ,
      commercialRadius: params.zoneComRadius,
      industrialAngle: params.zoneIndustrialAngle
    });
    return this.zoneEditor;
  }
  
  generateCity() {
    return new Promise((resolve) => {
      this.ui.showLoading();
      
      if (this.regenerateTimeout) clearTimeout(this.regenerateTimeout);
      
      this.regenerateTimeout = setTimeout(() => {
        const params = this.ui.getParams();
        const seed = Date.now() % 100000;
        
        this.sceneManager.clearCity();
        
        if (this.trafficGen) {
          this.trafficGen.dispose();
        }
        
        this.createZoneEditor();
        
        const roadGen = new RoadGenerator({
          mapSize: params.mapSize,
          roadType: params.roadType,
          seed
        }, this.zoneEditor);
        const roadData = roadGen.generate();
        
        this.buildingGen = new BuildingGenerator({
          mapSize: params.mapSize,
          density: params.density,
          minHeight: params.minHeight,
          maxHeight: params.maxHeight,
          waterRatio: params.waterRatio,
          seed
        }, this.zoneEditor);
        
        const buildingData = this.buildingGen.generate(roadData.plots);
        
        const ground = this.buildingGen.createGround();
        this.sceneManager.cityGroup.add(ground);
        
        const water = this.buildingGen.createWater();
        if (water) this.sceneManager.cityGroup.add(water);
        
        const roads = roadGen.createRoadMeshes();
        this.sceneManager.cityGroup.add(roads);
        
        const buildings = this.buildingGen.createInstancedBuildings(buildingData.zoneBuildings);
        this.sceneManager.cityGroup.add(buildings);
        
        const streetLights = this.buildingGen.createStreetLightMeshes();
        this.sceneManager.cityGroup.add(streetLights);
        
        let roadPaths = roadData.curvedRoadPaths || [];
        if (roadPaths.length === 0) {
          roadPaths = roadData.roadSegments.map(seg => ({
            points: [seg.start, seg.end],
            width: seg.width,
            isMajor: seg.isMajor,
            level: seg.isMajor ? 'major' : 'minor'
          }));
        }
        
        this.trafficGen = new TrafficGenerator(params.mapSize);
        const traffic = this.trafficGen.generate(roadPaths, params.roadType);
        this.sceneManager.cityGroup.add(traffic);
        
        this.cameraController.setMapSize(params.mapSize);
        
        this.applyTimeAndWeather();
        this.applyWeatherToMaterials();
        
        this.ui.updateBuildingCount(this.buildingGen.getBuildingCount());
        if (this.zoneEditor) {
          const zoneStats = this.zoneEditor.getStats(roadData.plots);
          this.ui.updateZoneStats(zoneStats);
        }
        
        this.ui.hideLoading();
        resolve();
      }, 50);
    });
  }
  
  regenerateCity() {
    return this.generateCity();
  }
  
  setCameraMode(mode) {
    this.cameraController.setMode(mode);
  }
  
  onTimeOfDayChange(hours) {
    this.timeSystem.setTime(hours);
    this.applyTimeAndWeather();
  }
  
  onWeatherChange(weatherType) {
    this.weatherSystem.setWeather(weatherType, true);
    this.applyTimeAndWeather();
    this.applyWeatherToMaterials();
  }
  
  applyTimeAndWeather() {
    const nightFactor = this.timeSystem.nightFactor;
    const weatherBoost = this.weatherSystem.getLightBoost();
    const headlightBoost = this.weatherSystem.getHeadlightBoost();
    
    if (this.buildingGen) {
      this.buildingGen.setWeatherBoost(weatherBoost);
      this.buildingGen.setNightEmissiveIntensity(nightFactor * 1.5);
      this.buildingGen.setStreetLightIntensity(nightFactor);
    }
    if (this.trafficGen) {
      this.trafficGen.setNightFactor(nightFactor);
      this.trafficGen.setWeatherBoost(headlightBoost);
    }
  }
  
  applyWeatherToMaterials() {
    if (!this.buildingGen) return;
    const buildingMods = this.weatherSystem.getBuildingMaterialModifiers();
    const groundMods = this.weatherSystem.getGroundMaterialModifiers();
    this.buildingGen.setMaterialModifiers(buildingMods, groundMods);
  }
  
  exportImage() {
    const originalPixelRatio = this.sceneManager.renderer.getPixelRatio();
    
    const targetWidth = window.innerWidth * 2;
    const targetHeight = window.innerHeight * 2;
    
    this.sceneManager.renderer.setPixelRatio(2);
    this.sceneManager.renderer.setSize(targetWidth, targetHeight, false);
    
    this.sceneManager.renderer.render(
      this.sceneManager.scene,
      this.sceneManager.camera
    );
    
    this.sceneManager.renderer.domElement.toBlob((blob) => {
      if (blob) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const params = this.ui.getParams();
        const weatherPart = params.weather || 'sunny';
        const timePart = params.timeOfDay.toFixed(1).replace('.', '-');
        downloadBlob(blob, `city-${weatherPart}-${timePart}h-${timestamp}.png`);
      }
      
      this.sceneManager.renderer.setPixelRatio(originalPixelRatio);
      this.sceneManager.renderer.setSize(window.innerWidth, window.innerHeight);
    }, 'image/png');
  }
  
  exportJSON() {
    if (!this.buildingGen) return;
    
    const params = this.ui.getParams();
    const extraMeta = {
      roadType: params.roadType,
      timeOfDay: params.timeOfDay,
      weather: params.weather,
      zonePreset: params.zonePreset,
      trafficStats: this.trafficGen ? this.trafficGen.getStats() : null
    };
    
    const data = this.buildingGen.getCityDataJSON(extraMeta);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob(blob, `city-data-${timestamp}.json`);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = Math.min(this.clock.getDelta(), 0.1);
    
    this.fpsFrames++;
    this.fpsTime += deltaTime;
    if (this.fpsTime >= 0.5) {
      this.ui.updateFPS(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    
    this.cameraController.update(deltaTime);
    this.weatherSystem.update(deltaTime);
    
    if (this.trafficGen) {
      this.trafficGen.update(deltaTime);
    }
    
    this.sceneManager.render();
  }
  
  dispose() {
    this.cameraController.dispose();
    this.weatherSystem.dispose();
    this.sceneManager.dispose();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new CityApp();
});
