let scene, camera, renderer, controls;
let bars = [];
let array = [];
let speed = 200;
let is3DMode = false;
let font;
let animationInProgress = false;

// DOM elements
const arraySizeInput = document.getElementById("arraySize");
const speedInput = document.getElementById("speed");
const visualizationMode = document.getElementById("visualizationMode");
const maxSpeed = 700;
let sorting = false;

// Initialize draggable controls
function initDraggableControls() {
  const controls = document.querySelector('.controls');
  
  // Add drag handle to controls if it doesn't already exist
  let dragHandle = controls.querySelector('.drag-handle');
  if (!dragHandle) {
    dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    controls.prepend(dragHandle);
  }
  
  let isDragging = false;
  let offsetX, offsetY;
  
  // When the user clicks on the drag handle (not the entire controls), start the drag
  dragHandle.addEventListener('mousedown', function(e) {
    // Reset transform to get accurate position
    const computedStyle = window.getComputedStyle(controls);
    const transform = computedStyle.getPropertyValue('transform');
    
    if (transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
      const matrix = new DOMMatrix(transform);
      const currentX = matrix.m41;
      const currentY = matrix.m42;
      
      controls.style.left = currentX + 'px';
      controls.style.top = currentY + 'px';
      controls.style.transform = 'none';
    }
    
    isDragging = true;
    
    // Calculate the offset
    const rect = controls.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    // Add a class to indicate dragging
    controls.classList.add('dragging');
    
    // Prevent text selection during drag
    e.preventDefault();
  });
  
  // When the user moves the mouse, move the controls
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    // Calculate new position
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    
    // Keep controls within viewport bounds
    const maxX = window.innerWidth - controls.offsetWidth;
    const maxY = window.innerHeight - controls.offsetHeight;
    
    const boundedX = Math.max(0, Math.min(x, maxX));
    const boundedY = Math.max(0, Math.min(y, maxY));
    
    controls.style.left = boundedX + 'px';
    controls.style.top = boundedY + 'px';
    controls.style.transform = 'none';
  });
  
  // When the user releases the mouse, stop the drag
  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      controls.classList.remove('dragging');
      
      // Save position in localStorage for persistence
      const rect = controls.getBoundingClientRect();
      localStorage.setItem('controlsPosition', JSON.stringify({
        left: rect.left,
        top: rect.top
      }));
    }
  });
  
  // Load saved position on startup
  const savedPosition = localStorage.getItem('controlsPosition');
  if (savedPosition) {
    try {
      const { left, top } = JSON.parse(savedPosition);
      controls.style.left = left + 'px';
      controls.style.top = top + 'px';
      controls.style.transform = 'none';
    } catch (e) {
      console.error('Failed to load saved controls position:', e);
    }
  }
}

// Initialize Three.js scene
function initThreeJS() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // Create camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 50, 100);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Check if container exists, create it if not
  let container = document.getElementById('canvas-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'canvas-container';
    document.body.appendChild(container);
  }
  container.appendChild(renderer.domElement);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Add directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  scene.add(directionalLight);

  // Add a floor for shadows
  const floorGeometry = new THREE.PlaneGeometry(500, 500);
  const floorMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x111122, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  // Add grid helper
  const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x222222);
  gridHelper.position.y = -0.4;
  scene.add(gridHelper);

  // Add orbit controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.5;
  controls.maxDistance = 300;
  controls.minDistance = 20;

  // Add fog to the scene
  scene.fog = new THREE.FogExp2(0x000000, 0.002);

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Load font for text on bars
  const fontLoader = new THREE.FontLoader();
  fontLoader.load('https://cdn.jsdelivr.net/npm/three@0.137.0/examples/fonts/helvetiker_regular.typeface.json', function(loadedFont) {
    font = loadedFont;
    // Now that the font is loaded, generate the array
    generateArray();
  });

  // Start animation loop
  animate();

  // Initialize draggable controls
  initDraggableControls();
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  if (is3DMode) {
    controls.update();
    
    // Update position & rotation of value labels to face camera
    if (bars.length > 0 && font) {
      bars.forEach(bar => {
        if (bar.userData && bar.userData.textMesh) {
          bar.userData.textMesh.lookAt(camera.position);
        }
      });
    }
    
    renderer.render(scene, camera);
  }
}

