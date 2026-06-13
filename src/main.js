import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { CameraController, CAMERA_MODES } from './core/CameraController.js';
import { TimeSystem } from './core/TimeSystem.js';
import { WeatherSystem } from './core/WeatherSystem.js';
import { ATMOSPHERE_PRESETS } from './core/WeatherSystem.js';
import { RoadGenerator } from './city/RoadGenerator.js';
import { BuildingGenerator } from './city/BuildingGenerator.js';
import { TrafficGenerator } from './city/TrafficGenerator.js';
import { ZoneEditor } from './city/ZoneEditor.js';
import { ZonePainter } from './city/ZonePainter.js';
import { UIController } from './ui/UIController.js';
import { downloadBlob } from './utils/helpers.js';

const LAST_PRESET_KEY = 'city_generator_last_preset';

class CityApp {
  constructor() {
    this.canvas = document.getElementById('city-canvas');
    this.sceneManager = new SceneManager(this.canvas);
    this.cameraController = new CameraController(this.sceneManager.camera, this.canvas);
    this.timeSystem = new TimeSystem(this.sceneManager);
    this.weatherSystem = new WeatherSystem(this.sceneManager);
    this.zonePainter = null;
    
    this.zoneEditor = null;
    this.buildingGen = null;
    this.trafficGen = null;
    
    this.clock = new THREE.Clock();
    this.fpsFrames = 0;
    this.fpsTime = 0;
    
    this.ui = new UIController(this);
    this.init();
  }
  
  init() {
    this.cameraController.setMapSize(this.ui.params.mapSize);
    this.timeSystem.setTime(this.ui.params.timeOfDay);
    this.weatherSystem.setWeather(this.ui.params.weather, false);
    
    this.zonePainter = new ZonePainter(this.ui.params.mapSize);
    this.zonePainter.setCamera(this.sceneManager.camera);
    this.zonePainter.onChange(() => {});
    
    this.applyWeatherToMaterials();
    this.generateCity();
    this.animate();
    
    this.loadLastPreset();
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
    this.zoneEditor.setZonePainter(this.zonePainter);
    this.zoneEditor.setUsePainter(params.zonePreset === 'paint');
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
        
        if (this.zonePainter && params.mapSize !== this.zonePainter.mapSize) {
          this.zonePainter.setMapSize(params.mapSize);
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
        
        this.cameraController.setRoadPaths(roadPaths);
        
        this.trafficGen = new TrafficGenerator(params.mapSize);
        this.trafficGen.setTimeOfDay(params.timeOfDay);
        this.trafficGen.setNightFactor(this.timeSystem.nightFactor);
        this.trafficGen.setWeatherBoost(this.weatherSystem.getHeadlightBoost());
        
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
    this.ui.params.timeOfDay = hours;
    if (this.trafficGen) {
      this.trafficGen.setTimeOfDay(hours);
    }
    this.applyTimeAndWeather();
  }
  
  onWeatherChange(weatherType) {
    this.weatherSystem.setWeather(weatherType, true);
    this.applyTimeAndWeather();
    this.applyWeatherToMaterials();
  }
  
  applyAtmospherePreset(presetKey) {
    const preset = ATMOSPHERE_PRESETS[presetKey];
    if (!preset) return;
    
    this.weatherSystem.setWeather(preset.weather, true);
    this.timeSystem.setTime(preset.time);
    this.ui.params.weather = preset.weather;
    this.ui.params.timeOfDay = preset.time;
    
    if (this.trafficGen) {
      this.trafficGen.setTimeOfDay(preset.time);
    }
    
    this.applyTimeAndWeather();
    this.applyWeatherToMaterials();
    this.ui.updateUI();
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
  
  setPaintMode(active) {
    if (this.zonePainter) {
      this.zonePainter.setActive(active);
    }
  }
  
  undoPaint() {
    if (this.zonePainter) {
      return this.zonePainter.undo();
    }
    return false;
  }
  
  redoPaint() {
    if (this.zonePainter) {
      return this.zonePainter.redo();
    }
    return false;
  }
  
  setAutoFollow(enabled) {
    if (this.cameraController) {
      this.cameraController.setAutoFollow(enabled);
    }
  }
  
  setAutoFollowSpeed(speed) {
    if (this.cameraController) {
      this.cameraController.setAutoFollowSpeed(speed);
    }
  }
  
  getZonePainter() {
    return this.zonePainter;
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
    
    if (this.zonePainter && this.zonePainter.hasPaintData() && params.zonePreset === 'paint') {
      data.zones.paintData = this.zonePainter.serialize();
    }
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob(blob, `city-data-${timestamp}.json`);
  }
  
  saveCurrentPreset(name) {
    if (!name) return null;
    
    const params = this.ui.getParams();
    const preset = {
      ...params,
      savedAt: new Date().toISOString()
    };
    
    if (this.zonePainter && this.zonePainter.hasPaintData()) {
      preset.paintData = this.zonePainter.serialize();
    }
    
    this.saveLastPresetName(name);
    return preset;
  }
  
  loadPreset(preset) {
    if (!preset) return;
    
    this.ui.loadParamsFromPreset(preset);
    
    if (preset.paintData && this.zonePainter) {
      this.zonePainter.deserialize(preset.paintData);
    }
    
    if (this.weatherSystem && preset.weather) {
      this.weatherSystem.setWeather(preset.weather, false);
    }
    
    if (this.timeSystem && preset.timeOfDay !== undefined) {
      this.timeSystem.setTime(preset.timeOfDay);
    }
    
    if (this.cameraController && preset.cameraMode) {
      this.cameraController.setMode(preset.cameraMode);
    }
    
    this.applyWeatherToMaterials();
    this.scheduleRegenerate();
  }
  
  scheduleRegenerate() {
    this.ui.scheduleRegenerate();
  }
  
  saveLastPresetName(name) {
    try {
      localStorage.setItem(LAST_PRESET_KEY, name);
    } catch (e) {}
  }
  
  loadLastPreset() {
    try {
      const lastName = localStorage.getItem(LAST_PRESET_KEY);
      if (lastName && this.ui.presets && this.ui.presets[lastName]) {
        this.ui.setCurrentPresetName(lastName);
      }
    } catch (e) {}
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
    
    if (this.zonePainter && this.zonePainter.isActive) {
      this.zonePainter.render();
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
