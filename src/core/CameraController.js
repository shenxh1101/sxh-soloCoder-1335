import * as THREE from 'three';
import { clamp, lerp } from '../utils/helpers.js';

const CAMERA_MODES = {
  OVERVIEW: 'overview',
  STREET: 'street',
  FLIGHT: 'flight'
};

class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    
    this.mode = CAMERA_MODES.OVERVIEW;
    this.mapSize = 200;
    
    this.target = new THREE.Vector3();
    this.position = new THREE.Vector3();
    
    this.isDragging = false;
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    
    this.keys = {};
    
    this.theta = Math.PI / 4;
    this.phi = Math.PI / 3;
    this.distance = 300;
    this.minDistance = 50;
    this.maxDistance = 800;
    
    this.streetHeight = 3;
    this.moveSpeed = 80;
    this.rotationSpeed = 0.003;
    
    this.flightSpeed = 150;
    this.flightHeight = 100;
    
    this.mouseDownHandler = this.onMouseDown.bind(this);
    this.mouseMoveHandler = this.onMouseMove.bind(this);
    this.mouseUpHandler = this.onMouseUp.bind(this);
    this.wheelHandler = this.onWheel.bind(this);
    this.keyDownHandler = this.onKeyDown.bind(this);
    this.keyUpHandler = this.onKeyUp.bind(this);
    this.contextMenuHandler = (e) => e.preventDefault();
    
    this.bindEvents();
    this.resetPosition();
  }
  
  bindEvents() {
    this.domElement.addEventListener('mousedown', this.mouseDownHandler);
    window.addEventListener('mousemove', this.mouseMoveHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);
    this.domElement.addEventListener('wheel', this.wheelHandler, { passive: false });
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    this.domElement.addEventListener('contextmenu', this.contextMenuHandler);
  }
  
  setMapSize(size) {
    this.mapSize = size;
    this.maxDistance = size * 4;
    this.target.set(0, 0, 0);
  }
  
  setMode(mode) {
    this.mode = mode;
    this.resetPosition();
  }
  
  resetPosition() {
    switch (this.mode) {
      case CAMERA_MODES.OVERVIEW:
        this.distance = this.mapSize * 1.5;
        this.target.set(0, 0, 0);
        this.theta = Math.PI / 4;
        this.phi = Math.PI / 3;
        this.updateSpherical();
        break;
        
      case CAMERA_MODES.STREET:
        this.camera.position.set(0, this.streetHeight, this.mapSize * 0.3);
        this.camera.lookAt(0, this.streetHeight, 0);
        break;
        
      case CAMERA_MODES.FLIGHT:
        this.camera.position.set(-this.mapSize * 0.5, this.flightHeight, -this.mapSize * 0.5);
        this.camera.lookAt(0, 0, 0);
        break;
    }
  }
  
  updateSpherical() {
    const x = this.target.x + this.distance * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.target.y + this.distance * Math.cos(this.phi);
    const z = this.target.z + this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }
  
  onMouseDown(e) {
    if (e.button === 0) {
      this.isDragging = true;
    } else if (e.button === 2) {
      this.isPanning = true;
    }
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }
  
  onMouseMove(e) {
    const deltaX = e.clientX - this.lastMouseX;
    const deltaY = e.clientY - this.lastMouseY;
    
    if (this.mode === CAMERA_MODES.OVERVIEW) {
      if (this.isDragging) {
        this.theta -= deltaX * 0.005;
        this.phi = clamp(this.phi - deltaY * 0.005, 0.1, Math.PI / 2 - 0.01);
        this.updateSpherical();
      }
      if (this.isPanning) {
        const panSpeed = this.distance * 0.002;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        this.camera.getWorldDirection(right);
        right.cross(up).normalize();
        
        this.target.addScaledVector(right, -deltaX * panSpeed);
        this.target.y = clamp(this.target.y + deltaY * panSpeed, 0, 500);
        this.updateSpherical();
      }
    } else if (this.mode === CAMERA_MODES.STREET || this.mode === CAMERA_MODES.FLIGHT) {
      if (this.isDragging) {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        euler.y -= deltaX * this.rotationSpeed;
        euler.x = clamp(euler.x - deltaY * this.rotationSpeed, -Math.PI / 2.2, Math.PI / 2.2);
        this.camera.quaternion.setFromEuler(euler);
      }
    }
    
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }
  
  onMouseUp() {
    this.isDragging = false;
    this.isPanning = false;
  }
  
  onWheel(e) {
    e.preventDefault();
    
    if (this.mode === CAMERA_MODES.OVERVIEW) {
      const zoomSpeed = 0.001;
      this.distance = clamp(
        this.distance + e.deltaY * this.distance * zoomSpeed,
        this.minDistance,
        this.maxDistance
      );
      this.updateSpherical();
    } else if (this.mode === CAMERA_MODES.FLIGHT) {
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      this.camera.position.addScaledVector(direction, -e.deltaY * 0.2);
      this.camera.position.y = clamp(this.camera.position.y, 5, 500);
    }
  }
  
  onKeyDown(e) {
    this.keys[e.code] = true;
  }
  
  onKeyUp(e) {
    this.keys[e.code] = false;
  }
  
  update(deltaTime) {
    if (this.mode === CAMERA_MODES.OVERVIEW) return;
    
    const speed = (this.mode === CAMERA_MODES.FLIGHT ? this.flightSpeed : this.moveSpeed) * deltaTime;
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    
    this.camera.getWorldDirection(direction);
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    
    if (this.mode === CAMERA_MODES.STREET) {
      direction.y = 0;
      direction.normalize();
    }
    
    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      this.camera.position.addScaledVector(direction, speed);
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      this.camera.position.addScaledVector(direction, -speed);
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      this.camera.position.addScaledVector(right, -speed);
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      this.camera.position.addScaledVector(right, speed);
    }
    
    if (this.mode === CAMERA_MODES.STREET) {
      this.camera.position.y = this.streetHeight;
      const halfMap = this.mapSize * 0.48;
      this.camera.position.x = clamp(this.camera.position.x, -halfMap, halfMap);
      this.camera.position.z = clamp(this.camera.position.z, -halfMap, halfMap);
    } else if (this.mode === CAMERA_MODES.FLIGHT) {
      if (this.keys['Space']) {
        this.camera.position.y += speed;
      }
      if (this.keys['ShiftLeft']) {
        this.camera.position.y -= speed;
      }
      this.camera.position.y = clamp(this.camera.position.y, 5, 500);
      const halfMap = this.mapSize * 0.6;
      this.camera.position.x = clamp(this.camera.position.x, -halfMap, halfMap);
      this.camera.position.z = clamp(this.camera.position.z, -halfMap, halfMap);
    }
  }
  
  dispose() {
    this.domElement.removeEventListener('mousedown', this.mouseDownHandler);
    window.removeEventListener('mousemove', this.mouseMoveHandler);
    window.removeEventListener('mouseup', this.mouseUpHandler);
    this.domElement.removeEventListener('wheel', this.wheelHandler);
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    this.domElement.removeEventListener('contextmenu', this.contextMenuHandler);
  }
}

export { CameraController, CAMERA_MODES };
