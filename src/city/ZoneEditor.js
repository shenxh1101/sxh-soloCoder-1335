import { clamp } from '../utils/helpers.js';

const ZONE_PRESETS = {
  auto: {
    name: '自动分布',
    commercialCenter: { x: 0, z: 0 },
    commercialRadius: 0.3,
    industrialAngle: Math.PI,
    industrialBias: 0.6
  },
  'center-commercial': {
    name: '中心商业区',
    commercialCenter: { x: 0, z: 0 },
    commercialRadius: 0.45,
    industrialAngle: Math.PI,
    industrialBias: 0.3
  },
  'industrial-park': {
    name: '产业园区',
    commercialCenter: { x: -0.3, z: -0.3 },
    commercialRadius: 0.2,
    industrialAngle: Math.PI / 4,
    industrialBias: 0.85
  },
  'residential-only': {
    name: '纯住宅区',
    commercialCenter: { x: 0, z: 0 },
    commercialRadius: 0.05,
    industrialAngle: 0,
    industrialBias: 0.0
  },
  mixed: {
    name: '混合社区',
    commercialCenter: { x: 0.1, z: 0.1 },
    commercialRadius: 0.25,
    industrialAngle: Math.PI * 1.5,
    industrialBias: 0.35
  }
};

class ZoneEditor {
  constructor(mapSize, params = {}) {
    this.mapSize = mapSize;
    this.halfMap = mapSize / 2;
    
    this.preset = params.preset || 'auto';
    this.commercialCenterX = params.commercialCenterX !== undefined ? params.commercialCenterX : 0;
    this.commercialCenterZ = params.commercialCenterZ !== undefined ? params.commercialCenterZ : 0;
    this.commercialRadius = params.commercialRadius !== undefined ? params.commercialRadius : 0.3;
    this.industrialAngle = params.industrialAngle !== undefined ? params.industrialAngle : Math.PI;
    
    this.applyPreset(this.preset);
  }
  
  applyPreset(presetName) {
    const preset = ZONE_PRESETS[presetName] || ZONE_PRESETS.auto;
    this.preset = presetName;
    
    if (presetName === 'auto') return;
    
    this.commercialCenterX = preset.commercialCenter.x * this.halfMap;
    this.commercialCenterZ = preset.commercialCenter.z * this.halfMap;
    this.commercialRadius = preset.commercialRadius * this.halfMap;
    this.industrialAngle = preset.industrialAngle;
  }
  
  setCommercialCenter(xPercent, zPercent) {
    this.commercialCenterX = (xPercent / 100) * this.halfMap;
    this.commercialCenterZ = (zPercent / 100) * this.halfMap;
  }
  
  setCommercialRadius(radiusPercent) {
    this.commercialRadius = (radiusPercent / 100) * this.halfMap;
  }
  
  setIndustrialAngle(angleDegrees) {
    this.industrialAngle = (angleDegrees * Math.PI) / 180;
  }
  
  getZoneAt(x, z, noise = 0) {
    const dx = x - this.commercialCenterX;
    const dz = z - this.commercialCenterZ;
    const distToCommercial = Math.sqrt(dx * dx + dz * dz);
    
    const indX = Math.cos(this.industrialAngle) * this.halfMap;
    const indZ = Math.sin(this.industrialAngle) * this.halfMap;
    const distToIndustrial = Math.sqrt(
      (x - indX) * (x - indX) + (z - indZ) * (z - indZ)
    );
    
    const normalizedDistToCommercial = distToCommercial / this.halfMap;
    const normalizedDistToIndustrial = distToIndustrial / this.halfMap;
    
    const commercialScore = clamp(1 - distToCommercial / Math.max(10, this.commercialRadius), 0, 1);
    const industrialScore = clamp(1 - normalizedDistToIndustrial * 1.5 + noise * 0.3, 0, 1);
    const residentialScore = 1 - Math.max(commercialScore, industrialScore) * 0.8;
    
    let zone = 'residential';
    const combinedNoise = noise + (this.preset === 'auto' ? 0 : 0.1);
    
    if (commercialScore > 0.5 + combinedNoise * 0.2) {
      zone = 'commercial';
    } else if (industrialScore > 0.55 - combinedNoise * 0.2) {
      zone = 'industrial';
    } else if (this.preset === 'residential-only') {
      zone = 'residential';
    } else if (this.preset === 'industrial-park' && industrialScore > 0.3) {
      zone = 'industrial';
    }
    
    if (this.preset === 'center-commercial' && commercialScore > 0.3) {
      zone = 'commercial';
    }
    
    return zone;
  }
  
  getDensityModifier(zone) {
    switch (zone) {
      case 'commercial':
        return 1.2;
      case 'residential':
        return 0.9;
      case 'industrial':
        return 0.7;
      default:
        return 1.0;
    }
  }
  
  getHeightModifier(zone, baseHeight) {
    switch (zone) {
      case 'commercial':
        return baseHeight * 1.4;
      case 'residential':
        return baseHeight * 0.7;
      case 'industrial':
        return baseHeight * 0.85;
      default:
        return baseHeight;
    }
  }
  
  getNightLightModifier(zone) {
    switch (zone) {
      case 'commercial':
        return 1.8;
      case 'residential':
        return 0.8;
      case 'industrial':
        return 1.2;
      default:
        return 1.0;
    }
  }
  
  getParams() {
    return {
      preset: this.preset,
      commercialCenterX: this.commercialCenterX,
      commercialCenterZ: this.commercialCenterZ,
      commercialRadius: this.commercialRadius,
      industrialAngle: this.industrialAngle
    };
  }
  
  getStats(plots) {
    const stats = { commercial: 0, residential: 0, industrial: 0 };
    for (const plot of plots) {
      stats[plot.zone] = (stats[plot.zone] || 0) + 1;
    }
    return stats;
  }
}

export { ZoneEditor, ZONE_PRESETS };