// Create a 3D bar for the visualization
function createBar(value, index, total) {
  if (!is3DMode) {
    return create2DBar(value, index, total);
  }
  
  // Calculate maximum width based on array size
  const maxBarWidth = Math.min(4, 100 / total);
  const height = value;
  const width = maxBarWidth;
  const depth = maxBarWidth;
  
  // Calculate position
  const spacing = maxBarWidth * 1.2;
  const totalWidth = total * (width + spacing);
  const startX = -totalWidth / 2 + width / 2;
  const x = startX + index * (width + spacing);
  
  // Create geometry and material with custom shaders for better look
  const geometry = new THREE.BoxGeometry(width, height, depth);
  
  // Create material with gradient
  const material = new THREE.MeshPhongMaterial({ 
    color: 0x00a0ff,
    emissive: 0x003366,
    specular: 0x6699ff,
    shininess: 30
  });
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, height / 2, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Add value as 3D text if font is loaded
  if (font) {
    // Scale text size based on array size
    const textSize = Math.max(0.8, 2.5 - (total * 0.02));
    
    const textGeometry = new THREE.TextGeometry(value.toString(), {
      font: font,
      size: textSize,
      height: 0.1,
      curveSegments: 12
    });
    
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    
    // Center the text
    textGeometry.computeBoundingBox();
    const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
    
    // Position the text above the bar
    textMesh.position.set(x - textWidth / 2, height + 2, 0);
    
    // Group the bar and its text
    const group = new THREE.Group();
    group.add(mesh);
    group.add(textMesh);
    
    // Store original height and value in the group for animations
    group.userData = { 
      originalY: height / 2, 
      value: value, 
      barMesh: mesh, 
      textMesh: textMesh,
      startPosition: { x: x, y: 0, z: 0 }
    };
    
    return group;
  }
  
  return mesh;
}

// Create a 2D bar for visualization
function create2DBar(value, index, total) {
  const barContainer = document.getElementById('bar-container');
  
  // More adaptive width calculation for better visibility
  const barWidth = Math.max(4, Math.min(30, 800 / total));
  const gap = Math.max(1, Math.min(4, 200 / total));
  
  // Create a div element for the bar
  const bar = document.createElement('div');
  bar.className = 'bar';
  
  // Calculate height, ensuring even small values have some visibility
  const heightValue = Math.max(10, value * 5); // Minimum height of 10px
  bar.style.height = `${heightValue}px`;
  
  bar.style.width = `${barWidth}px`;
  bar.style.marginLeft = `${gap}px`;
  bar.style.marginRight = `${gap}px`;
  bar.style.marginBottom = '50px';
  // Enhanced visual for small values
  if (value < 20) {
    bar.setAttribute('data-small-value', 'true');
    // Add a distinct gradient for small values to make them stand out
    bar.style.background = 'linear-gradient(180deg, #00ffcc, #003366)';
    bar.style.boxShadow = '0 0 10px rgba(0, 255, 204, 0.6)';
  } else {
    // Regular bars
    bar.style.background = 'linear-gradient(180deg, #00a0ff, #003366)';
    bar.style.boxShadow = '0 0 10px rgba(0, 160, 255, 0.5)';
  }
  
  // Add value display
  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'bar-value';
  valueDisplay.textContent = value;
  
  // ALWAYS position values above the bars
  valueDisplay.style.bottom = 'auto';
  valueDisplay.style.top = '-25px';
  
  // For very small values, add extra styling to the value display
  if (value < 20) {
    valueDisplay.style.fontWeight = 'bold';
    valueDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    valueDisplay.style.boxShadow = '0 0 5px rgba(0, 255, 204, 0.6)';
  }
  
  bar.appendChild(valueDisplay);
  barContainer.appendChild(bar);
  
  return bar;
}

// Generate a new random array and visualize it
function generateArray() {
  if (sorting) return;
  
  const size = +arraySizeInput.value;
  document.getElementById('arraySizeValue').textContent = size;
  
  // Scale values based on array size to maintain visibility
  const maxValue = 150 - size * 0.5;  // Decrease max value as array size increases
  array = Array.from({ length: size }, () => Math.floor(Math.random() * maxValue) + 10);
  
  renderBars(array);
  
  // Add an introduction animation effect
  animateNewArray();
}

