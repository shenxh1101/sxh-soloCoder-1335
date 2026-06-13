import { formatTime, clamp } from '../utils/helpers.js';

const STORAGE_KEY = 'city_generator_presets_v1';

class UIController {
  constructor(app) {
    this.app = app;
    this.params = {
      mapSize: 200,
      density: 0.7,
      waterRatio: 0.1,
      roadType: 'grid',
      minHeight: 10,
      maxHeight: 80,
      timeOfDay: 12,
      weather: 'sunny',
      cameraMode: 'overview',
      zonePreset: 'auto',
      zoneComX: 0,
      zoneComZ: 0,
      zoneComRadius: 30,
      zoneIndustrialAngle: 180
    };
    
    this.presets = this.loadPresetsFromStorage();
    
    this.regeneratePending = false;
    this.regenerateScheduled = false;
    this.regenerateDebounceTimer = null;
    this.HEIGHT_GAP = 5;
    
    this.bindElements();
    this.bindEvents();
    this.refreshPresetList();
    this.updateUI();
  }
  
  bindElements() {
    this.elements = {
      togglePanel: document.getElementById('toggle-panel'),
      uiPanel: document.getElementById('ui-panel'),
      
      mapSize: document.getElementById('map-size'),
      mapSizeValue: document.getElementById('map-size-value'),
      density: document.getElementById('density'),
      densityValue: document.getElementById('density-value'),
      waterRatio: document.getElementById('water-ratio'),
      waterRatioValue: document.getElementById('water-ratio-value'),
      
      roadType: document.getElementById('road-type'),
      
      minHeight: document.getElementById('min-height'),
      minHeightValue: document.getElementById('min-height-value'),
      maxHeight: document.getElementById('max-height'),
      maxHeightValue: document.getElementById('max-height-value'),
      
      zonePreset: document.getElementById('zone-preset'),
      zoneComX: document.getElementById('zone-com-x'),
      zoneComXValue: document.getElementById('zone-com-x-value'),
      zoneComZ: document.getElementById('zone-com-z'),
      zoneComZValue: document.getElementById('zone-com-z-value'),
      zoneComRadius: document.getElementById('zone-com-radius'),
      zoneComRadiusValue: document.getElementById('zone-com-radius-value'),
      zoneIndustrialAngle: document.getElementById('zone-industrial-angle'),
      zoneIndustrialAngleValue: document.getElementById('zone-industrial-angle-value'),
      
      timeOfDay: document.getElementById('time-of-day'),
      timeValue: document.getElementById('time-value'),
      
      weather: document.getElementById('weather'),
      
      cameraMode: document.getElementById('camera-mode'),
      
      presetName: document.getElementById('preset-name'),
      presetList: document.getElementById('preset-list'),
      savePreset: document.getElementById('save-preset'),
      loadPreset: document.getElementById('load-preset'),
      deletePreset: document.getElementById('delete-preset'),
      
      regenerate: document.getElementById('regenerate'),
      exportImage: document.getElementById('export-image'),
      exportJson: document.getElementById('export-json'),
      
      fps: document.getElementById('fps'),
      buildingCount: document.getElementById('building-count'),
      
      loading: document.getElementById('loading')
    };
  }
  
  bindEvents() {
    this.elements.togglePanel.addEventListener('click', () => {
      this.elements.uiPanel.classList.toggle('collapsed');
      this.elements.togglePanel.textContent = this.elements.uiPanel.classList.contains('collapsed') ? '»' : '—';
    });
    
    this.bindRealTimeSlider('mapSize', 'mapSizeValue', v => parseInt(v));
    this.bindRealTimeSlider('density', 'densityValue', v => parseFloat(v).toFixed(2));
    this.bindRealTimeSlider('waterRatio', 'waterRatioValue', v => parseFloat(v).toFixed(2));
    
    this.bindHeightSlider('minHeight', 'minHeightValue', v => parseInt(v));
    this.bindHeightSlider('maxHeight', 'maxHeightValue', v => parseInt(v));
    
    this.bindZoneSlider('zoneComX', 'zoneComXValue', v => parseInt(v));
    this.bindZoneSlider('zoneComZ', 'zoneComZValue', v => parseInt(v));
    this.bindZoneSlider('zoneComRadius', 'zoneComRadiusValue', v => parseInt(v));
    this.bindZoneSlider('zoneIndustrialAngle', 'zoneIndustrialAngleValue', v => parseInt(v));
    
    this.bindSlider('timeOfDay', 'timeValue', v => formatTime(parseFloat(v)), true);
    
    this.elements.roadType.addEventListener('change', (e) => {
      this.params.roadType = e.target.value;
      this.scheduleRegenerate();
    });
    
    this.elements.zonePreset.addEventListener('change', (e) => {
      this.params.zonePreset = e.target.value;
      this.applyZonePreset(e.target.value);
      this.scheduleRegenerate();
    });
    
    this.elements.weather.addEventListener('change', (e) => {
      this.params.weather = e.target.value;
      if (this.app.onWeatherChange) {
        this.app.onWeatherChange(e.target.value);
      }
    });
    
    this.elements.cameraMode.addEventListener('change', (e) => {
      this.params.cameraMode = e.target.value;
      this.app.setCameraMode(e.target.value);
    });
    
    this.elements.savePreset.addEventListener('click', () => this.saveCurrentPreset());
    this.elements.loadPreset.addEventListener('click', () => this.loadSelectedPreset());
    this.elements.deletePreset.addEventListener('click', () => this.deleteSelectedPreset());
    
    this.elements.regenerate.addEventListener('click', () => {
      this.forceRegenerate();
    });
    
    this.elements.exportImage.addEventListener('click', () => {
      this.app.exportImage();
    });
    
    this.elements.exportJson.addEventListener('click', () => {
      this.app.exportJSON();
    });
  }
  
