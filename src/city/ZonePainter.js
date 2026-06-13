import * as THREE from 'three';

const ZONE_COLORS = {
  commercial: 'rgba(100, 150, 255, 0.45)',
  residential: 'rgba(140, 200, 140, 0.45)',
  industrial: 'rgba(212, 165, 116, 0.45)',
  eraser: 'rgba(255, 255, 255, 0.3)'
};

const ZONE_NAMES = {
  commercial: '商业',
  residential: '住宅',
  industrial: '工业',
  eraser: '橡皮擦'
};

class ZonePainter {
  constructor(mapSize, canvasId = 'zone-paint-canvas') {
    this.mapSize = mapSize;
    this.halfMap = mapSize / 2;
    
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = canvasId;
      document.getElementById('app').appendChild(this.canvas);
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    this.camera = null;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    this.isPainting = false;
    this.isActive = false;
    this.currentTool = 'brush';
    this.currentZone = 'commercial';
    this.brushSize = 25;
    
    this.rectStart = null;
    this.rectCurrent = null;
    
    this.zoneData = null;
    this.dataWidth = 0;
    this.dataHeight = 0;
    this.dataResolution = 2;
    
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 20;
    
    this.onChangeCallback = null;
    
    this.resize();
    this.initZoneData();
    this.bindEvents();
  }
  
  setCamera(camera) {
    this.camera = camera;
  }
  
  setMapSize(mapSize) {
    this.mapSize = mapSize;
    this.halfMap = mapSize / 2;
    this.initZoneData();
    this.clearHistory();
    this.render();
  }
  