// Introduction animation for newly generated arrays
function animateNewArray() {
  if (is3DMode) {
    animationInProgress = true;
    
    // Scale bars from 0 to full height with staggered timing
    bars.forEach((bar, i) => {
      // Save the original scale
      const originalScale = bar.userData ? bar.userData.barMesh.scale.y : bar.scale.y;
      
      // Set initial scale to 0
      if (bar.userData && bar.userData.barMesh) {
        bar.userData.barMesh.scale.y = 0;
        if (bar.userData.textMesh) {
          bar.userData.textMesh.visible = false;
        }
      } else {
        bar.scale.y = 0;
      }
      
      // Animate to full scale with a staggered delay
      setTimeout(() => {
        const startTime = Date.now();
        const duration = 500; // milliseconds
        
        function scaleUp() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = easeOutBack(progress);
          
          if (bar.userData && bar.userData.barMesh) {
            bar.userData.barMesh.scale.y = easeProgress;
            if (progress >= 1 && bar.userData.textMesh) {
              bar.userData.textMesh.visible = true;
            }
          } else {
            bar.scale.y = easeProgress;
          }
          
          if (progress < 1) {
            requestAnimationFrame(scaleUp);
          } else if (i === bars.length - 1) {
            animationInProgress = false;
          }
        }
        
        scaleUp();
      }, i * 30); // Staggered delay based on index
    });
  } else {
    // For 2D bars
    bars.forEach((bar, i) => {
      bar.style.height = "0px";
      setTimeout(() => {
        bar.style.height = `${array[i] * 5}px`;
      }, i * 30);
    });
  }
}

// Easing function for smoother animations
function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// Render the bars for the current array
function renderBars(arr) {
  if (is3DMode) {
    // Remove existing 3D bars
    bars.forEach(bar => scene.remove(bar));
  } else {
    // Clear 2D container
    document.getElementById('bar-container').innerHTML = '';
  }
  
  bars = [];
  
  // Create new bars
  arr.forEach((value, index) => {
    const bar = createBar(value, index, arr.length);
    if (is3DMode) {
      scene.add(bar);
    }
    bars.push(bar);
  });
}

// Toggle between 2D and 3D visualization
function toggleVisualizationMode() {
  is3DMode = visualizationMode.value === '3d';
  
  // Toggle visibility of containers
  document.getElementById('canvas-container').style.display = is3DMode ? 'block' : 'none';
  document.getElementById('bar-container').style.display = is3DMode ? 'none' : 'flex';
  
  // Re-render with current mode
  renderBars(array);
  
  // Add animation when switching modes
  animateNewArray();
  
  // Enable auto-rotation in 3D mode for a moment
  if (is3DMode && controls) {
    controls.autoRotate = true;
    setTimeout(() => {
      controls.autoRotate = false;
    }, 2000);
  }
}

// QUICK SORT ALGORITHM - FIXED IMPLEMENTATION
async function quickSort(arr, low, high) {
  if (low < high) {
    // Get a random pivot index between low and high (inclusive)
    const pivotIndex = Math.floor(Math.random() * (high - low + 1)) + low;
    
    // Highlight the pivot element
    await highlightPivot(pivotIndex);
    
    // Swap the pivot with the high element
    await swapElements(arr, pivotIndex, high);
    
    // Partition and get the pivot's final position
    const pi = await partition(arr, low, high);
    
    // Recursively sort the sub-arrays
    await quickSort(arr, low, pi - 1);
    await quickSort(arr, pi + 1, high);
  }
}

// Partition function for Quick Sort - FIXED
async function partition(arr, low, high) {
  // Highlight the current range
  await highlightRange(low, high);
  
  const pivot = arr[high]; // Pivot value
  let i = low - 1; // Index of smaller element
  
  for (let j = low; j < high; j++) {
    // Highlight comparison
    await highlightCompare(j, high);
    
    if (arr[j] <= pivot) {
      i++;
      // Swap elements
      if (i !== j) {
        await swapElements(arr, i, j);
      }
    }
    
    // Reset comparison highlight
    await resetCompareHighlight(j, high);
  }
  
  // Final swap to put pivot in its correct position
  await swapElements(arr, i + 1, high);
  
  // Reset range highlights
  await resetRangeHighlight(low, high);
  
  // Highlight the sorted pivot
  await highlightSortedPivot(i + 1);
  
  return i + 1;
}

