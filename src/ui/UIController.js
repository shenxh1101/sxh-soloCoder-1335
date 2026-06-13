import { formatTime, clamp } from '../utils/helpers.js';

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
      cameraMode: 'overview'
    };
    
    this.regeneratePending = false;
    this.regenerateScheduled = false;
    this.regenerateDebounceTimer = null;
    this.HEIGHT_GAP = 5;
    
    this.bindElements();
    this.bindEvents();
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
      
      timeOfDay: document.getElementById('time-of-day'),
      timeValue: document.getElementById('time-value'),
      
      cameraMode: document.getElementById('camera-mode'),
      
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
    
    this.bindSlider('timeOfDay', 'timeValue', v => formatTime(parseFloat(v)), true);
    
    this.elements.roadType.addEventListener('change', (e) => {
      this.params.roadType = e.target.value;
      this.scheduleRegenerate();
    });
    
    this.elements.cameraMode.addEventListener('change', (e) => {
      this.params.cameraMode = e.target.value;
      this.app.setCameraMode(e.target.value);
    });
    
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
    
    this.elements.cameraMode.value = this.params.cameraMode;
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
  
  getParams() {
    return { ...this.params };
  }
}

export { UIController };
