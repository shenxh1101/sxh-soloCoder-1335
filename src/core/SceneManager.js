import * as THREE from 'three';

class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0015);
    
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);
    
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.position.set(100, 200, 100);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 4096;
    this.sunLight.shadow.mapSize.height = 4096;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 1000;
    this.sunLight.shadow.camera.left = -300;
    this.sunLight.shadow.camera.right = 300;
    this.sunLight.shadow.camera.top = 300;
    this.sunLight.shadow.camera.bottom = -300;
    this.sunLight.shadow.bias = -0.0001;
    this.scene.add(this.sunLight);
    
    this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.3);
    this.scene.add(this.hemisphereLight);
    
    this.cityGroup = new THREE.Group();
    this.scene.add(this.cityGroup);
    
    this.windowResizeHandler = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.windowResizeHandler);
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  clearCity() {
    while (this.cityGroup.children.length > 0) {
      const child = this.cityGroup.children[0];
      this.cityGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }
  
  setSkyColor(color, fogColor) {
    this.scene.background = new THREE.Color(color);
    this.scene.fog.color = new THREE.Color(fogColor);
  }
  
  setSunPosition(x, y, z) {
    this.sunLight.position.set(x, y, z);
  }
  
  setSunIntensity(intensity) {
    this.sunLight.intensity = intensity;
  }
  
  setSunColor(color) {
    this.sunLight.color.setHex(color);
  }
  
  setAmbientIntensity(intensity) {
    this.ambientLight.intensity = intensity;
  }
  
  setAmbientColor(color) {
    this.ambientLight.color.setHex(color);
  }
  
  setHemisphereIntensity(intensity) {
    this.hemisphereLight.intensity = intensity;
  }
  
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  
  getScreenshotDataURL(scale = 2) {
    const originalSize = {
      width: this.renderer.domElement.width,
      height: this.renderer.domElement.height
    };
    const originalPixelRatio = this.renderer.getPixelRatio();
    
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.render(this.scene, this.camera);
    
    const dataURL = this.canvas.toDataURL('image/png');
    
    this.renderer.setPixelRatio(originalPixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.width = originalSize.width;
    this.renderer.domElement.height = originalSize.height;
    
    return dataURL;
  }
  
  dispose() {
    window.removeEventListener('resize', this.windowResizeHandler);
    this.clearCity();
    this.renderer.dispose();
  }
}

export { SceneManager };