// Swap array elements and update visualization - FIXED
async function swapElements(arr, i, j) {
  const visualDelay = calculateVisualDelay();
  
  if (i === j) return;
  
  // Swap the array values
  [arr[i], arr[j]] = [arr[j], arr[i]];
  
  // Now update the visual representation
  if (is3DMode) {
    // Store the current positions
    const barI = bars[i];
    const barJ = bars[j];
    const positionI = barI.position.clone();
    const positionJ = barJ.position.clone();
    
    if (skipAnimations()) {
      // Instant position swap
      barI.position.x = positionJ.x;
      barJ.position.x = positionI.x;
      
      // Swap references in bars array
      [bars[i], bars[j]] = [bars[j], bars[i]];
    } else {
      // Animated swap with an arc
      const duration = Math.max(300, visualDelay);
      const startTime = Date.now();
      
      await new Promise(resolve => {
        function animateSwap() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const t = easeInOutQuad(progress);
          
          // Calculate new positions with arc
          const newXI = positionI.x + (positionJ.x - positionI.x) * t;
          const newXJ = positionJ.x + (positionI.x - positionJ.x) * t;
          
          // Add arc for visual appeal
          const arcHeight = Math.abs(positionJ.x - positionI.x) * 0.1;
          const arcI = Math.sin(t * Math.PI) * arcHeight;
          const arcJ = Math.sin(t * Math.PI) * arcHeight;
          
          // Update positions
          barI.position.x = newXI;
          barI.position.y = positionI.y + arcI;
          
          barJ.position.x = newXJ;
          barJ.position.y = positionJ.y + arcJ;
          
          if (progress < 1) {
            requestAnimationFrame(animateSwap);
          } else {
            // Set final positions
            barI.position.x = positionJ.x;
            barI.position.y = positionI.y;
            
            barJ.position.x = positionI.x;
            barJ.position.y = positionJ.y;
            
            // Swap references in bars array
            [bars[i], bars[j]] = [bars[j], bars[i]];
            
            resolve();
          }
        }
        
        animateSwap();
      });
    }
  } else {
    // For 2D bars, we need to update both visual properties and maintain correct references
    const bar1 = document.createElement('div');
    const bar2 = document.createElement('div');
    
    // Copy the HTML content before swapping
    bar1.innerHTML = bars[i].innerHTML;
    bar2.innerHTML = bars[j].innerHTML;
    
    // Copy all styles and classes
    bar1.className = bars[i].className;
    bar2.className = bars[j].className;
    
    // Set heights based on the swapped array values
    const height1 = Math.max(10, arr[i] * 5);
    const height2 = Math.max(10, arr[j] * 5);
    
    bar1.style.cssText = bars[i].style.cssText;
    bar2.style.cssText = bars[j].style.cssText;
    
    bar1.style.height = `${height1}px`;
    bar2.style.height = `${height2}px`;
    
    // Update the value text
    bar1.querySelector('.bar-value').textContent = arr[i];
    bar2.querySelector('.bar-value').textContent = arr[j];
    
    // Replace the bars in the DOM
    const barContainer = document.getElementById('bar-container');
    barContainer.replaceChild(bar1, bars[i]);
    barContainer.replaceChild(bar2, bars[j]);
    
    // Update references in the bars array
    bars[i] = bar1;
    bars[j] = bar2;
    
    // Apply a swap animation class
    bars[i].classList.add('swapped');
    bars[j].classList.add('swapped');
    
    if (!skipAnimations()) {
      await sleep(visualDelay / 2);
      bars[i].classList.remove('swapped');
      bars[j].classList.remove('swapped');
    }
  }
}

// Re-render all bars based on current array state - FALLBACK METHOD
function reRenderBars() {
  const tempArray = [...array]; // Make a copy of the current array
  renderBars(tempArray); // Re-render all bars based on array values
}

// Verify sort is correct
function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i-1]) {
      return false;
    }
  }
  return true;
}

// Start the quick sort visualization - FIXED
async function startQuickSort() {
  if (sorting || animationInProgress) return;
  
  sorting = true;
  const controlsPanel = document.querySelector('.controls');
  controlsPanel.classList.add('sorting');
  
  document.getElementById('sortButton').disabled = true;
  document.getElementById('generateButton').disabled = true;
  arraySizeInput.disabled = true;
  visualizationMode.disabled = true;
  
  try {
    // Create debugging copy of initial array
    const initialArray = [...array];
    
    // Run the sorting algorithm
    await quickSort(array, 0, array.length - 1);
    
    // Verify the array is correctly sorted
    const sortSuccessful = isSorted(array);
    
    if (!sortSuccessful) {
      console.error("Sorting failed! Initial array:", initialArray);
      console.error("Final array:", array);
      
      // As a fallback, correctly sort the array and re-render
      array.sort((a, b) => a - b);
      reRenderBars();
      
      alert("Sort verification failed. The visualization has been corrected.");
    }
    
    // Show completion animation
    await completionAnimation();
  } catch (error) {
    console.error("Error during sorting:", error);
    alert("An error occurred during sorting. See console for details.");
  } finally {
    sorting = false;
    controlsPanel.classList.remove('sorting');
    document.getElementById('sortButton').disabled = false;
    document.getElementById('generateButton').disabled = false;
    arraySizeInput.disabled = false;
    visualizationMode.disabled = false;
  }
}

