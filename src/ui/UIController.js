import { formatTime } from '../utils/helpers.js';

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
    
    this.bindSlider('mapSize', 'mapSizeValue', v => parseInt(v), false);
    this.bindSlider('density', 'densityValue', v => parseFloat(v).toFixed(2), false);
    this.bindSlider('waterRatio', 'waterRatioValue', v => parseFloat(v).toFixed(2), false);
    this.bindSlider('minHeight', 'minHeightValue', v => parseInt(v), false);
    this.bindSlider('maxHeight', 'maxHeightValue', v => parseInt(v), false);
    
    this.bindSlider('timeOfDay', 'timeValue', v => formatTime(parseFloat(v)), true);
    
    this.elements.roadType.addEventListener('change', (e) => {
      this.params.roadType = e.target.value;
      this.debouncedRegenerate();
    });
    
    this.elements.cameraMode.addEventListener('change', (e) => {
      this.params.cameraMode = e.target.value;
      this.app.setCameraMode(e.target.value);
    });
    
    this.elements.regenerate.addEventListener('click', () => {
      this.app.regenerateCity();
    });
    
    this.elements.exportImage.addEventListener('click', () => {
      this.app.exportImage();
    });
    
    this.elements.exportJson.addEventListener('click', () => {
      this.app.exportJSON();
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
        this.debouncedRegenerate();
      }
    });
  }
  
  debouncedRegenerate() {
    if (this.regenerateTimeout) clearTimeout(this.regenerateTimeout);
    this.regenerateTimeout = setTimeout(() => {
      this.app.regenerateCity();
    }, 300);
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
