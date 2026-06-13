const ZONE_COLORS = {
  commercial: 'rgba(100, 150, 255, 0.45)',
  residential: 'rgba(140, 200, 140, 0.45)',
  industrial: 'rgba(212, 165, 116, 0.45)'
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
    
    this.isPainting = false;
    this.isActive = false;
    this.currentTool = 'brush';
    this.currentZone = 'commercial';
    this.brushSize = 25;
    
    this.rectStart = null;
    this.tempCanvas = null;
    this.tempCtx = null;
    
    this.zoneData = null;
    this.dataWidth = 0;
    this.dataHeight = 0;
    this.dataResolution = 2;
    
    this.onChangeCallback = null;
    
    this.resize();
    this.initZoneData();
    this.bindEvents();
  }
  
  setMapSize(mapSize) {
    this.mapSize = mapSize;
    this.halfMap = mapSize / 2;
    this.initZoneData();
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
      this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
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
    this.initZoneData();
    this.render();
    if (this.onChangeCallback) this.onChangeCallback();
  }
  
  screenToWorld(x, y) {
    const canvasRect = this.canvas.getBoundingClientRect();
    const sx = x - canvasRect.left;
    const sy = y - canvasRect.top;
    
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;
    
    const scale = Math.min(canvasRect.width, canvasRect.height) / (this.mapSize * 1.2);
    
    const wx = (sx - centerX) / scale;
    const wz = (sy - centerY) / scale;
    
    return { x: wx, z: wz };
  }
  
  worldToData(wx, wz) {
    const dx = Math.floor((wx + this.halfMap) / this.dataResolution);
    const dz = Math.floor((wz + this.halfMap) / this.dataResolution);
    return { dx, dz };
  }
  
  onMouseDown(e) {
    if (!this.isActive) return;
    this.isPainting = true;
    
    const world = this.screenToWorld(e.clientX, e.clientY);
    
    if (this.currentTool === 'brush') {
      this.paintBrush(world.x, world.z);
    } else if (this.currentTool === 'rect') {
      this.rectStart = world;
    }
  }
  
  onMouseMove(e) {
    if (!this.isActive || !this.isPainting) return;
    
    const world = this.screenToWorld(e.clientX, e.clientY);
    
    if (this.currentTool === 'brush') {
      this.paintBrush(world.x, world.z);
    } else if (this.currentTool === 'rect' && this.rectStart) {
      this.render();
      this.drawRectPreview(this.rectStart, world);
    }
  }
  
  onMouseUp(e) {
    if (!this.isActive) return;
    
    if (this.currentTool === 'rect' && this.rectStart) {
      const world = this.screenToWorld(e.clientX, e.clientY);
      this.paintRect(this.rectStart, world);
      this.rectStart = null;
    }
    
    this.isPainting = false;
    if (this.onChangeCallback) this.onChangeCallback();
  }
  
  paintBrush(wx, wz) {
    const radiusData = Math.floor(this.brushSize / this.dataResolution);
    const center = this.worldToData(wx, wz);
    
    const zoneIdx = this.zoneToIndex(this.currentZone);
    
    for (let dz = -radiusData; dz <= radiusData; dz++) {
      for (let dx = -radiusData; dx <= radiusData; dx++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radiusData) {
          const ix = center.dx + dx;
          const iz = center.dz + dz;
          if (ix >= 0 && ix < this.dataWidth && iz >= 0 && iz < this.dataHeight) {
            const idx = iz * this.dataWidth + ix;
            if (dist <= radiusData * 0.7 || Math.random() > 0.3) {
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
    
    const zoneIdx = this.zoneToIndex(this.currentZone);
    
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
    const canvasRect = this.canvas.getBoundingClientRect();
    const scale = Math.min(canvasRect.width, canvasRect.height) / (this.mapSize * 1.2);
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;
    
    const sx1 = centerX + start.x * scale;
    const sy1 = centerY + start.z * scale;
    const sx2 = centerX + end.x * scale;
    const sy2 = centerY + end.z * scale;
    
    this.ctx.fillStyle = ZONE_COLORS[this.currentZone];
    this.ctx.strokeStyle = ZONE_COLORS[this.currentZone].replace('0.45', '0.9');
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.fillRect(
      Math.min(sx1, sx2),
      Math.min(sy1, sy2),
      Math.abs(sx2 - sx1),
      Math.abs(sy2 - sy1)
    );
    this.ctx.strokeRect(
      Math.min(sx1, sx2),
      Math.min(sy1, sy2),
      Math.abs(sx2 - sx1),
      Math.abs(sy2 - sy1)
    );
    
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
    const canvasRect = this.canvas.getBoundingClientRect();
    
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const scale = Math.min(canvasRect.width, canvasRect.height) / (this.mapSize * 1.2);
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;
    
    const step = 2;
    
    for (let iz = 0; iz < this.dataHeight; iz += step) {
      for (let ix = 0; ix < this.dataWidth; ix += step) {
        const idx = iz * this.dataWidth + ix;
        const zoneIdx = this.zoneData[idx];
        if (zoneIdx === 0) continue;
        
        const zone = this.indexToZone(zoneIdx);
        const wx = ix * this.dataResolution - this.halfMap;
        const wz = iz * this.dataResolution - this.halfMap;
        
        const sx = centerX + wx * scale;
        const sy = centerY + wz * scale;
        
        ctx.fillStyle = ZONE_COLORS[zone];
        ctx.fillRect(
          sx - step * this.dataResolution * scale / 2,
          sy - step * this.dataResolution * scale / 2,
          step * this.dataResolution * scale + 1,
          step * this.dataResolution * scale + 1
        );
      }
    }
    
    const mapLeft = centerX - this.halfMap * scale;
    const mapTop = centerY - this.halfMap * scale;
    const mapSize = this.mapSize * scale;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapLeft, mapTop, mapSize, mapSize);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    const gridCount = 10;
    const gridStep = mapSize / gridCount;
    for (let i = 1; i < gridCount; i++) {
      ctx.beginPath();
      ctx.moveTo(mapLeft + i * gridStep, mapTop);
      ctx.lineTo(mapLeft + i * gridStep, mapTop + mapSize);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(mapLeft, mapTop + i * gridStep);
      ctx.lineTo(mapLeft + mapSize, mapTop + i * gridStep);
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
    this.render();
    
    if (this.onChangeCallback) this.onChangeCallback();
  }
}

export { ZonePainter, ZONE_COLORS };