// Highlight the pivot element
async function highlightPivot(pivotIndex) {
  // Visual delay based on speed
  const visualDelay = calculateVisualDelay();
  
  if (is3DMode) {
    const bar = bars[pivotIndex].userData ? bars[pivotIndex].userData.barMesh : bars[pivotIndex];
    // Bright orange color for pivot
    bar.material.color.set(0xff7f00);
    bar.material.emissive.set(0xcc3300);
    
    // Make the pivot "pulse" by scaling it up and down
    const originalScale = { x: bar.scale.x, y: bar.scale.y, z: bar.scale.z };
    const targetScale = 1.3;
    const animationDuration = 300;
    const startTime = Date.now();
    
    await new Promise(resolve => {
      function pulseAnimation() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        if (progress < 0.5) {
          // Scale up
          const scaleProgress = progress * 2; // Normalize to 0-1
          bar.scale.x = originalScale.x * (1 + (targetScale - 1) * scaleProgress);
          bar.scale.z = originalScale.z * (1 + (targetScale - 1) * scaleProgress);
        } else {
          // Scale down
          const scaleProgress = (progress - 0.5) * 2; // Normalize to 0-1
          bar.scale.x = originalScale.x * (targetScale - (targetScale - 1) * scaleProgress);
          bar.scale.z = originalScale.z * (targetScale - (targetScale - 1) * scaleProgress);
        }
        
        if (progress < 1) {
          requestAnimationFrame(pulseAnimation);
        } else {
          // Reset to original scale
          bar.scale.x = originalScale.x;
          bar.scale.z = originalScale.z;
          resolve();
        }
      }
      
      if (!skipAnimations()) {
        pulseAnimation();
      } else {
        resolve();
      }
    });
    
    // Keep the pivot color for a moment
    if (!skipAnimations()) {
      await sleep(visualDelay);
    }
    
  } else {
    // 2D pivot highlight
    bars[pivotIndex].style.background = 'linear-gradient(180deg, #ff7f00, #cc3300)';
    bars[pivotIndex].style.boxShadow = '0 0 15px rgba(255, 127, 0, 0.7)';
    
    // Add a pulsing animation class
    bars[pivotIndex].classList.add('pivot');
    
    if (!skipAnimations()) {
      await sleep(visualDelay);
    }
  }
}

// Highlight the current range being partitioned
async function highlightRange(low, high) {
  const visualDelay = calculateVisualDelay();
  if (skipAnimations()) return;
  
  for (let i = low; i <= high; i++) {
    if (is3DMode) {
      const bar = bars[i].userData ? bars[i].userData.barMesh : bars[i];
      // Subtle highlight for the current range
      bar.material.color.set(0x64ef00);
      bar.material.emissive.set(0x2a6400);
      
      // Slight elevation to show the active range
      if (!skipAnimations()) {
        bars[i].position.y += 2;
      }
    } else {
      bars[i].classList.add('range');
      bars[i].style.background = 'linear-gradient(180deg, #64ef00, #2a6400)';
      bars[i].style.boxShadow = '0 0 10px rgba(100, 239, 0, 0.5)';
    }
  }
  
  await sleep(visualDelay / 2);
}

// Reset the range highlighting
async function resetRangeHighlight(low, high) {
  if (skipAnimations()) return;
  
  for (let i = low; i <= high; i++) {
    if (is3DMode) {
      const bar = bars[i].userData ? bars[i].userData.barMesh : bars[i];
      bar.material.color.set(0x00a0ff);
      bar.material.emissive.set(0x003366);
      
      // Reset position
      bars[i].position.y = 0;
    } else {
      bars[i].classList.remove('range');
      bars[i].style.background = 'linear-gradient(180deg, #00a0ff, #003366)';
      bars[i].style.boxShadow = '0 0 10px rgba(0, 160, 255, 0.5)';
    }
  }
}

