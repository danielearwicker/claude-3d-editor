import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

// Mode constants
const MODES = {
    VIEW: "view",
    EDIT: "edit",
    ADD: "add",
};

const CubeScene = () => {
    const mountRef = useRef(null);
    const [mode, setMode] = useState(MODES.VIEW);

    // Use refs to store values that need to be accessed by event handlers
    const sceneRef = useRef({
        cube: null,
        camera: null,
        controlPoints: [],
        controlPointsGroup: null,
        isDragging: false,
        selectedControlPoint: null,
        previousMousePosition: { x: 0, y: 0 },
        raycaster: new THREE.Raycaster(),
        mouse: new THREE.Vector2(),
        cubeGeometry: null,
        renderer: null,
        viewButton: null,
        editButton: null,
        addButton: null,
    });

    // Define handlers outside useEffect so they have access to current mode
    const handleMouseDown = useCallback(
        (e) => {
            console.log("Mouse down in mode:", mode);
            const {
                raycaster,
                mouse,
                controlPoints,
                cube,
                previousMousePosition,
            } = sceneRef.current;

            // Calculate mouse position in normalized device coordinates
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

            // Set up raycaster
            raycaster.setFromCamera(mouse, sceneRef.current.camera);

            if (mode === MODES.ADD) {
                // In add mode, check if we clicked on a face of the cube
                const intersects = raycaster.intersectObject(cube);

                if (intersects.length > 0) {
                    const intersect = intersects[0];

                    // Get the face index
                    const faceIndex = Math.floor(intersect.faceIndex);
                    console.log("Clicked on face index:", faceIndex);

                    // Add a new vertex at the intersection point
                    addVertex(intersect.point, faceIndex);
                }
            } else if (mode === MODES.EDIT) {
                // In edit mode, check if we clicked on a control point
                const allControlPoints = [];
                controlPoints.forEach((point) => {
                    allControlPoints.push(point);
                });

                const intersects = raycaster.intersectObjects(allControlPoints);

                if (intersects.length > 0) {
                    sceneRef.current.selectedControlPoint =
                        intersects[0].object;
                    sceneRef.current.isDragging = true;
                    console.log(
                        "Selected control point:",
                        intersects[0].object.userData.index
                    );
                }
            } else if (mode === MODES.VIEW) {
                // View mode - just rotate the cube
                sceneRef.current.isDragging = true;
            }

            previousMousePosition.x = e.clientX;
            previousMousePosition.y = e.clientY;
        },
        [mode]
    );

    // Function to update cube geometry when control points move
    const updateCubeGeometry = useCallback(() => {
        const { cubeGeometry, controlPoints } = sceneRef.current;
        const positions = cubeGeometry.attributes.position.array;

        for (let i = 0; i < controlPoints.length; i++) {
            const point = controlPoints[i];
            const index = point.userData.index;

            positions[index * 3] = point.position.x;
            positions[index * 3 + 1] = point.position.y;
            positions[index * 3 + 2] = point.position.z;
        }

        cubeGeometry.attributes.position.needsUpdate = true;
        cubeGeometry.computeVertexNormals();
    }, []);

    const handleMouseMove = useCallback(
        (e) => {
            if (!sceneRef.current.isDragging) return;

            const {
                previousMousePosition,
                selectedControlPoint,
                cube,
                camera,
            } = sceneRef.current;

            const deltaMove = {
                x: e.clientX - previousMousePosition.x,
                y: e.clientY - previousMousePosition.y,
            };

            if (mode === MODES.EDIT && selectedControlPoint) {
                // Move the selected control point
                const movementSpeed = 0.01;

                // Create vectors for the camera's right and up directions
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
                    camera.quaternion
                );
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
                    camera.quaternion
                );

                // Calculate movement in world space
                const moveX = right
                    .clone()
                    .multiplyScalar(deltaMove.x * movementSpeed);
                const moveY = up
                    .clone()
                    .multiplyScalar(-deltaMove.y * movementSpeed);

                // Apply movement
                selectedControlPoint.position.add(moveX);
                selectedControlPoint.position.add(moveY);

                // Update the cube geometry
                updateCubeGeometry();
                console.log("Moving control point in EDIT mode");
            } else if (mode === MODES.VIEW) {
                // Only rotate the cube in view mode
                cube.rotation.y += deltaMove.x * 0.01;
                cube.rotation.x += deltaMove.y * 0.01;
            }

            previousMousePosition.x = e.clientX;
            previousMousePosition.y = e.clientY;
        },
        [mode, updateCubeGeometry]
    );

    const handleMouseUp = useCallback(() => {
        sceneRef.current.isDragging = false;
        if (mode !== MODES.EDIT) {
            sceneRef.current.selectedControlPoint = null;
        }
    }, [mode]);

    // Function to add a new vertex
    const addVertex = useCallback((position, faceIndex) => {
        console.log("Adding vertex at face index:", faceIndex);
        const { cubeGeometry, controlPoints, controlPointsGroup } =
            sceneRef.current;

        // Get current positions and indices
        const positions = Array.from(cubeGeometry.attributes.position.array);
        const indices = Array.from(cubeGeometry.getIndex().array);

        // Add the new vertex position
        const newVertexIndex = positions.length / 3;
        positions.push(position.x, position.y, position.z);

        // Create a new control point for this vertex
        const controlPointGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const controlPointMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
        });

        const controlPoint = new THREE.Mesh(
            controlPointGeometry,
            controlPointMaterial
        );
        controlPoint.position.copy(position);
        controlPoint.userData.index = newVertexIndex;
        controlPoint.visible = true;

        controlPoints.push(controlPoint);
        controlPointsGroup.add(controlPoint);

        // Get the face that was clicked (3 vertices)
        const faceStartIndex = faceIndex * 3;
        const faceVertices = [
            indices[faceStartIndex],
            indices[faceStartIndex + 1],
            indices[faceStartIndex + 2],
        ];

        console.log("Face vertices:", faceVertices);

        // Remove the original face
        indices.splice(faceStartIndex, 3);

        // Add three new faces connecting the new vertex to each edge of the original face
        indices.push(
            faceVertices[0],
            faceVertices[1],
            newVertexIndex,
            faceVertices[1],
            faceVertices[2],
            newVertexIndex,
            faceVertices[2],
            faceVertices[0],
            newVertexIndex
        );

        // Update the geometry
        cubeGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3)
        );
        cubeGeometry.setIndex(indices);
        cubeGeometry.computeVertexNormals();

        // Log success message
        console.log(
            `Added new vertex at position (${position.x.toFixed(
                2
            )}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`
        );
        console.log(`New vertex index: ${newVertexIndex}`);
    }, []);

    // Mode switching functions
    const setViewMode = useCallback(() => {
        const { controlPoints, cube, viewButton, editButton, addButton, controlPointsGroup } =
            sceneRef.current;

        // Reset interaction state only
        sceneRef.current.selectedControlPoint = null;
        sceneRef.current.isDragging = false;

        // Hide control points
        controlPoints.forEach((point) => {
            point.visible = false;
        });

        // Remove any wireframe from ADD mode
        cube.children.forEach(child => {
            if (child.isLineSegments && child !== controlPointsGroup) {
                cube.remove(child);
                child.geometry.dispose();
                child.material.dispose();
            }
        });

        // Change material to normal material but preserve geometry
        const newMaterial = new THREE.MeshNormalMaterial();
        newMaterial.needsUpdate = true;
        cube.material = newMaterial;

        // Update UI
        viewButton.style.backgroundColor = "#3367d6";
        editButton.style.backgroundColor = "#4285f4";
        addButton.style.backgroundColor = "#4285f4";

        setMode(MODES.VIEW);
        console.log("Switched to VIEW mode - drag to rotate cube");
    }, [setMode]);

    const setEditMode = useCallback(() => {
        const { controlPoints, cube, viewButton, editButton, addButton, controlPointsGroup } =
            sceneRef.current;

        // Reset interaction state only
        sceneRef.current.selectedControlPoint = null;
        sceneRef.current.isDragging = false;

        // Show control points - make sure they're visible
        controlPoints.forEach((point) => {
            point.visible = true;
        });
        console.log("Making control points visible:", controlPoints.length);

        // Remove any wireframe from ADD mode
        cube.children.forEach(child => {
            if (child.isLineSegments && child !== controlPointsGroup) {
                cube.remove(child);
                child.geometry.dispose();
                child.material.dispose();
            }
        });

        // Change material to see structure better but preserve geometry
        const editMaterial = new THREE.MeshNormalMaterial({
            wireframe: false,
            transparent: true,
            opacity: 0.8,
        });
        editMaterial.needsUpdate = true;
        cube.material = editMaterial;

        // Update UI
        viewButton.style.backgroundColor = "#4285f4";
        editButton.style.backgroundColor = "#3367d6";
        addButton.style.backgroundColor = "#4285f4";

        setMode(MODES.EDIT);
        console.log(
            "Switched to EDIT mode - click and drag control points to move vertices"
        );
    }, [setMode]);

    const setAddMode = useCallback(() => {
        const { controlPoints, cube, viewButton, editButton, addButton } =
            sceneRef.current;

        // Reset interaction state only
        sceneRef.current.selectedControlPoint = null;
        sceneRef.current.isDragging = false;

        controlPoints.forEach((point) => {
            point.visible = true;
        });

        // Create a material that shows both wireframe and faces
        const addMaterial = new THREE.MeshPhongMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        // Add wireframe
        const wireframeGeometry = new THREE.WireframeGeometry(cube.geometry);
        const wireframe = new THREE.LineSegments(wireframeGeometry);
        wireframe.material.color.set(0x000000);
        wireframe.material.linewidth = 2;
        
        // Remove any existing wireframe
        cube.children.forEach(child => {
            if (child.isLineSegments) {
                cube.remove(child);
                child.geometry.dispose();
                child.material.dispose();
            }
        });
        
        // Add new wireframe
        cube.add(wireframe);
        sceneRef.current.wireframe = wireframe;
        
        // Set the cube material
        cube.material = addMaterial;

        // Update UI
        viewButton.style.backgroundColor = "#4285f4";
        editButton.style.backgroundColor = "#4285f4";
        addButton.style.backgroundColor = "#3367d6";

        setMode(MODES.ADD);
        console.log(
            "Switched to ADD mode - click on a face to add a new vertex"
        );
    }, [setMode]);

    // Reset cube function
    const resetCube = useCallback(() => {
        const { cube, controlPoints, controlPointsGroup, cubeGeometry } =
            sceneRef.current;

        const size = 1;
        const positions = [
            // Front face
            -size,
            -size,
            size, // 0: bottom-left-front
            size,
            -size,
            size, // 1: bottom-right-front
            size,
            size,
            size, // 2: top-right-front
            -size,
            size,
            size, // 3: top-left-front
            // Back face
            -size,
            -size,
            -size, // 4: bottom-left-back
            size,
            -size,
            -size, // 5: bottom-right-back
            size,
            size,
            -size, // 6: top-right-back
            -size,
            size,
            -size, // 7: top-left-back
        ];

        // Remove any extra control points beyond the original 8
        while (controlPoints.length > 8) {
            const point = controlPoints.pop();
            controlPointsGroup.remove(point);
            point.geometry.dispose();
            point.material.dispose();
        }

        // Reset remaining control points
        for (let i = 0; i < controlPoints.length; i++) {
            controlPoints[i].position.set(
                positions[i * 3],
                positions[i * 3 + 1],
                positions[i * 3 + 2]
            );
            controlPoints[i].userData.index = i;
        }

        // Reset cube geometry to original box
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
            4, 0, 3, 4, 3, 7,
        ];

        cubeGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3)
        );
        cubeGeometry.setIndex(indices);
        cubeGeometry.computeVertexNormals();

        // Reset cube rotation
        cube.rotation.set(0, 0, 0);

        // Update UI to match view mode but don't call setViewMode() which would trigger effects
        const { viewButton, editButton, addButton } = sceneRef.current;
        viewButton.style.backgroundColor = "#3367d6";
        editButton.style.backgroundColor = "#4285f4";
        addButton.style.backgroundColor = "#4285f4";

        // Set mode directly
        setMode(MODES.VIEW);

        // Make control points invisible
        controlPoints.forEach((point) => {
            point.visible = false;
        });

        console.log("Cube reset to original state");
    }, []);

    // Scene setup effect - only runs once
    useEffect(() => {
        console.log("Setting up scene - this should only run once");
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
        sceneRef.current.camera = camera;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        mountRef.current.appendChild(renderer.domElement);
        sceneRef.current.renderer = renderer;

        // Create cube with custom geometry
        const size = 1; // Half-width of the cube
        const cubeGeometry = new THREE.BufferGeometry();
        sceneRef.current.cubeGeometry = cubeGeometry;

        // Define the 8 corners of the cube
        const vertices = new Float32Array([
            // Front face
            -size,
            -size,
            size, // 0: bottom-left-front
            size,
            -size,
            size, // 1: bottom-right-front
            size,
            size,
            size, // 2: top-right-front
            -size,
            size,
            size, // 3: top-left-front
            // Back face
            -size,
            -size,
            -size, // 4: bottom-left-back
            size,
            -size,
            -size, // 5: bottom-right-back
            size,
            size,
            -size, // 6: top-right-back
            -size,
            size,
            -size, // 7: top-left-back
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
            4, 0, 3, 4, 3, 7,
        ];

        cubeGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(vertices, 3)
        );
        cubeGeometry.setIndex(indices);
        cubeGeometry.computeVertexNormals();

        const material = new THREE.MeshNormalMaterial();
        const cube = new THREE.Mesh(cubeGeometry, material);
        scene.add(cube);
        sceneRef.current.cube = cube;

        // Create control points for each corner
        const controlPoints = [];
        const controlPointsGroup = new THREE.Group();
        sceneRef.current.controlPoints = controlPoints;
        sceneRef.current.controlPointsGroup = controlPointsGroup;

        const controlPointGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const controlPointMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
        });

        // Create a control point for each vertex
        for (let i = 0; i < 8; i++) {
            const x = vertices[i * 3];
            const y = vertices[i * 3 + 1];
            const z = vertices[i * 3 + 2];

            const controlPoint = new THREE.Mesh(
                controlPointGeometry,
                controlPointMaterial
            );
            controlPoint.position.set(x, y, z);
            controlPoint.userData.index = i; // Store the vertex index
            controlPoint.visible = false; // Initially hidden

            controlPoints.push(controlPoint);
            controlPointsGroup.add(controlPoint);
        }

        // Add the control points group to the cube so they rotate with it
        cube.add(controlPointsGroup);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 0);
        scene.add(directionalLight);

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };

        animate();

        // Create UI buttons
        const buttonContainer = document.createElement("div");
        buttonContainer.style.position = "absolute";
        buttonContainer.style.top = "10px";
        buttonContainer.style.left = "10px";
        buttonContainer.style.zIndex = "100";
        buttonContainer.style.display = "flex";
        buttonContainer.style.flexDirection = "row";
        buttonContainer.style.gap = "10px";

        // Style for all buttons
        const buttonStyle = {
            padding: "8px 12px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "background-color 0.3s",
        };

        const viewButton = document.createElement("button");
        viewButton.textContent = "View Mode";
        viewButton.addEventListener("click", setViewMode);
        Object.assign(viewButton.style, buttonStyle);
        viewButton.style.backgroundColor = "#3367d6";
        viewButton.style.color = "white";
        buttonContainer.appendChild(viewButton);
        sceneRef.current.viewButton = viewButton;

        const editButton = document.createElement("button");
        editButton.textContent = "Edit Mode";
        editButton.addEventListener("click", setEditMode);
        Object.assign(editButton.style, buttonStyle);
        editButton.style.backgroundColor = "#4285f4";
        editButton.style.color = "white";
        buttonContainer.appendChild(editButton);
        sceneRef.current.editButton = editButton;

        const addButton = document.createElement("button");
        addButton.textContent = "Add Vertex Mode";
        addButton.addEventListener("click", setAddMode);
        Object.assign(addButton.style, buttonStyle);
        addButton.style.backgroundColor = "#4285f4";
        addButton.style.color = "white";
        buttonContainer.appendChild(addButton);
        sceneRef.current.addButton = addButton;

        const resetButton = document.createElement("button");
        resetButton.textContent = "Reset Cube";
        resetButton.addEventListener("click", resetCube);
        Object.assign(resetButton.style, buttonStyle);
        resetButton.style.backgroundColor = "#f44336";
        resetButton.style.color = "white";
        buttonContainer.appendChild(resetButton);

        mountRef.current.appendChild(buttonContainer);

        // Handle window resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener("resize", handleResize);

        // Set initial mode only on first render
        if (mode === MODES.VIEW) {
            // Only set visibility of control points, don't change geometry
            sceneRef.current.controlPoints.forEach((point) => {
                point.visible = false;
            });

            // Set initial button colors
            sceneRef.current.viewButton.style.backgroundColor = "#3367d6";
            sceneRef.current.editButton.style.backgroundColor = "#4285f4";
            sceneRef.current.addButton.style.backgroundColor = "#4285f4";
        }

        // Cleanup function
        return () => {
            window.removeEventListener("resize", handleResize);
            mountRef.current.removeChild(renderer.domElement);
            mountRef.current.removeChild(buttonContainer);
            
            // Properly dispose of all materials and geometries
            cubeGeometry.dispose();
            material.dispose();
            
            // Dispose of any wireframe or other children
            if (cube) {
                cube.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        };
    }, []); // Empty dependency array means this only runs once

    // Effect to update control points visibility when mode changes
    useEffect(() => {
        if (!sceneRef.current.controlPoints) return;

        // Only update visibility, don't modify geometry or position
        if (mode === MODES.EDIT || mode === MODES.ADD) {
            sceneRef.current.controlPoints.forEach((point) => {
                point.visible = true;
            });
            console.log(
                `Mode changed to ${mode}, making control points visible`
            );
        } else if (mode === MODES.VIEW) {
            sceneRef.current.controlPoints.forEach((point) => {
                point.visible = false;
            });
            console.log(`Mode changed to ${mode}, hiding control points`);
        }
    }, [mode]);

    // Effect for event listeners that depend on mode
    useEffect(() => {
        if (!sceneRef.current.renderer) return;
        
        const renderer = sceneRef.current.renderer;
        
        // Add event listeners
        renderer.domElement.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        
        // Cleanup function
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            renderer.domElement.removeEventListener(
                "mousedown",
                handleMouseDown
            );
        };
    }, [handleMouseDown, handleMouseMove, handleMouseUp]);

    return (
        <div ref={mountRef} style={{ width: "100%", height: "100vh" }}>
            {/* Mode indicator */}
            <div
                style={{
                    position: "absolute",
                    bottom: "10px",
                    left: "10px",
                    padding: "10px 15px",
                    backgroundColor: "rgba(0,0,0,0.7)",
                    color: "white",
                    borderRadius: "4px",
                    zIndex: 100,
                    fontWeight: "bold",
                    fontSize: "16px",
                }}
            >
                Current Mode: {mode.toUpperCase()}
                <div
                    style={{
                        fontSize: "12px",
                        marginTop: "5px",
                        fontWeight: "normal",
                    }}
                >
                    {mode === MODES.VIEW && "Drag to rotate the cube"}
                    {mode === MODES.EDIT &&
                        "Click and drag red control points to move vertices"}
                    {mode === MODES.ADD &&
                        "Click on a face to add a new vertex"}
                </div>
            </div>
        </div>
    );
};

export default CubeScene;
