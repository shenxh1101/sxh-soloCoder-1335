import * as THREE from 'three';
import { randomRange, randomInt } from '../utils/helpers.js';

class TextureGenerator {
  constructor(seed = 42) {
    this.seed = seed;
    this.cache = new Map();
  }
  
  random(seed) {
    const x = Math.sin(seed + this.seed) * 10000;
    return x - Math.floor(x);
  }
  
  createBuildingTexture(zone, height, seed = 0) {
    const cacheKey = `${zone}_${Math.floor(height)}_${seed}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    let baseColor, windowColor, accentColor;
    switch (zone) {
      case 'commercial':
        baseColor = this.blendColors(
          [0x5a6a7a, 0x6a7a8a, 0x7a8a9a],
          this.random(seed)
        );
        windowColor = this.blendColors(
          [0x87ceeb, 0xadd8e6, 0xb0e0e6],
          this.random(seed + 1)
        );
        accentColor = 0x4a90d9;
        break;
      case 'industrial':
        baseColor = this.blendColors(
          [0x6b5b4f, 0x7a6a5a, 0x5a4a3a],
          this.random(seed + 2)
        );
        windowColor = this.blendColors(
          [0x555555, 0x666666, 0x777777],
          this.random(seed + 3)
        );
        accentColor = 0x8b4513;
        break;
      case 'residential':
      default:
        const baseColors = [0xd4a574, 0xc4956a, 0xb8956a, 0xa0826d, 0x8fbc8f, 0xdeb887];
        baseColor = baseColors[Math.floor(this.random(seed + 4) * baseColors.length)];
        windowColor = this.blendColors(
          [0xf0e68c, 0xfafad2, 0xeee8aa],
          this.random(seed + 5)
        );
        accentColor = 0x8b0000;
        break;
    }
    
    ctx.fillStyle = this.hexToRgb(baseColor);
    ctx.fillRect(0, 0, size, size);
    
    this.addNoise(ctx, size, seed, 10);
    
    const windowRows = Math.max(3, Math.floor(height / 3));
    const windowCols = Math.max(3, Math.floor(6 + this.random(seed + 10) * 6));
    const windowWidth = (size * 0.7) / windowCols;
    const windowHeight = (size * 0.8) / windowRows;
    const startX = size * 0.15;
    const startY = size * 0.1;
    
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        const wx = startX + col * windowWidth + windowWidth * 0.15;
        const wy = startY + row * windowHeight + windowHeight * 0.15;
        const ww = windowWidth * 0.7;
        const wh = windowHeight * 0.7;
        
        const isLit = this.random(seed + row * 100 + col) > 0.5;
        
        if (isLit) {
          ctx.fillStyle = this.hexToRgb(windowColor);
        } else {
          ctx.fillStyle = this.hexToRgb(this.darkenColor(windowColor, 0.4));
        }
        ctx.fillRect(wx, wy, ww, wh);
        
        ctx.strokeStyle = this.hexToRgb(this.darkenColor(baseColor, 0.3));
        ctx.lineWidth = 1;
        ctx.strokeRect(wx, wy, ww, wh);
        
        ctx.beginPath();
        ctx.moveTo(wx + ww / 2, wy);
        ctx.lineTo(wx + ww / 2, wy + wh);
        ctx.moveTo(wx, wy + wh / 2);
        ctx.lineTo(wx + ww, wy + wh / 2);
        ctx.stroke();
      }
    }
    
    if (zone === 'commercial' && height > 40) {
      this.addLogo(ctx, size, seed, accentColor);
    }
    
    if (zone === 'residential') {
      this.addRoofDetails(ctx, size, seed, accentColor);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    this.cache.set(cacheKey, { texture, windowRows, windowCols });
    return { texture, windowRows, windowCols };
  }
  
  createWindowEmissiveMap(zone, height, seed = 0) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    
    const windowRows = Math.max(3, Math.floor(height / 3));
    const windowCols = Math.max(3, Math.floor(6 + this.random(seed + 10) * 6));
    const windowWidth = (size * 0.7) / windowCols;
    const windowHeight = (size * 0.8) / windowRows;
    const startX = size * 0.15;
    const startY = size * 0.1;
    
    const litProbability = zone === 'commercial' ? 0.7 : zone === 'residential' ? 0.5 : 0.3;
    
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        const isLit = this.random(seed + row * 200 + col + 50) < litProbability;
        
        if (isLit) {
          const wx = startX + col * windowWidth + windowWidth * 0.15;
          const wy = startY + row * windowHeight + windowHeight * 0.15;
          const ww = windowWidth * 0.7;
          const wh = windowHeight * 0.7;
          
          const brightness = 0.6 + this.random(seed + row * 300 + col + 100) * 0.4;
          const r = Math.floor(255 * brightness);
          const g = Math.floor(230 * brightness);
          const b = Math.floor(180 * brightness);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  
  createGroundTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#3a5f3a';
    ctx.fillRect(0, 0, size, size);
    
    for (let i = 0; i < 20000; i++) {
      const x = this.random(i) * size;
      const y = this.random(i + 10000) * size;
      const brightness = 0.6 + this.random(i + 20000) * 0.4;
      const r = Math.floor(40 * brightness);
      const g = Math.floor(80 * brightness + 20);
      const b = Math.floor(40 * brightness);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, y, 2, 2);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 20);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  
  createWaterTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#1e5799';
    ctx.fillRect(0, 0, size, size);
    
    for (let i = 0; i < 5000; i++) {
      const x = this.random(i + 30000) * size;
      const y = this.random(i + 40000) * size;
      const brightness = 0.3 + this.random(i + 50000) * 0.3;
      const r = Math.floor(30 + 30 * brightness);
      const g = Math.floor(90 + 50 * brightness);
      const b = Math.floor(160 + 60 * brightness);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
      ctx.fillRect(x, y, 4, 4);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  
  createPavementTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, size, size);
    
    for (let i = 0; i < 1000; i++) {
      const x = this.random(i + 60000) * size;
      const y = this.random(i + 70000) * size;
      const shade = 0.6 + this.random(i + 80000) * 0.4;
      const gray = Math.floor(136 * shade);
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.fillRect(x, y, 3, 3);
    }
    
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    for (let y = 0; y < size; y += 32) {
      for (let x = 0; x < size; x += 32) {
        ctx.strokeRect(x, y, 32, 32);
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  
  hexToRgb(hex) {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  blendColors(colors, t) {
    const idx = t * (colors.length - 1);
    const i = Math.floor(idx);
    const f = idx - i;
    const c1 = colors[i];
    const c2 = colors[Math.min(i + 1, colors.length - 1)];
    
    const r1 = (c1 >> 16) & 255;
    const g1 = (c1 >> 8) & 255;
    const b1 = c1 & 255;
    const r2 = (c2 >> 16) & 255;
    const g2 = (c2 >> 8) & 255;
    const b2 = c2 & 255;
    
    const r = Math.round(r1 + (r2 - r1) * f);
    const g = Math.round(g1 + (g2 - g1) * f);
    const b = Math.round(b1 + (b2 - b1) * f);
    return (r << 16) | (g << 8) | b;
  }
  
  darkenColor(hex, factor) {
    const r = Math.floor(((hex >> 16) & 255) * (1 - factor));
    const g = Math.floor(((hex >> 8) & 255) * (1 - factor));
    const b = Math.floor((hex & 255) * (1 - factor));
    return (r << 16) | (g << 8) | b;
  }
  
  addNoise(ctx, size, seed, intensity) {
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (this.random(seed + i) - 0.5) * intensity * 2;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
  }
  
  addLogo(ctx, size, seed, color) {
    const logoSize = size * 0.15;
    const x = size * 0.5 - logoSize / 2;
    const y = size * 0.05;
    
    ctx.fillStyle = this.hexToRgb(color);
    ctx.font = `bold ${logoSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const text = chars[Math.floor(this.random(seed + 100) * chars.length)] +
                 chars[Math.floor(this.random(seed + 101) * chars.length)] +
                 chars[Math.floor(this.random(seed + 102) * chars.length)];
    ctx.fillText(text, size / 2, y + logoSize / 2);
  }
  
  addRoofDetails(ctx, size, seed, color) {
    ctx.fillStyle = this.hexToRgb(color);
    const roofHeight = size * 0.08;
    ctx.fillRect(0, 0, size, roofHeight);
    
    ctx.strokeStyle = this.hexToRgb(this.darkenColor(color, 0.3));
    ctx.lineWidth = 2;
    for (let x = 0; x < size; x += size * 0.1) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, roofHeight);
      ctx.stroke();
    }
  }
}

export { TextureGenerator };
