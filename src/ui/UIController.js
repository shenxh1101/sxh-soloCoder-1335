import { formatTime, clamp } from '../utils/helpers.js';

const STORAGE_KEY = 'city_generator_presets_v1';
const LAST_PRESET_KEY = 'city_generator_last_preset';

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
    this.currentPresetName = '';
    this.isPaintModeActive = false;
    this.paintTool = 'brush';
    this.paintZone = 'commercial';
    this.brushSize = 25;
    
    this.autoFollowActive = false;
    this.autoFollowSpeed = 30;
    
    this.compareMode = false;
    this.comparePresets = [];
    this.compareIndex = 0;
    this.autoPlay = false;
    this.autoPlayInterval = 5;
    this.autoPlayTimer = null;
    
    this.regeneratePending = false;
    this.regenerateScheduled = false;
    this.regenerateDebounceTimer = null;
    this.HEIGHT_GAP = 5;
    
    this.bindElements();
    this.bindEvents();
    this.refreshPresetList();
    this.refreshPresetChips();
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
      zoneSliders: document.getElementById('zone-sliders'),
      zonePaintTools: document.getElementById('zone-paint-tools'),
      
      zoneComX: document.getElementById('zone-com-x'),
      zoneComXValue: document.getElementById('zone-com-x-value'),
      zoneComZ: document.getElementById('zone-com-z'),
      zoneComZValue: document.getElementById('zone-com-z-value'),
      zoneComRadius: document.getElementById('zone-com-radius'),
      zoneComRadiusValue: document.getElementById('zone-com-radius-value'),
      zoneIndustrialAngle: document.getElementById('zone-industrial-angle'),
      zoneIndustrialAngleValue: document.getElementById('zone-industrial-angle-value'),
      
      brushSize: document.getElementById('brush-size'),
      brushSizeValue: document.getElementById('brush-size-value'),
      applyZones: document.getElementById('apply-zones'),
      clearZones: document.getElementById('clear-zones'),
      togglePaintMode: document.getElementById('toggle-paint-mode'),
      undoPaint: document.getElementById('undo-paint'),
      redoPaint: document.getElementById('redo-paint'),
      
      timeOfDay: document.getElementById('time-of-day'),
      timeValue: document.getElementById('time-value'),
      
      weather: document.getElementById('weather'),
      atmospherePresets: document.getElementById('atmosphere-presets'),
      
      cameraMode: document.getElementById('camera-mode'),
      autofollowControl: document.getElementById('autofollow-control'),
      autofollowSpeedControl: document.getElementById('autofollow-speed-control'),
      autofollowSpeed: document.getElementById('autofollow-speed'),
      autofollowSpeedValue: document.getElementById('autofollow-speed-value'),
      toggleAutofollow: document.getElementById('toggle-autofollow'),
      
      presetName: document.getElementById('preset-name'),
      presetList: document.getElementById('preset-list'),
      savePreset: document.getElementById('save-preset'),
      loadPreset: document.getElementById('load-preset'),
      deletePreset: document.getElementById('delete-preset'),
      presetSwitcher: document.getElementById('preset-switcher'),
      
      compareSection: document.getElementById('compare-section'),
      toggleCompare: document.getElementById('toggle-compare'),
      compareInterval: document.getElementById('compare-interval'),
      compareIntervalValue: document.getElementById('compare-interval-value'),
      compareList: document.getElementById('compare-list'),
      comparePrev: document.getElementById('compare-prev'),
      compareNext: document.getElementById('compare-next'),
      compareStatus: document.getElementById('compare-status'),
      
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
      this.updateZoneEditorVisibility();
      
      if (e.target.value !== 'paint') {
        this.applyZonePreset(e.target.value);
        this.scheduleRegenerate();
      }
    });
    
    const paintToolBtns = document.querySelectorAll('[data-paint-tool]');
    paintToolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        paintToolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.paintTool = btn.dataset.paintTool;
        if (this.app.getZonePainter()) {
          this.app.getZonePainter().setTool(this.paintTool);
        }
      });
    });
    
    const paintZoneBtns = document.querySelectorAll('[data-paint-zone]');
    paintZoneBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        paintZoneBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.paintZone = btn.dataset.paintZone;
        if (this.app.getZonePainter()) {
          this.app.getZonePainter().setZone(this.paintZone);
        }
      });
    });
    
    this.elements.brushSize.addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      this.elements.brushSizeValue.textContent = this.brushSize;
      if (this.app.getZonePainter()) {
        this.app.getZonePainter().setBrushSize(this.brushSize);
      }
    });
    
    this.elements.togglePaintMode.addEventListener('click', () => {
      this.isPaintModeActive = !this.isPaintModeActive;
      this.app.setPaintMode(this.isPaintModeActive);
      this.elements.togglePaintMode.textContent = this.isPaintModeActive ? '❌ 关闭绘制' : '🎨 开启绘制模式';
      this.elements.togglePaintMode.classList.toggle('btn-primary', this.isPaintModeActive);
      this.elements.togglePaintMode.classList.toggle('btn-secondary', !this.isPaintModeActive);
    });
    
    this.elements.applyZones.addEventListener('click', () => {
      if (this.isPaintModeActive) {
        this.app.setPaintMode(false);
        this.isPaintModeActive = false;
        this.elements.togglePaintMode.textContent = '🎨 开启绘制模式';
        this.elements.togglePaintMode.classList.remove('btn-primary');
        this.elements.togglePaintMode.classList.add('btn-secondary');
      }
      this.scheduleRegenerate();
    });
    
    this.elements.clearZones.addEventListener('click', () => {
      if (this.app.getZonePainter()) {
        this.app.getZonePainter().clear();
      }
    });
    
    this.elements.undoPaint.addEventListener('click', () => {
      this.app.undoPaint();
    });
    
    this.elements.redoPaint.addEventListener('click', () => {
      this.app.redoPaint();
    });
    
    this.elements.weather.addEventListener('change', (e) => {
      this.params.weather = e.target.value;
      if (this.app.onWeatherChange) {
        this.app.onWeatherChange(e.target.value);
      }
    });
    
    const atmosphereBtns = this.elements.atmospherePresets.querySelectorAll('[data-atmosphere]');
    atmosphereBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.atmosphere;
        if (this.app.applyAtmospherePreset) {
          this.app.applyAtmospherePreset(key);
        }
        atmosphereBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    
    this.elements.cameraMode.addEventListener('change', (e) => {
      this.params.cameraMode = e.target.value;
      this.app.setCameraMode(e.target.value);
      this.updateAutofollowVisibility();
      if (e.target.value !== 'street') {
        this.setAutoFollow(false);
      }
    });
    
    this.elements.toggleAutofollow.addEventListener('click', () => {
      this.setAutoFollow(!this.autoFollowActive);
    });
    
    this.elements.autofollowSpeed.addEventListener('input', (e) => {
      this.autoFollowSpeed = parseInt(e.target.value);
      this.elements.autofollowSpeedValue.textContent = this.autoFollowSpeed;
      this.app.setAutoFollowSpeed(this.autoFollowSpeed);
    });
    
    this.elements.toggleCompare.addEventListener('click', () => {
      if (!this.autoPlay) {
        this.startAutoPlay();
      } else {
        this.stopAutoPlay();
      }
    });
    
    this.elements.comparePrev.addEventListener('click', () => {
      this.prevComparePreset();
    });
    
    this.elements.compareNext.addEventListener('click', () => {
      this.nextComparePreset();
    });
    
    this.elements.compareInterval.addEventListener('input', (e) => {
      this.autoPlayInterval = parseInt(e.target.value);
      this.elements.compareIntervalValue.textContent = this.autoPlayInterval;
      if (this.autoPlay) {
        this.stopAutoPlay();
        this.startAutoPlay();
      }
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
  
  updateZoneEditorVisibility() {
    const isPaint = this.params.zonePreset === 'paint';
    this.elements.zoneSliders.style.display = isPaint ? 'none' : 'block';
    this.elements.zonePaintTools.style.display = isPaint ? 'block' : 'none';
  }
  
  updateAutofollowVisibility() {
    const isStreet = this.params.cameraMode === 'street';
    this.elements.autofollowControl.style.display = isStreet ? 'block' : 'none';
    this.elements.autofollowSpeedControl.style.display = isStreet && this.autoFollowActive ? 'block' : 'none';
  }
  
  setAutoFollow(enabled) {
    this.autoFollowActive = enabled;
    this.app.setAutoFollow(enabled);
    this.elements.toggleAutofollow.textContent = enabled ? '⏸️ 暂停' : '▶️ 开启';
    this.elements.toggleAutofollow.classList.toggle('active', enabled);
    this.elements.autofollowSpeedControl.style.display = enabled ? 'block' : 'none';
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
      if (name === this.currentPresetName) {
        opt.selected = true;
      }
      list.appendChild(opt);
    }
  }
  
  refreshPresetChips() {
    const container = this.elements.presetSwitcher;
    if (!container) return;
    
    container.innerHTML = '';
    const names = Object.keys(this.presets).sort().slice(0, 8);
    
    if (names.length === 0) return;
    
    for (const name of names) {
      const chip = document.createElement('span');
      chip.className = 'preset-chip';
      if (name === this.currentPresetName) {
        chip.classList.add('active');
      }
      if (this.comparePresets.includes(name)) {
        chip.classList.add('compare-mode');
      }
      chip.textContent = name;
      chip.addEventListener('click', (e) => {
        if (e.shiftKey || this.compareMode) {
          this.toggleComparePreset(name);
        } else {
          this.loadPresetByName(name);
        }
      });
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.toggleComparePreset(name);
      });
      container.appendChild(chip);
    }
    
    if (names.length > 0 && this.comparePresets.length === 0) {
      const hint = document.createElement('small');
      hint.style.cssText = 'color: #606078; font-size: 10px; margin-top: 4px; display: block; width: 100%;';
      hint.textContent = '💡 Shift+点击或右键加入对比';
      container.appendChild(hint);
    }
    
    this.updateCompareSectionVisibility();
  }
  
  toggleComparePreset(name) {
    const idx = this.comparePresets.indexOf(name);
    if (idx >= 0) {
      this.comparePresets.splice(idx, 1);
    } else {
      if (this.comparePresets.length < 5) {
        this.comparePresets.push(name);
      }
    }
    this.refreshPresetChips();
    this.refreshCompareList();
    this.updateCompareStatus();
  }
  
  refreshCompareList() {
    const list = this.elements.compareList;
    if (!list) return;
    
    if (this.comparePresets.length === 0) {
      list.innerHTML = '<small class="hint">点击上方方案标签加入对比（Shift+点击）</small>';
      return;
    }
    
    list.innerHTML = '';
    for (const name of this.comparePresets) {
      const chip = document.createElement('span');
      chip.className = 'compare-chip';
      chip.innerHTML = `${name} <span class="remove-icon">✕</span>`;
      chip.addEventListener('click', () => {
        this.toggleComparePreset(name);
      });
      list.appendChild(chip);
    }
  }
  
  updateCompareSectionVisibility() {
    const section = this.elements.compareSection;
    if (!section) return;
    section.style.display = this.comparePresets.length >= 2 ? 'block' : 'none';
  }
  
  updateCompareStatus() {
    const status = this.elements.compareStatus;
    if (!status) return;
    if (this.comparePresets.length === 0) {
      status.textContent = '0 / 0';
    } else {
      const displayIdx = this.compareIndex < this.comparePresets.length ? this.compareIndex + 1 : 1;
      status.textContent = `${displayIdx} / ${this.comparePresets.length}`;
    }
  }
  
  nextComparePreset() {
    if (this.comparePresets.length < 2) return;
    this.compareIndex = (this.compareIndex + 1) % this.comparePresets.length;
    this.loadComparePreset();
  }
  
  prevComparePreset() {
    if (this.comparePresets.length < 2) return;
    this.compareIndex = (this.compareIndex - 1 + this.comparePresets.length) % this.comparePresets.length;
    this.loadComparePreset();
  }
  
  loadComparePreset() {
    const name = this.comparePresets[this.compareIndex];
    if (name && this.presets[name]) {
      this.loadPresetByName(name);
    }
    this.updateCompareStatus();
  }
  
  startAutoPlay() {
    if (this.comparePresets.length < 2) return;
    
    this.autoPlay = true;
    this.compareMode = true;
    this.elements.toggleCompare.textContent = '⏸️ 暂停轮播';
    this.elements.toggleCompare.classList.add('active');
    
    if (this.compareIndex >= this.comparePresets.length) {
      this.compareIndex = 0;
      this.loadComparePreset();
    }
    
    this.autoPlayTimer = setInterval(() => {
      this.nextComparePreset();
    }, this.autoPlayInterval * 1000);
    
    this.refreshPresetChips();
  }
  
  stopAutoPlay() {
    this.autoPlay = false;
    this.elements.toggleCompare.textContent = '▶️ 开启轮播';
    this.elements.toggleCompare.classList.remove('active');
    
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
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
    
    const presetData = this.app.saveCurrentPreset(name);
    if (presetData) {
      this.presets[name] = presetData;
      this.savePresetsToStorage();
      this.currentPresetName = name;
      this.refreshPresetList();
      this.refreshPresetChips();
      this.saveLastPresetName(name);
      nameInput.value = '';
      nameInput.placeholder = `已保存: ${name}`;
    }
  }
  
  loadSelectedPreset() {
    const name = this.elements.presetList.value;
    if (!name || !this.presets[name]) return;
    this.loadPresetByName(name);
  }
  
  loadPresetByName(name) {
    if (!this.presets[name]) return;
    
    const preset = this.presets[name];
    this.currentPresetName = name;
    
    this.app.loadPreset(preset);
    this.saveLastPresetName(name);
    this.refreshPresetList();
    this.refreshPresetChips();
  }
  
  loadParamsFromPreset(preset) {
    Object.assign(this.params, preset);
    this.updateUI();
    this.updateZoneEditorVisibility();
  }
  
  deleteSelectedPreset() {
    const name = this.elements.presetList.value;
    if (!name || !this.presets[name]) return;
    
    if (!confirm(`确定删除方案"${name}"吗？`)) return;
    
    delete this.presets[name];
    this.savePresetsToStorage();
    
    const compareIdx = this.comparePresets.indexOf(name);
    if (compareIdx >= 0) {
      this.comparePresets.splice(compareIdx, 1);
      if (this.compareIndex >= this.comparePresets.length) {
        this.compareIndex = Math.max(0, this.comparePresets.length - 1);
      }
      if (this.comparePresets.length < 2 && this.autoPlay) {
        this.stopAutoPlay();
      }
    }
    
    if (this.currentPresetName === name) {
      this.currentPresetName = '';
      this.clearLastPresetName();
    }
    
    this.refreshPresetList();
    this.refreshPresetChips();
    this.refreshCompareList();
    this.updateCompareStatus();
    this.updateCompareSectionVisibility();
  }
  
  setCurrentPresetName(name) {
    this.currentPresetName = name;
    this.refreshPresetList();
    this.refreshPresetChips();
    
    if (name && this.presets[name]) {
      this.loadPresetByName(name);
    }
  }
  
  saveLastPresetName(name) {
    try {
      localStorage.setItem(LAST_PRESET_KEY, name);
    } catch (e) {}
  }
  
  clearLastPresetName() {
    try {
      localStorage.removeItem(LAST_PRESET_KEY);
    } catch (e) {}
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
    
    this.updateAutofollowVisibility();
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