  applyZonePreset(presetName) {
    const presets = {
      auto:               { zoneComX: 0,    zoneComZ: 0,    zoneComRadius: 30, zoneIndustrialAngle: 180 },
      'center-commercial':{ zoneComX: 0,    zoneComZ: 0,    zoneComRadius: 45, zoneIndustrialAngle: 180 },
      'industrial-park':  { zoneComX: -30,  zoneComZ: -30,  zoneComRadius: 20, zoneIndustrialAngle: 45  },
      'residential-only': { zoneComX: 0,    zoneComZ: 0,    zoneComRadius: 5,  zoneIndustrialAngle: 0   },
      mixed:              { zoneComX: 10,   zoneComZ: 10,   zoneComRadius: 25, zoneIndustrialAngle: 270 }
    };
    const preset = presets[presetName];
    if (!preset) return;
    
    Object.assign(this.params, preset);
    this.syncZoneUI();
  }
  
  syncZoneUI() {
    const map = [
      ['zoneComX', 'zoneComXValue'],
      ['zoneComZ', 'zoneComZValue'],
      ['zoneComRadius', 'zoneComRadiusValue'],
      ['zoneIndustrialAngle', 'zoneIndustrialAngleValue']
    ];
    for (const [p, el] of map) {
      this.elements[p].value = this.params[p];
      this.elements[el].textContent = this.params[p];
    }
  }
  
