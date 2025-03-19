import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const CubeScene = () => {
  const mountRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  
  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75, // Field of view
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    camera.position.z = 5;
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);
    
    // Create cube with custom geometry
    const size = 1; // Half-width of the cube
    const cubeGeometry = new THREE.BufferGeometry();
    
    // Define the 8 corners of the cube
    const vertices = new Float32Array([
      // Front face
      -size, -size,  size, // 0: bottom-left-front
       size, -size,  size, // 1: bottom-right-front
       size,  size,  size, // 2: top-right-front
      -size,  size,  size, // 3: top-left-front
      // Back face
      -size, -size, -size, // 4: bottom-left-back
       size, -size, -size, // 5: bottom-right-back
       size,  size, -size, // 6: top-right-back
      -size,  size, -size  // 7: top-left-back
    ]);
    
    // Define the faces using indices
    const indices = [
      // Front face
      0, 1, 2, 0, 2, 3,
      // Back face
      5, 4, 7, 5, 7, 6,
      // Top face
      3, 2, 6, 3, 6, 7,
      // Bottom face
      4, 5, 1, 4, 1, 0,
      // Right face
      1, 5, 6, 1, 6, 2,
      // Left face
      4, 0, 3, 4, 3, 7
    ];
    
    cubeGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    cubeGeometry.setIndex(indices);
    cubeGeometry.computeVertexNormals();
    
    const material = new THREE.MeshNormalMaterial();
    const cube = new THREE.Mesh(cubeGeometry, material);
    scene.add(cube);
    
    // Create control points for each corner
    const controlPoints = [];
    const controlPointsGroup = new THREE.Group();
    scene.add(controlPointsGroup);
    
    const controlPointGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const controlPointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    // Create a control point for each vertex
    for (let i = 0; i < 8; i++) {
      const x = vertices[i * 3];
      const y = vertices[i * 3 + 1];
      const z = vertices[i * 3 + 2];
      
      const controlPoint = new THREE.Mesh(controlPointGeometry, controlPointMaterial);
      controlPoint.position.set(x, y, z);
      controlPoint.userData.index = i; // Store the vertex index
      controlPoint.visible = false; // Initially hidden
      
      controlPoints.push(controlPoint);
      controlPointsGroup.add(controlPoint);
    }
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);
    
    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Mouse interaction variables
    let isDragging = false;
    let previousMousePosition = {
      x: 0,
      y: 0
    };
    let selectedControlPoint = null;
    
    // Toggle edit mode function
    const toggleEditMode = () => {
      const newEditMode = !controlPoints[0].visible;
      controlPoints.forEach(point => {
        point.visible = newEditMode;
      });
      setEditMode(newEditMode);
    };
    
    // Create a toggle button for edit mode
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Toggle Edit Mode';
    toggleButton.style.position = 'absolute';
    toggleButton.style.top = '10px';
    toggleButton.style.left = '10px';
    toggleButton.style.zIndex = '100';
    toggleButton.addEventListener('click', toggleEditMode);
    mountRef.current.appendChild(toggleButton);
    
    // Update cube geometry when control points move
    const updateCubeGeometry = () => {
      const positions = cubeGeometry.attributes.position.array;
      
      for (let i = 0; i < controlPoints.length; i++) {
        const point = controlPoints[i];
        positions[i * 3] = point.position.x;
        positions[i * 3 + 1] = point.position.y;
        positions[i * 3 + 2] = point.position.z;
      }
      
      cubeGeometry.attributes.position.needsUpdate = true;
      cubeGeometry.computeVertexNormals();
    };
    
    // Mouse event handlers
    const handleMouseDown = (e) => {
      // Calculate mouse position in normalized device coordinates
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      
      // Check if we're in edit mode
      if (controlPoints[0].visible) {
        // Check if we clicked on a control point
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(controlPoints);
        
        if (intersects.length > 0) {
          selectedControlPoint = intersects[0].object;
          isDragging = true;
        } else {
          // If not clicking on a control point, rotate the cube
          isDragging = true;
          selectedControlPoint = null;
        }
      } else {
        // Normal rotation mode
        isDragging = true;
        selectedControlPoint = null;
      }
      
      previousMousePosition = {
        x: e.clientX,
        y: e.clientY
      };
    };
    
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };
      
      if (selectedControlPoint) {
        // Move the selected control point
        // Convert screen movement to 3D movement
        // This is a simplified approach - in a real app you'd use a proper 3D transformation
        const movementSpeed = 0.01;
        
        // Move in the camera's coordinate system
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        
        selectedControlPoint.position.add(right.multiplyScalar(deltaMove.x * movementSpeed));
        selectedControlPoint.position.add(up.multiplyScalar(-deltaMove.y * movementSpeed));
        
        // Update the cube geometry
        updateCubeGeometry();
      } else {
        // Rotate the cube based on mouse movement
        cube.rotation.y += deltaMove.x * 0.01;
        cube.rotation.x += deltaMove.y * 0.01;
      }
      
      previousMousePosition = {
        x: e.clientX,
        y: e.clientY
      };
    };
    
    const handleMouseUp = () => {
      isDragging = false;
      selectedControlPoint = null;
    };
    
    // Add event listeners
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      mountRef.current.removeChild(renderer.domElement);
      mountRef.current.removeChild(toggleButton);
      cubeGeometry.dispose();
      material.dispose();
      controlPointGeometry.dispose();
      controlPointMaterial.dispose();
    };
  }, []);
  
  return (
    <div ref={mountRef} style={{ width: '100%', height: '100vh' }}>
      {/* The toggle button is added directly to the DOM in the useEffect */}
    </div>
  );
};

export default CubeScene;