// Highlight the comparison between current element and pivot
async function highlightCompare(current, pivotIndex) {
  const visualDelay = calculateVisualDelay();
  if (skipAnimations()) return;
  
  if (is3DMode) {
    // Current element
    const currentBar = bars[current].userData ? bars[current].userData.barMesh : bars[current];
    currentBar.material.color.set(0xff00ff);
    currentBar.material.emissive.set(0x800080);
    
    // Pivot (already highlighted differently)
    const pivotBar = bars[pivotIndex].userData ? bars[pivotIndex].userData.barMesh : bars[pivotIndex];
    pivotBar.material.color.set(0xff7f00);
    pivotBar.material.emissive.set(0xcc3300);
  } else {
    // 2D highlighting
    bars[current].classList.add('comparing');
    bars[current].style.background = 'linear-gradient(180deg, #ff00ff, #800080)';
    bars[current].style.boxShadow = '0 0 15px rgba(255, 0, 255, 0.6)';
    
    bars[pivotIndex].style.background = 'linear-gradient(180deg, #ff7f00, #cc3300)';
    bars[pivotIndex].style.boxShadow = '0 0 15px rgba(255, 127, 0, 0.7)';
  }
  
  await sleep(visualDelay / 2);
}

// Reset comparison highlight
async function resetCompareHighlight(current, pivotIndex) {
  if (skipAnimations()) return;
  
  if (is3DMode) {
    const currentBar = bars[current].userData ? bars[current].userData.barMesh : bars[current];
    currentBar.material.color.set(0x64ef00);
    currentBar.material.emissive.set(0x2a6400);
    
    // Keep pivot highlighted
    const pivotBar = bars[pivotIndex].userData ? bars[pivotIndex].userData.barMesh : bars[pivotIndex];
    pivotBar.material.color.set(0xff7f00);
    pivotBar.material.emissive.set(0xcc3300);
  } else {
    bars[current].classList.remove('comparing');
    bars[current].style.background = 'linear-gradient(180deg, #64ef00, #2a6400)';
    bars[current].style.boxShadow = '0 0 10px rgba(100, 239, 0, 0.5)';
    
    // Keep pivot highlighted
    bars[pivotIndex].style.background = 'linear-gradient(180deg, #ff7f00, #cc3300)';
    bars[pivotIndex].style.boxShadow = '0 0 15px rgba(255, 127, 0, 0.7)';
  }
}

// Highlight the pivot in its final sorted position
async function highlightSortedPivot(index) {
  const visualDelay = calculateVisualDelay();
  if (skipAnimations()) return;
  
  if (is3DMode) {
    const bar = bars[index].userData ? bars[index].userData.barMesh : bars[index];
    bar.material.color.set(0x09a086);
    bar.material.emissive.set(0x095a50);
    
    // Add a subtle "success" animation
    const startY = bars[index].position.y;
    const hopHeight = 5;
    const animationDuration = 300;
    const startTime = Date.now();
    
    await new Promise(resolve => {
      function hop() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Hop up and down using sine function
        const yOffset = Math.sin(progress * Math.PI) * hopHeight;
        bars[index].position.y = startY + yOffset;
        
        if (progress < 1) {
          requestAnimationFrame(hop);
        } else {
          bars[index].position.y = startY;
          resolve();
        }
      }
      
      hop();
    });
  } else {
    // 2D sorted pivot highlight
    bars[index].classList.add('sorted');
    bars[index].style.background = 'linear-gradient(180deg, #09a086, #095a50)';
    bars[index].style.boxShadow = '0 0 15px rgba(9, 160, 134, 0.6)';
    
    // Add a short animation
    bars[index].style.transform = 'translateY(-5px)';
    await sleep(visualDelay / 2);
    bars[index].style.transform = 'translateY(0)';
  }
}