  bindZoneSlider(paramName, valueId, formatFn) {
    const slider = this.elements[paramName];
    const valueEl = this.elements[valueId];
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.params[paramName] = value;
      valueEl.textContent = formatFn(value);
      this.params.zonePreset = 'custom';
      this.scheduleRegenerate();
    });
  }
  
  bindRealTimeSlider(paramName, valueId, formatFn) {
    const slider = this.elements[paramName];
    const valueEl = this.elements[valueId];
    
    slider.addEventListener('input', (e) => {
      const value = e.target.value;
      const parsedValue = ['density', 'waterRatio'].includes(paramName) ? parseFloat(value) : parseInt(value);
      this.params[paramName] = parsedValue;
      valueEl.textContent = formatFn(value);
      this.scheduleRegenerate();
    });
  }
  
  bindHeightSlider(paramName, valueId, formatFn) {
    const slider = this.elements[paramName];
    const valueEl = this.elements[valueId];
    
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      
      if (paramName === 'minHeight') {
        if (value >= this.params.maxHeight) {
          this.params.minHeight = clamp(value, 5, this.params.maxHeight - this.HEIGHT_GAP);
          slider.value = this.params.minHeight;
          this.params.maxHeight = Math.max(this.params.minHeight + this.HEIGHT_GAP, this.params.maxHeight);
          this.elements.maxHeight.value = this.params.maxHeight;
          this.elements.maxHeightValue.textContent = this.params.maxHeight;
        } else {
          this.params.minHeight = value;
        }
      } else if (paramName === 'maxHeight') {
        if (value <= this.params.minHeight) {
          this.params.maxHeight = clamp(value, this.params.minHeight + this.HEIGHT_GAP, 200);
          slider.value = this.params.maxHeight;
          this.params.minHeight = Math.min(this.params.maxHeight - this.HEIGHT_GAP, this.params.minHeight);
          this.elements.minHeight.value = this.params.minHeight;
          this.elements.minHeightValue.textContent = this.params.minHeight;
        } else {
          this.params.maxHeight = value;
        }
      }
      
      valueEl.textContent = formatFn(slider.value);
      this.scheduleRegenerate();
    });
  }
  
  bindSlider(paramName, valueId, formatFn, immediate) {
    const slider = this.elements[paramName];
    const valueEl = this.elements[valueId];
    
    slider.addEventListener('input', (e) => {
      const value = e.target.value;
      this.params[paramName] = paramName === 'timeOfDay' ? parseFloat(value) : 
        (['density', 'waterRatio'].includes(paramName) ? parseFloat(value) : parseInt(value));
      valueEl.textContent = formatFn(value);
      
      if (immediate && this.app['on' + paramName.charAt(0).toUpperCase() + paramName.slice(1) + 'Change']) {
        this.app['on' + paramName.charAt(0).toUpperCase() + paramName.slice(1) + 'Change'](this.params[paramName]);
      }
    });
    
    slider.addEventListener('change', () => {
      if (!immediate) {
        this.scheduleRegenerate();
      }
    });
  }
  
  scheduleRegenerate() {
    if (this.regenerateDebounceTimer) {
      clearTimeout(this.regenerateDebounceTimer);
    }
    
    this.regenerateDebounceTimer = setTimeout(() => {
      if (this.regeneratePending) {
        this.regenerateScheduled = true;
        return;
      }
      
      this.executeRegenerate();
    }, 150);
  }
  
  async executeRegenerate() {
    this.regeneratePending = true;
    this.regenerateScheduled = false;
    
    try {
      await this.app.regenerateCity();
    } finally {
      this.regeneratePending = false;
      
      if (this.regenerateScheduled) {
        this.regenerateScheduled = false;
        setTimeout(() => this.executeRegenerate(), 50);
      }
    }
  }
  
  forceRegenerate() {
    if (this.regenerateDebounceTimer) {
      clearTimeout(this.regenerateDebounceTimer);
    }
    this.regenerateScheduled = false;
    this.executeRegenerate();
  }
  
  loadPresetsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  
  savePresetsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets));
    } catch (e) {
      console.warn('Failed to save presets:', e);
    }
  }
  
  refreshPresetList() {
    const list = this.elements.presetList;
    list.innerHTML = '<option value="">-- 选择方案 --</option>';
    const names = Object.keys(this.presets).sort();
    for (const name of names) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      list.appendChild(opt);
    }
  }
  
  saveCurrentPreset() {
    const nameInput = this.elements.presetName;
    const name = (nameInput.value || '').trim();
    if (!name) {
      nameInput.focus();
      nameInput.placeholder = '请输入方案名称...';
      return;
    }
    
    this.presets[name] = {
      ...this.getParams(),
      savedAt: new Date().toISOString()
    };
    this.savePresetsToStorage();
    this.refreshPresetList();
    this.elements.presetList.value = name;
    nameInput.value = '';
    nameInput.placeholder = `已保存: ${name}`;
  }
  
  loadSelectedPreset() {
    const name = this.elements.presetList.value;
    if (!name || !this.presets[name]) return;
    
    const preset = this.presets[name];
    Object.assign(this.params, preset);
    this.updateUI();
    
    if (this.app.onWeatherChange && preset.weather) {
      this.app.onWeatherChange(preset.weather);
    }
    if (this.app.setCameraMode && preset.cameraMode) {
      this.app.setCameraMode(preset.cameraMode);
    }
    if (this.app.onTimeOfDayChange && preset.timeOfDay !== undefined) {
      this.app.onTimeOfDayChange(preset.timeOfDay);
    }
    
    this.scheduleRegenerate();
  }
  
  deleteSelectedPreset() {
    const name = this.elements.presetList.value;
    if (!name || !this.presets[name]) return;
    
    if (!confirm(`确定删除方案"${name}"吗？`)) return;
    
    delete this.presets[name];
    this.savePresetsToStorage();
    this.refreshPresetList();
  }
  
  updateUI() {
    this.elements.mapSize.value = this.params.mapSize;
    this.elements.mapSizeValue.textContent = this.params.mapSize;
    
    this.elements.density.value = this.params.density;
    this.elements.densityValue.textContent = this.params.density.toFixed(2);
    
    this.elements.waterRatio.value = this.params.waterRatio;
    this.elements.waterRatioValue.textContent = this.params.waterRatio.toFixed(2);
    
    this.elements.roadType.value = this.params.roadType;
    
    this.elements.minHeight.value = this.params.minHeight;
    this.elements.minHeightValue.textContent = this.params.minHeight;
    
    this.elements.maxHeight.value = this.params.maxHeight;
    this.elements.maxHeightValue.textContent = this.params.maxHeight;
    
    this.elements.timeOfDay.value = this.params.timeOfDay;
    this.elements.timeValue.textContent = formatTime(this.params.timeOfDay);
    
    this.elements.weather.value = this.params.weather || 'sunny';
    this.elements.cameraMode.value = this.params.cameraMode;
    
    this.elements.zonePreset.value = this.params.zonePreset || 'auto';
    this.syncZoneUI();
  }
  
  showLoading() {
    this.elements.loading.classList.remove('hidden');
  }
  
  hideLoading() {
    this.elements.loading.classList.add('hidden');
  }
  
  updateFPS(fps) {
    this.elements.fps.textContent = Math.round(fps);
  }
  
  updateBuildingCount(count) {
    this.elements.buildingCount.textContent = count;
  }
  
  updateZoneStats(stats) {
  }
  
  getParams() {
    return { ...this.params };
  }
}

export { UIController };
