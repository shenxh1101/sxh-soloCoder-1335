import * as THREE from 'three';
import { clamp, lerp } from '../utils/helpers.js';

class TimeSystem {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.timeOfDay = 12;
    this.nightFactor = 0;
  }
  
  setTime(hours) {
    this.timeOfDay = hours;
    
    const dayStart = 6;
    const dayEnd = 18;
    const transition = 1.5;
    
    if (hours < dayStart - transition || hours > dayEnd + transition) {
      this.nightFactor = 1;
    } else if (hours > dayStart + transition && hours < dayEnd - transition) {
      this.nightFactor = 0;
    } else if (hours <= dayStart + transition) {
      this.nightFactor = 1 - clamp((hours - (dayStart - transition)) / (transition * 2), 0, 1);
    } else {
      this.nightFactor = clamp((hours - (dayEnd - transition)) / (transition * 2), 0, 1);
    }
    
    this.updateLighting();
    return this.nightFactor;
  }
  
  updateLighting() {
    const sunAngle = ((this.timeOfDay - 6) / 12) * Math.PI;
    const sunHeight = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 150;
    const sunY = sunHeight * 200 + 20;
    const sunZ = 100;
    
    this.sceneManager.setSunPosition(sunX, Math.max(sunY, 10), sunZ);
    
    const dayColor = new THREE.Color(0xffffff);
    const sunsetColor = new THREE.Color(0xff8844);
    const nightColor = new THREE.Color(0x334466);
    
    let sunColor, sunIntensity, ambientIntensity, ambientColor, skyColor, fogColor;
    
    if (this.nightFactor > 0.8) {
      sunColor = nightColor;
      sunIntensity = 0.05;
      ambientIntensity = 0.08;
      ambientColor = new THREE.Color(0x1a2233);
      skyColor = 0x0a0a1a;
      fogColor = 0x0a0a1a;
    } else if (this.nightFactor > 0.2) {
      const t = (this.nightFactor - 0.2) / 0.6;
      sunColor = sunsetColor.clone().lerp(nightColor, t);
      sunIntensity = lerp(0.8, 0.1, t);
      ambientIntensity = lerp(0.3, 0.1, t);
      
      const sunsetAmbient = new THREE.Color(0x554433);
      ambientColor = sunsetAmbient.clone().lerp(new THREE.Color(0x1a2233), t);
      
      skyColor = this.lerpHex(0x4488cc, 0x1a1a33, t);
      fogColor = this.lerpHex(0x6699cc, 0x1a1a33, t);
    } else {
      const dayProgress = clamp((this.timeOfDay - 6) / 12, 0, 1);
      const isMorning = dayProgress < 0.5;
      const t = isMorning ? dayProgress * 2 : (1 - dayProgress) * 2;
      
      sunColor = sunsetColor.clone().lerp(dayColor, clamp(t, 0, 1));
      sunIntensity = lerp(0.6, 1.2, clamp(t, 0, 1));
      ambientIntensity = lerp(0.25, 0.45, clamp(t, 0, 1));
      
      const morningAmbient = new THREE.Color(0xffddaa);
      const dayAmbient = new THREE.Color(0xffffff);
      ambientColor = morningAmbient.clone().lerp(dayAmbient, clamp(t, 0, 1));
      
      skyColor = this.lerpHex(0xffaa66, 0x87ceeb, clamp(t, 0, 1));
      fogColor = this.lerpHex(0xccaa88, 0x87ceeb, clamp(t, 0, 1));
    }
    
    this.sceneManager.setSunColor(sunColor.getHex());
    this.sceneManager.setSunIntensity(sunIntensity);
    this.sceneManager.setAmbientIntensity(ambientIntensity);
    this.sceneManager.setAmbientColor(ambientColor.getHex());
    this.sceneManager.setHemisphereIntensity(lerp(0.3, 0.05, this.nightFactor));
    this.sceneManager.setSkyColor(skyColor, fogColor);
    this.sceneManager.renderer.toneMappingExposure = lerp(1.2, 0.6, this.nightFactor);
  }
  
  lerpHex(hex1, hex2, t) {
    const r1 = (hex1 >> 16) & 255;
    const g1 = (hex1 >> 8) & 255;
    const b1 = hex1 & 255;
    const r2 = (hex2 >> 16) & 255;
    const g2 = (hex2 >> 8) & 255;
    const b2 = hex2 & 255;
    
    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const b = Math.round(lerp(b1, b2, t));
    
    return (r << 16) | (g << 8) | b;
  }
}

export { TimeSystem };