// Swap two bars in the visualization
async function swapBars(i, j) {
  const visualDelay = calculateVisualDelay();
  
  if (i === j) return;
  
  // Swap the array values
  [array[i], array[j]] = [array[j], array[i]];
  
  if (is3DMode) {
    // Get positions
    const posI = {
      x: bars[i].position.x,
      y: bars[i].position.y,
      z: bars[i].position.z
    };
    
    const posJ = {
      x: bars[j].position.x,
      y: bars[j].position.y,
      z: bars[j].position.z
    };
    
    if (skipAnimations()) {
      // Instant swap for high speeds
      bars[i].position.x = posJ.x;
      bars[j].position.x = posI.x;
      
      // Update the stored bars array
      [bars[i], bars[j]] = [bars[j], bars[i]];
    } else {
      // Animate the swap with an arc
      const animationDuration = Math.max(300, visualDelay);
      const startTime = Date.now();
      
      await new Promise(resolve => {
        function animate() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / animationDuration, 1);
          
          // Eased progress for smoother animation
          const t = easeInOutQuad(progress);
          
          // Calculate new positions with a slight arc
          const newXI = posI.x + (posJ.x - posI.x) * t;
          const newXJ = posJ.x + (posI.x - posJ.x) * t;
          
          // Add an arc to the movement - higher for greater distance swaps
          const arcHeight = Math.abs(posJ.x - posI.x) * 0.1;
          const arcI = Math.sin(t * Math.PI) * arcHeight;
          const arcJ = Math.sin(t * Math.PI) * arcHeight;
          
          // Update positions
          bars[i].position.x = newXI;
          bars[i].position.y = posI.y + arcI;
          
          bars[j].position.x = newXJ;
          bars[j].position.y = posJ.y + arcJ;
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Final positions
            bars[i].position.x = posJ.x;
            bars[i].position.y = posI.y;
            
            bars[j].position.x = posI.x;
            bars[j].position.y = posJ.y;
            
            // Update the stored bars array
            [bars[i], bars[j]] = [bars[j], bars[i]];
            
            resolve();
          }
        }
        
        animate();
      });
    }
  } else {
    // For 2D, recreate the bars in the new order
    updateBatchBars([
      { index: i, value: array[i] },
      { index: j, value: array[j] }
    ]);
    
    // Update the bars array
    [bars[i], bars[j]] = [bars[j], bars[i]];
    
    if (!skipAnimations()) {
      await sleep(visualDelay / 2);
    }
  }
}

// Easing function for smoother animations
function easeInOutQuad(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// Completion animation after sorting is done
async function completionAnimation() {
  // Enable auto-rotation in 3D mode to show off the sorted array
  if (is3DMode) {
    controls.autoRotate = true;
    setTimeout(() => {
      controls.autoRotate = false;
    }, 3000);
  }
  
  for (let i = 0; i < bars.length; i++) {
    if (is3DMode) {
      const bar = bars[i].userData ? bars[i].userData.barMesh : bars[i];
      // Green success color
      bar.material.color.set(0x00ff00);
      bar.material.emissive.set(0x009900);
      
      // Add a slight "hop" animation
      const startY = bars[i].position.y;
      const hopHeight = 5;
      const animationDuration = 300;
      const startTime = Date.now();
      
      await new Promise(resolve => {
        function hop() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / animationDuration, 1);
          
          // Hop up and down using sine function
          const yOffset = Math.sin(progress * Math.PI) * hopHeight;
          bars[i].position.y = startY + yOffset;
          
          if (progress < 1) {
            requestAnimationFrame(hop);
          } else {
            bars[i].position.y = startY;
            resolve();
          }
        }
        
        hop();
      });
    } else {
      // For 2D bars - match the 3D green color scheme
      bars[i].style.background = 'linear-gradient(180deg, #00ff00, #009900)';
      bars[i].style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.6)';
      bars[i].classList.add('success');
      bars[i].style.transform = 'translateY(0)';
      
      // Add a transition delay for cascading effect
      await sleep(30);
    }
  }
}

// Update bars for a batch of updates (for high speed operations)
async function updateBatchBars(updates) {
  if (is3DMode) {
    // For 3D mode, update all bars in batch at once
    updates.forEach(update => {
      scene.remove(bars[update.index]);
      const bar = createBar(update.value, update.index, array.length);
      scene.add(bar);
      
      const meshToColor = bar.userData ? bar.userData.barMesh : bar;
      meshToColor.material.color.set(0x2e8b57);
      meshToColor.material.emissive.set(0x1a5733);
      
      bars[update.index] = bar;
    });
    
    // Brief delay to allow rendering
    await sleep(1);
  } else {
    // For 2D mode - use the same colors as 3D
    updates.forEach(update => {
      bars[update.index].style.height = `${update.value * 5}px`;
      // Update the value and make sure it's visible
      const valueDisplay = bars[update.index].querySelector('.bar-value');
      valueDisplay.textContent = update.value;
      // Ensure it's positioned above the bar
      valueDisplay.style.top = '-25px';
      valueDisplay.style.bottom = 'auto';
      
      bars[update.index].classList.add('merged');
      bars[update.index].style.background = 'linear-gradient(180deg, #09a086, #095a50)';
      bars[update.index].style.boxShadow = '0 0 15px rgba(9, 160, 134, 0.6)';
    });
    
    // Brief delay
    await sleep(1);
  }
}