  initZoneData() {
    this.dataWidth = Math.floor(this.mapSize / this.dataResolution);
    this.dataHeight = Math.floor(this.mapSize / this.dataResolution);
    this.zoneData = new Uint8Array(this.dataWidth * this.dataHeight);
    for (let i = 0; i < this.zoneData.length; i++) {
      this.zoneData[i] = 0;
    }
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.render();
  }
  
  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
    
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY, button: 0 });
    });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.onMouseUp(e);
    });
  }
  
  setTool(tool) {
    this.currentTool = tool;
  }
  
  setZone(zone) {
    this.currentZone = zone;
  }
  
  setBrushSize(size) {
    this.brushSize = size;
  }
  
  setActive(active) {
    this.isActive = active;
    this.canvas.classList.toggle('active', active);
    const badge = document.querySelector('.zone-paint-active-badge');
    if (badge) badge.classList.toggle('visible', active);
  }
  
  clear() {
    this.saveHistory();
    this.initZoneData();
    this.render();
    if (this.onChangeCallback) this.onChangeCallback();
  }
  
  undo() {
    if (this.historyIndex <= 0) return false;
    this.historyIndex--;
    this.zoneData = new Uint8Array(this.history[this.historyIndex]);
    this.render();
    if (this.onChangeCallback) this.onChangeCallback();
    return true;
  }
  
  redo() {
    if (this.historyIndex >= this.history.length - 1) return false;
    this.historyIndex++;
    this.zoneData = new Uint8Array(this.history[this.historyIndex]);
    this.render();
    if (this.onChangeCallback) this.onChangeCallback();
    return true;
  }
  
  saveHistory() {
    const snapshot = new Uint8Array(this.zoneData);
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }
  
  clearHistory() {
    this.history = [];
    this.historyIndex = -1;
    this.saveHistory();
  }
  
  canUndo() {
    return this.historyIndex > 0;
  }
  
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }
  
  screenToWorld(sx, sy) {
    if (!this.camera) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const x = sx - canvasRect.left;
      const y = sy - canvasRect.top;
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;
      const scale = Math.min(canvasRect.width, canvasRect.height) / (this.mapSize * 1.2);
      return { x: (x - centerX) / scale, z: (y - centerY) / scale };
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((sx - rect.left) / rect.width) * 2 - 1,
      -((sy - rect.top) / rect.height) * 2 + 1
    );
    
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersect = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, intersect);
    
    if (intersect) {
      return { x: intersect.x, z: intersect.z };
    }
    return null;
  }
  
  worldToScreen(wx, wz) {
    if (!this.camera) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const scale = Math.min(canvasRect.width, canvasRect.height) / (this.mapSize * 1.2);
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;
      return { x: centerX + wx * scale, y: centerY + wz * scale };
    }
    
    const vector = new THREE.Vector3(wx, 0, wz);
    vector.project(this.camera);
    
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (vector.x + 1) / 2 * rect.width,
      y: (-vector.y + 1) / 2 * rect.height
    };
  }
  
  worldToData(wx, wz) {
    const dx = Math.floor((wx + this.halfMap) / this.dataResolution);
    const dz = Math.floor((wz + this.halfMap) / this.dataResolution);
    return { dx, dz };
  }
  
  onMouseDown(e) {
    if (!this.isActive) return;
    if (e.button !== undefined && e.button !== 0) return;
    
    const world = this.screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    
    this.isPainting = true;
    this.saveHistory();
    
    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      this.paintBrush(world.x, world.z);
    } else if (this.currentTool === 'rect') {
      this.rectStart = world;
      this.rectCurrent = world;
    }
  }
  
  onMouseMove(e) {
    if (!this.isActive || !this.isPainting) return;
    
    const world = this.screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    
    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      this.paintBrush(world.x, world.z);
    } else if (this.currentTool === 'rect' && this.rectStart) {
      this.rectCurrent = world;
      this.render();
      this.drawRectPreview(this.rectStart, world);
    }
  }
  
  onMouseUp(e) {
    if (!this.isActive) return;
    
    if (this.currentTool === 'rect' && this.rectStart) {
      const world = this.rectCurrent || this.screenToWorld(e.clientX, e.clientY);
      if (world) {
        this.paintRect(this.rectStart, world);
      }
      this.rectStart = null;
      this.rectCurrent = null;
    }
    
    this.isPainting = false;
    if (this.onChangeCallback) this.onChangeCallback();
  }
  
  paintBrush(wx, wz) {
    const radiusData = Math.floor(this.brushSize / this.dataResolution);
    const center = this.worldToData(wx, wz);
    
    const isErase = this.currentTool === 'eraser' || this.currentZone === 'eraser';
    const zoneIdx = isErase ? 0 : this.zoneToIndex(this.currentZone);
    
    for (let dz = -radiusData; dz <= radiusData; dz++) {
      for (let dx = -radiusData; dx <= radiusData; dx++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radiusData) {
          const ix = center.dx + dx;
          const iz = center.dz + dz;
          if (ix >= 0 && ix < this.dataWidth && iz >= 0 && iz < this.dataHeight) {
            const idx = iz * this.dataWidth + ix;
            if (isErase || dist <= radiusData * 0.7 || Math.random() > 0.3) {
              this.zoneData[idx] = zoneIdx;
            }
          }
        }
      }
    }
    
    this.render();
  }
  
  paintRect(start, end) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);
    
    const startData = this.worldToData(minX, minZ);
    const endData = this.worldToData(maxX, maxZ);
    
    const isErase = this.currentZone === 'eraser';
    const zoneIdx = isErase ? 0 : this.zoneToIndex(this.currentZone);
    
    for (let iz = startData.dz; iz <= endData.dz; iz++) {
      for (let ix = startData.dx; ix <= endData.dx; ix++) {
        if (ix >= 0 && ix < this.dataWidth && iz >= 0 && iz < this.dataHeight) {
          this.zoneData[iz * this.dataWidth + ix] = zoneIdx;
        }
      }
    }
    
    this.render();
  }
  
  drawRectPreview(start, end) {
    const p1 = this.worldToScreen(start.x, start.z);
    const p2 = this.worldToScreen(end.x, end.z);
    
    const colorKey = this.currentZone === 'eraser' ? 'eraser' : this.currentZone;
    this.ctx.fillStyle = ZONE_COLORS[colorKey] || 'rgba(255,255,255,0.3)';
    this.ctx.strokeStyle = (ZONE_COLORS[colorKey] || 'rgba(255,255,255,0.3)').replace('0.45', '0.9').replace('0.3', '0.8');
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);
    
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeRect(x, y, w, h);
    this.ctx.setLineDash([]);
  }
  
  zoneToIndex(zone) {
    switch (zone) {
      case 'commercial': return 1;
      case 'residential': return 2;
      case 'industrial': return 3;
      default: return 0;
    }
  }
  
  indexToZone(idx) {
    switch (idx) {
      case 1: return 'commercial';
      case 2: return 'residential';
      case 3: return 'industrial';
      default: return null;
    }
  }
  
  getZoneAt(x, z, fallback = null) {
    const { dx, dz } = this.worldToData(x, z);
    if (dx < 0 || dx >= this.dataWidth || dz < 0 || dz >= this.dataHeight) {
      return fallback;
    }
    const idx = this.zoneData[dz * this.dataWidth + dx];
    return this.indexToZone(idx) || fallback;
  }
  
  hasPaintData() {
    for (let i = 0; i < this.zoneData.length; i++) {
      if (this.zoneData[i] !== 0) return true;
    }
    return false;
  }
  
  render() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.isActive) return;
    
    const step = 2;
    
    for (let iz = 0; iz < this.dataHeight; iz += step) {
      for (let ix = 0; ix < this.dataWidth; ix += step) {
        const idx = iz * this.dataWidth + ix;
        const zoneIdx = this.zoneData[idx];
        if (zoneIdx === 0) continue;
        
        const zone = this.indexToZone(zoneIdx);
        const wx = ix * this.dataResolution - this.halfMap;
        const wz = iz * this.dataResolution - this.halfMap;
        
        const screen = this.worldToScreen(wx, wz);
        const nextScreen = this.worldToScreen(
          wx + step * this.dataResolution,
          wz + step * this.dataResolution
        );
        
        const cellW = Math.abs(nextScreen.x - screen.x);
        const cellH = Math.abs(nextScreen.y - screen.y);
        
        ctx.fillStyle = ZONE_COLORS[zone];
        ctx.fillRect(
          screen.x - cellW / 2,
          screen.y - cellH / 2,
          cellW + 1,
          cellH + 1
        );
      }
    }
    
    this.drawMapBorder();
  }
  
  drawMapBorder() {
    const ctx = this.ctx;
    const corners = [
      { x: -this.halfMap, z: -this.halfMap },
      { x: this.halfMap, z: -this.halfMap },
      { x: this.halfMap, z: this.halfMap },
      { x: -this.halfMap, z: this.halfMap }
    ];
    
    const screenCorners = corners.map(c => this.worldToScreen(c.x, c.z));
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
    for (let i = 1; i < screenCorners.length; i++) {
      ctx.lineTo(screenCorners[i].x, screenCorners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    const gridCount = 10;
    for (let i = 1; i < gridCount; i++) {
      const t = i / gridCount;
      const wx = -this.halfMap + this.mapSize * t;
      const wz = -this.halfMap + this.mapSize * t;
      
      const p1 = this.worldToScreen(wx, -this.halfMap);
      const p2 = this.worldToScreen(wx, this.halfMap);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      
      const p3 = this.worldToScreen(-this.halfMap, wz);
      const p4 = this.worldToScreen(this.halfMap, wz);
      ctx.beginPath();
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.stroke();
    }
  }
  
  onChange(callback) {
    this.onChangeCallback = callback;
  }
  
  serialize() {
    return {
      mapSize: this.mapSize,
      dataResolution: this.dataResolution,
      dataWidth: this.dataWidth,
      dataHeight: this.dataHeight,
      zoneData: Array.from(this.zoneData)
    };
  }
  
  deserialize(data) {
    if (!data || !data.zoneData) return;
    
    this.dataResolution = data.dataResolution || 2;
    this.dataWidth = data.dataWidth;
    this.dataHeight = data.dataHeight;
    this.zoneData = new Uint8Array(data.zoneData);
    this.clearHistory();
    this.render();
    
    if (this.onChangeCallback) this.onChangeCallback();
  }
}

export { ZonePainter, ZONE_COLORS, ZONE_NAMES };