// Update a single bar
async function updateBar(index, value) {
  if (is3DMode) {
    scene.remove(bars[index]);
    
    const bar = createBar(value, index, array.length);
    scene.add(bar);
    
    // Add a highlight effect
    const meshToColor = bar.userData ? bar.userData.barMesh : bar;
    meshToColor.material.color.set(0x2e8b57);
    meshToColor.material.emissive.set(0x1a5733);
    
    // Add a subtle scale animation
    const originalScale = { x: meshToColor.scale.x, y: meshToColor.scale.y, z: meshToColor.scale.z };
    const targetScale = 1.2;
    const animationDuration = 200;
    const startTime = Date.now();
    
    await new Promise(resolve => {
      function scaleAnimation() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        if (progress < 0.5) {
          // Scale up
          const scaleProgress = progress * 2; // Normalize to 0-1
          meshToColor.scale.x = originalScale.x * (1 + (targetScale - 1) * scaleProgress);
          meshToColor.scale.z = originalScale.z * (1 + (targetScale - 1) * scaleProgress);
        } else {
          // Scale down
          const scaleProgress = (progress - 0.5) * 2; // Normalize to 0-1
          meshToColor.scale.x = originalScale.x * (targetScale - (targetScale - 1) * scaleProgress);
          meshToColor.scale.z = originalScale.z * (targetScale - (targetScale - 1) * scaleProgress);
        }
        
        if (progress < 1) {
          requestAnimationFrame(scaleAnimation);
        } else {
          // Reset to original scale
          meshToColor.scale.x = originalScale.x;
          meshToColor.scale.z = originalScale.z;
          resolve();
        }
      }
      
      scaleAnimation();
    });
    
    bars[index] = bar;
  } else {
    // Update 2D bar with animation
    const currentHeight = parseInt(bars[index].style.height);
    const targetHeight = value * 5;
    const animationDuration = 200;
    const startTime = Date.now();
    
    await new Promise(resolve => {
      function updateHeight() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Smooth easing
        const easedProgress = easeOutCubic(progress);
        const newHeight = currentHeight + (targetHeight - currentHeight) * easedProgress;
        
        bars[index].style.height = `${newHeight}px`;
        
        if (progress < 1) {
          requestAnimationFrame(updateHeight);
        } else {
          // Update value and ensure it's positioned correctly
          const valueDisplay = bars[index].querySelector('.bar-value');
          valueDisplay.textContent = value;
          valueDisplay.style.top = '-25px';
          valueDisplay.style.bottom = 'auto';
          
          bars[index].classList.add('merged');
          resolve();
        }
      }
      
      updateHeight();
    });
  }
}

// Calculate visual delay based on speed setting
function calculateVisualDelay() {
  // Super aggressive speed optimization
  if (speed > 950) {
    return 0; // Essentially no delay
  } else if (speed > 900) {
    return 1; // Almost instantaneous
  } else if (speed > 700) {
    return 5; // Extremely fast
  } else if (speed > 500) {
    return 20; // Very fast
  } else {
    return Math.max(30, 1000 - speed * 1.2); // Normal to slow speeds
  }
}

// Determine if animations should be skipped for very high speeds
function skipAnimations() {
  return speed > 900;
}

// Cubic easing function for smoother animations
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

// Helper sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Update speed display text
function updateSpeedText() {
  const speedValue = speedInput.value;
  let speedText;
  
  // Higher values = faster speeds
  if (speedValue > 950) {
    speedText = 'Instant';
  } else if (speedValue > 900) {
    speedText = 'Ultra Fast';
  } else if (speedValue > 750) {
    speedText = 'Very Fast';
  } else if (speedValue > 500) {
    speedText = 'Fast';
  } else if (speedValue > 350) {
    speedText = 'Medium';
  } else {
    speedText = 'Slow';
  }
  
  document.getElementById('speedValue').textContent = speedText;
}

// Event listeners
arraySizeInput.addEventListener("input", () => {
  document.getElementById('arraySizeValue').textContent = arraySizeInput.value;
  generateArray();
});

speedInput.addEventListener("input", () => {
  // Invert the slider value to make higher = faster
  speed = +speedInput.value; // No need to use maxSpeed - value
  updateSpeedText();
});

visualizationMode.addEventListener("change", toggleVisualizationMode);

// When the page loads, set the speed to a high value by default
document.addEventListener('DOMContentLoaded', function() {
  // Set default to 2D mode
  is3DMode = false;
  visualizationMode.value = "2d";
  
  // Set default speed to very fast
  speedInput.value = 900;
  speed = 900;
  updateSpeedText();
  
  // Generate the initial array
  generateArray();
});

// Initialize
updateSpeedText();
initThreeJS();