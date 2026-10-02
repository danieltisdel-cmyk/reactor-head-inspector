// Reactor Head Inspector - Main JavaScript Logic

// Data structures
class ReactorHead {
  constructor(id, name, penetrations, layout, rows) {
    this.id = id;
    this.name = name;
    this.penetrations = penetrations;
    this.layout = layout;
    this.rows = rows;
    this.currentRow = 1;
    this.penetrationData = {}; // {penetrationId: {quadrants: [status, status, status, status]}}
    this.initializePenetrations();
  }

  initializePenetrations() {
    // Initialize all penetrations with uninspected quadrants
    for (let i = 1; i <= this.penetrations; i++) {
      this.penetrationData[i] = {
        quadrants: Array(4).fill(0) // 0=uninspected, 1=in-progress, 2=inspected, 3=needs-attention
      };
    }
  }

  getQuadrantStatus(penetrationId, quadrantNum) {
    return this.penetrationData[penetrationId]?.quadrants[quadrantNum - 1] || 0;
  }

  setQuadrantStatus(penetrationId, quadrantNum, status) {
    if (!this.penetrationData[penetrationId]) {
      this.penetrationData[penetrationId] = {
        quadrants: Array(4).fill(0)
      };
    }
    this.penetrationData[penetrationId].quadrants[quadrantNum - 1] = status;
  }

  getCompletionPercentage() {
    const totalQuadrants = this.penetrations * 4;
    let completedQuadrants = 0;

    for (let penId = 1; penId <= this.penetrations; penId++) {
      const statuses = this.penetrationData[penId]?.quadrants || Array(4).fill(0);
      completedQuadrants += statuses.filter(status => status === 2).length; // Only count inspected (2)
    }

    return totalQuadrants === 0 ? 0 : Math.round((completedQuadrants / totalQuadrants) * 100);
  }

  getCurrentRowQuadrants() {
    // Return penetrations in current row based on layout
    // This is a simplified version - in reality, layout would determine row assignment
    const penetrationsPerRow = Math.ceil(this.penetrations / this.rows);
    const startPen = (this.currentRow - 1) * penetrationsPerRow + 1;
    const endPen = Math.min(startPen + penetrationsPerRow - 1, this.penetrations);
    
    const rowPenetrations = [];
    for (let i = startPen; i <= endPen; i++) {
      rowPenetrations.push(i);
    }
    return rowPenetrations;
  }
}

// Application state
let currentHead = null;
const heads = {};
let editingPenetrationId = null; // Track which penetration is being edited
const quadrantImages = {}; // {penetrationId: {quadrantNum: imageUrlOrDataUrl}}

// DOM elements
const elements = {
  headSelect: document.getElementById('headSelect'),
  headName: document.getElementById('headName'),
  headPenetrations: document.getElementById('headPenetrations'),
  layoutSelect: document.getElementById('layoutSelect'),
  rowsInput: document.getElementById('rowsInput'),
  progressPercent: document.getElementById('progressPercent'),
  progressDetail: document.getElementById('progressDetail'),
  progressFill: document.getElementById('progressFill'),
  currentRow: document.getElementById('currentRow'),
  prevRowBtn: document.getElementById('prevRowBtn'),
  nextRowBtn: document.getElementById('nextRowBtn'),
  rowJumpInput: document.getElementById('rowJumpInput'),
  rowJumpBtn: document.getElementById('rowJumpBtn'),
  reactorHead: document.getElementById('reactorHead'),
  quadrantDetails: document.getElementById('quadrantDetails'),
  penetrationGrid: document.getElementById('penetrationGrid'),
  newHeadBtn: document.getElementById('newHeadBtn'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
  resetBtn: document.getElementById('resetBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  printBtn: document.getElementById('printBtn'),
  statusMsg: document.getElementById('statusMsg'),
  lastSaved: document.getElementById('lastSaved'),
  addPenetrationBtn: document.getElementById('addPenetrationBtn'),
  movePenetrationBtn: document.getElementById('movePenetrationBtn'),
  deletePenetrationBtn: document.getElementById('deletePenetrationBtn')
};

// Quadrant status mapping
const QuadrantStatus = {
  0: { label: 'Pending', color: '#6b7280', class: 'dot-gray' },
  1: { label: 'In Progress', color: '#eab308', class: 'dot-yellow' },
  2: { label: 'Inspected', color: '#22c55e', class: 'dot-green' },
  3: { label: 'Needs Attention', color: '#ef4444', class: 'dot-red' }
};

// Image upload/preview support
let currentPenetrationId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  loadSampleData();
  initializeEventListeners();
  updateUI();
});

// Load sample data
function loadSampleData() {
  // Create sample reactor heads
  const sampleHeads = [
    new ReactorHead('rh-001', 'Reactor Head A', 76, 'octagonal', 8),
    new ReactorHead('rh-002', 'Reactor Head B', 96, 'circular', 12),
    new ReactorHead('rh-003', 'Reactor Head C', 64, 'square', 8)
  ];

  sampleHeads.forEach(head => {
    heads[head.id] = head;
  });

  // Set first head as current
  currentHead = sampleHeads[0];
  updateHeadSelect();
  updateHeadInfo();
}

// Initialize event listeners
function initializeEventListeners() {
  // Head selection
  elements.headSelect.addEventListener('change', (e) => {
    const headId = e.target.value;
    if (headId && heads[headId]) {
      currentHead = heads[headId];
      updateHeadInfo();
      updateUI();
    }
  });

  // New head button
  elements.newHeadBtn.addEventListener('click', createNewHead);

  // Save/Load buttons
  elements.saveBtn.addEventListener('click', saveData);
  elements.loadBtn.addEventListener('click', loadData);
  elements.resetBtn.addEventListener('click', resetCurrentHead);

  // Layout/Rows changes
  elements.layoutSelect.addEventListener('change', updateHeadLayout);
  elements.rowsInput.addEventListener('change', updateHeadRows);

  // Row navigation
  elements.prevRowBtn.addEventListener('click', () => {
    if (currentHead && currentHead.currentRow > 1) {
      currentHead.currentRow--;
      updateUI();
    }
  });

  elements.nextRowBtn.addEventListener('click', () => {
    if (currentHead && currentHead.currentRow < currentHead.rows) {
      currentHead.currentRow++;
      updateUI();
    }
  });

  elements.rowJumpBtn.addEventListener('click', jumpToRow);
  elements.rowJumpInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') jumpToRow();
  });

  // Export buttons
  elements.exportJsonBtn.addEventListener('click', exportAsJson);
  elements.exportCsvBtn.addEventListener('click', exportAsCsv);
  elements.printBtn.addEventListener('click', printView);

  // Penetration control buttons
  elements.addPenetrationBtn.addEventListener("click", addPenetration);
  elements.movePenetrationBtn.addEventListener("click", startMovePenetration);
  elements.deletePenetrationBtn.addEventListener("click", deletePenetration);

  // Add click handler for reactor head SVG (will be implemented in updateReactorHeadSVG)
}

// Update head select dropdown
function updateHeadSelect() {
  elements.headSelect.innerHTML = '<option value="">-- Select Reactor Head --</option>';
  Object.keys(heads).forEach(id => {
    const head = heads[id];
    const option = document.createElement('option');
    option.value = head.id;
    option.textContent = head.name;
    elements.headSelect.appendChild(option);
  });
  
  if (currentHead) {
    elements.headSelect.value = currentHead.id;
  }
}

// Update head information display
function updateHeadInfo() {
  if (!currentHead) return;
  
  elements.headName.textContent = currentHead.name;
  elements.headPenetrations.textContent = currentHead.penetrations;
  elements.layoutSelect.value = currentHead.layout;
  elements.rowsInput.value = currentHead.rows;
  elements.currentRow.textContent = currentHead.currentRow;
  
  updateProgress();
  updateReactorHeadSVG();
  updatePenetrationGrid();
  updateQuadrantDetails();
}

// Update progress bar and percentage
function updateProgress() {
  if (!currentHead) return;
  
  const percent = currentHead.getCompletionPercentage();
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressDetail.textContent = 
    `${getCompletedQuadrants()} / ${currentHead.penetrations * 4} quadrants`;
  elements.progressFill.style.width = `${percent}%`;
}

// Get completed quadrants count
function getCompletedQuadrants() {
  if (!currentHead) return 0;
  
  let completed = 0;
  for (let penId = 1; penId <= currentHead.penetrations; penId++) {
    const statuses = currentHead.penetrationData[penId]?.quadrants || Array(4).fill(0);
    completed += statuses.filter(status => status === 2).length;
  }
  return completed;
}

// Update reactor head SVG visualization
function updateReactorHeadSVG() {
  if (!currentHead) return;
  
  // Clear previous SVG
  elements.reactorHead.innerHTML = '';
  
  // Create SVG container
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  
  // Create reactor head circle (simplified representation)
  const headCircle = document.createElementNS(svgNS, "circle");
  headCircle.setAttribute('cx', '100');
  headCircle.setAttribute('cy', '100');
  headCircle.setAttribute('r', '80');
  headCircle.setAttribute('fill', '#1f2937');
  headCircle.setAttribute('stroke', '#374151');
  headCircle.setAttribute('stroke-width', '2');
  svg.appendChild(headCircle);
  
  // Create penetrations based on layout
  createPenetrationPoints(svg, svgNS);
  
  elements.reactorHead.appendChild(svg);
}

// Create penetration points based on layout
function createPenetrationPoints(svg, svgNS) {
  const penetrations = currentHead.penetrations;
  const centerX = 100;
  const centerY = 100;
  let radius = 70; // Base radius
  
  // Adjust radius based on layout
  switch (currentHead.layout) {
    case 'circular':
      radius = 70;
      break;
    case 'octagonal':
      radius = 65;
      break;
    case 'square':
      radius = 60;
      break;
    case 'hexagonal':
      radius = 65;
      break;
    default:
      radius = 70;
  }
  
  // Calculate penetration positions
  for (let i = 1; i <= penetrations; i++) {
    const angle = (i - 1) * (2 * Math.PI) / penetrations;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    // Create penetration group
    const penGroup = document.createElementNS(svgNS, "g");
    penGroup.setAttribute('class', 'penetration-point');
    penGroup.setAttribute('data-penetration', i);
    
    // Create penetration circle
    const penCircle = document.createElementNS(svgNS, "circle");
    penCircle.setAttribute('cx', x);
    penCircle.setAttribute('cy', y);
    penCircle.setAttribute('r', '8');
    penCircle.setAttribute('fill', getPenetrationColor(i));
    penCircle.setAttribute('stroke', '#fff');
    penCircle.setAttribute('stroke-width', '1.5');
    penCircle.setAttribute('cursor', 'pointer');
    penCircle.setAttribute('title', `Penetration ${i}`);
    
    // Add click event to cycle through quadrants for this penetration
    penCircle.addEventListener('click', () => {
      showQuadrantSelection(i, penCircle);
    });
    
    penGroup.appendChild(penCircle);
    
    // Add penetration number label
    const penText = document.createElementNS(svgNS, "text");
    penText.setAttribute('x', x);
    penText.setAttribute('y', y + 3);
    penText.setAttribute('text-anchor', 'middle');
    penText.setAttribute('fill', '#fff');
    penText.setAttribute('font-size', '10');
    penText.setAttribute('font-weight', 'bold');
    penText.textContent = i;
    penGroup.appendChild(penText);
    
    svg.appendChild(penGroup);
  }
}

// Get color for penetration based on completion status
function getPenetrationColor(penetrationId) {
  if (!currentHead) return '#6b7280';
  
  const statuses = currentHead.penetrationData[penetrationId]?.quadrants || Array(4).fill(0);
  const inspectedCount = statuses.filter(s => s === 2).length;
  
  if (inspectedCount === 4) return '#22c55e'; // Fully inspected - green
  if (inspectedCount >= 2) return '#eab308'; // Partially inspected - yellow
  if (inspectedCount > 0) return '#f97316'; // Some progress - orange
  return '#6b7280'; // Not started - gray
}

// Show quadrant selection for a penetration
function showQuadrantSelection(penetrationId, circleElement) {
  currentPenetrationId = penetrationId;
  
  // Create quadrant selection popup with image upload capabilities
  const popup = document.createElement('div');
  popup.className = 'quadrant-popup';
  popup.innerHTML = `
    <div class="popup-header">
      <h4>Penetration ${penetrationId}</h4>
      <button class="popup-close">&times;</button>
    </div>
    <div class="popup-body">
      <div class="image-upload-section">
        <div class="image-preview-container">
          <div class="image-preview-placeholder">
            <p>No image uploaded</p>
            <div class="upload-instructions">Click to upload inspection image</div>
          </div>
          <img class="image-preview" src="" alt="Inspection preview" style="display: none; max-width: 100%; border-radius: 8px; margin: 10px 0;">
          <input type="file" id="imageUploadInput" accept="image/*" style="display: none;">
        </div>
        <div class="image-controls">
          <button id="uploadBtn" class="btn btn-sm">Upload Image</button>
          <button id="clearImageBtn" class="btn btn-sm" style="display: none;">Clear Image</button>
        </div>
      </div>
      
      <div class="quadrant-selection-section">
        <h4>Select Quadrant Status</h4>
        <div class="quadrant-options">
          <div class="quadrant-option" data-quadrant="1">
            <div class="quadrant-status"></div>
            <span>Q1 (Reference)</span>
          </div>
          <div class="quadrant-option" data-quadrant="2">
            <div class="quadrant-status"></div>
            <span>Q2</span>
          </div>
          <div class="quadrant-option" data-quadrant="3">
            <div class="quadrant-status"></div>
            <span>Q3</span>
          </div>
          <div class="quadrant-option" data-quadrant="4">
            <div class="quadrant-status"></div>
            <span>Q4</span>
          </div>
        </div>
      </div>
      
      <div class="navigation-buttons">
        <button id="backBtn" class="btn">Back</button>
        <button id="doneBtn" class="btn btn-primary">Done</button>
      </div>
    </div>
  `;
  
  // Set initial status colors
  const quadrantOptions = popup.querySelectorAll('.quadrant-option');
  quadrantOptions.forEach((option, index) => {
    const quadrantNum = index + 1;
    const status = currentHead.getQuadrantStatus(penetrationId, quadrantNum);
    const statusInfo = QuadrantStatus[status];
    option.querySelector('.quadrant-status').style.backgroundColor = statusInfo.color;
  });
  
  // Add click handlers for quadrant options
  popup.querySelectorAll('.quadrant-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const quadrantNum = parseInt(option.getAttribute('data-quadrant'));
      const currentStatus = currentHead.getQuadrantStatus(penetrationId, quadrantNum);
      const nextStatus = (currentStatus + 1) % 4; // Cycle through 0->1->2->3->0
      
      currentHead.setQuadrantStatus(penetrationId, quadrantNum, nextStatus);
      
      // Update UI
      option.querySelector('.quadrant-status').style.backgroundColor = QuadrantStatus[nextStatus].color;
      updatePenetrationPointColor(penetrationId);
      updateProgress();
      updateQuadrantDetails();
    });
  });
  
  // Close button
  popup.querySelector('.popup-close').addEventListener('click', () => {
    popup.remove();
    currentPenetrationId = null;
  });
  
  // Close when clicking outside
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.remove();
      currentPenetrationId = null;
    }
  });
  
  // Image upload functionality
  const uploadInput = popup.querySelector('#imageUploadInput');
  const uploadBtn = popup.querySelector('#uploadBtn');
  const clearImageBtn = popup.querySelector('#clearImageBtn');
  const imagePreviewContainer = popup.querySelector('.image-preview-placeholder');
  const imagePreview = popup.querySelector('.image-preview');
  
  uploadBtn.addEventListener('click', () => {
    uploadInput.click();
  });
  
  uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target.result;
        
        // Store image data
        if (!quadrantImages[currentPenetrationId]) {
          quadrantImages[currentPenetrationId] = {};
        }
        quadrantImages[currentPenetrationId][parseInt(option.getAttribute('data-quadrant'))] = imageUrl;
        
        // Show preview
        imagePreview.src = imageUrl;
        imagePreview.style.display = 'block';
        imagePreviewContainer.style.display = 'none';
        clearImageBtn.style.display = 'block';
        
        uploadInput.value = ''; // Reset input
      };
      reader.readAsDataURL(file);
    }
  });
  
  clearImageBtn.addEventListener('click', () => {
    // Remove stored image
    if (quadrantImages[currentPenetrationId]) {
      delete quadrantImages[currentPenetrationId][parseInt(option.getAttribute('data-quadrant'))];
    }
    
    // Hide preview
    imagePreview.style.display = 'none';
    imagePreviewContainer.style.display = 'block';
    clearImageBtn.style.display = 'none';
    
    imagePreview.src = '';
  });
  
  // Back button
  popup.querySelector('#backBtn').addEventListener('click', () => {
    popup.remove();
    currentPenetrationId = null;
  });
  
  // Done button
  popup.querySelector('#doneBtn').addEventListener('click', () => {
    popup.remove();
    currentPenetrationId = null;
    updateStatus('Quadrant updated');
  });
  
  // Position popup near the circle
  const rect = circleElement.getBoundingClientRect();
  popup.style.left = `${rect.left + window.scrollX}px`;
  popup.style.top = `${rect.top + window.scrollY - 200}px`;
  
  document.body.appendChild(popup);
}

// Update penetration point color in SVG
function updatePenetrationPointColor(penetrationId) {
  const circle = elements.reactorHead.querySelector(`[data-penetration="${penetrationId}"] circle`);
  if (circle) {
    circle.setAttribute('fill', getPenetrationColor(penetrationId));
  }
}

// Update penetration grid (list view)
function updatePenetrationGrid() {
  if (!currentHead) return;
  
  elements.penetrationGrid.innerHTML = '';
  
  // Show only current row penetrations for clarity
  const rowPenetrations = currentHead.getCurrentRowQuadrants();
  
  rowPenetrations.forEach(penId => {
    const penCell = document.createElement('div');
    penCell.className = 'pen-cell';
    penCell.innerHTML = `
      <div class="pen-num">${penId}</div>
      <div class="pen-row">Row ${currentHead.currentRow}</div>
      <div class="pen-quadrants">
        ${Array(4).fill(0).map((_, i) => {
          const status = currentHead.getQuadrantStatus(penId, i + 1);
          const statusInfo = QuadrantStatus[status];
          return `<span class="quadrant-dot" style="background-color: ${statusInfo.color}"></span>`;
        }).join('')}
      </div>
    `;
    
    // Add click to open quadrant selection
    penCell.addEventListener('click', () => {
      // Find the corresponding SVG element and trigger its click
      const svgCircle = elements.reactorHead.querySelector(`[data-penetration="${penId}"] circle`);
      if (svgCircle) {
        svgCircle.click();
      }
    });
    
    elements.penetrationGrid.appendChild(penCell);
  });
}

// Update quadrant details panel
function updateQuadrantDetails() {
  if (!currentHead) return;
  
  const rowPenetrations = currentHead.getCurrentRowQuadrants();
  const quadrantStats = {1: 0, 2: 0, 3: 0, 4: 0};
  
  rowPenetrations.forEach(penId => {
    for (let q = 1; q <= 4; q++) {
      const status = currentHead.getQuadrantStatus(penId, q);
      if (status === 2) quadrantStats[q]++; // Count inspected quadrants
    }
  });
  
  elements.quadrantDetails.innerHTML = '';
  
  for (let q = 1; q <= 4; q++) {
    const inspected = quadrantStats[q];
    const total = rowPenetrations.length;
    const percent = total === 0 ? 0 : Math.round((inspected / total) * 100);
    
    const qBox = document.createElement('div');
    qBox.className = 'q-box';
    qBox.innerHTML = `
      <div class="q-label">Quadrant ${q}</div>
      <div class="q-status">${inspected}/${total} (${percent}%)</div>
    `;
    
    // Color based on completion
    if (percent === 100) {
      qBox.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
      qBox.style.borderColor = '#22c55e';
    } else if (percent >= 50) {
      qBox.style.backgroundColor = 'rgba(234, 179, 8, 0.2)';
      qBox.style.borderColor = '#eab308';
    } else if (percent > 0) {
      qBox.style.backgroundColor = 'rgba(249, 115, 22, 0.2)';
      qBox.style.borderColor = '#f97316';
    } else {
      qBox.style.backgroundColor = 'rgba(107, 114, 128, 0.2)';
      qBox.style.borderColor = '#6b7280';
    }
    
    elements.quadrantDetails.appendChild(qBox);
  }
}

// Update entire UI
function updateUI() {
  if (!currentHead) return;
  
  updateHeadInfo();
  updateProgress();
  updateReactorHeadSVG();
  updatePenetrationGrid();
  updateQuadrantDetails();
  updateStatus('Ready');
}

// Update status message
function updateStatus(message) {
  elements.statusMsg.textContent = message;
  elements.lastSaved.textContent = new Date().toLocaleTimeString();
}

// Event handlers
function createNewHead() {
  const name = prompt('Enter reactor head name:');
  if (!name || name.trim() === '') return;
  
  const penetrations = parseInt(prompt('Enter number of penetrations:', '76'));
  if (isNaN(penetrations) || penetrations <= 0) return;
  
  const layout = prompt('Enter layout (octagonal, circular, square, hexagonal):', 'octagonal') || 'octagonal';
  const rows = parseInt(prompt('Enter number of rows:', '8'));
  if (isNaN(rows) || rows <= 0) return;
  
  const id = `rh-${Date.now()}`;
  const newHead = new ReactorHead(id, name.trim(), penetrations, layout, rows);
  heads[id] = newHead;
  currentHead = newHead;
  
  updateHeadSelect();
  updateHeadInfo();
  updateStatus(`Created new head: ${name}`);
}

function updateHeadLayout() {
  if (!currentHead) return;
  currentHead.layout = elements.layoutSelect.value;
  updateReactorHeadSVG();
  updateStatus(`Updated layout to ${currentHead.layout}`);
}

function updateHeadRows() {
  if (!currentHead) return;
  const rows = parseInt(elements.rowsInput.value);
  if (!isNaN(rows) && rows > 0) {
    currentHead.rows = rows;
    // Ensure current row is within bounds
    if (currentHead.currentRow > currentHead.rows) {
      currentHead.currentRow = currentHead.rows;
    }
    updateUI();
    updateStatus(`Updated rows to ${currentHead.rows}`);
  }
}

function resetCurrentHead() {
  if (!currentHead || !confirm(`Reset all inspection data for ${currentHead.name}?`)) return;
  
  currentHead.initializePenetrations();
  updateUI();
  updateStatus(`Reset inspection data for ${currentHead.name}`);
}

function saveData() {
  const data = {
    heads: Object.keys(heads).map(id => {
      const head = heads[id];
      return {
        id: head.id,
        name: head.name,
        penetrations: head.penetrations,
        layout: head.layout,
        rows: head.rows,
        currentRow: head.currentRow,
        penetrationData: head.penetrationData
      };
    })
  };
  
  localStorage.setItem('reactorHeadInspectorData', JSON.stringify(data));
  updateStatus('Data saved to local storage');
}

function loadData() {
  const data = localStorage.getItem('reactorHeadInspectorData');
  if (!data) {
    updateStatus('No saved data found');
    return;
  }
  
  try {
    const parsed = JSON.parse(data);
    // Clear existing heads
    Object.keys(heads).forEach(id => delete heads[id]);
    
    // Load heads from data
    parsed.heads.forEach(headData => {
      const head = new ReactorHead(
        headData.id,
        headData.name,
        headData.penetrations,
        headData.layout,
        headData.rows
      );
      head.currentRow = headData.currentRow || 1;
      head.penetrationData = headData.penetrationData || {};
      heads[head.id] = head;
    });
    
    // Set current head to first loaded head
    currentHead = Object.values(heads)[0] || null;
    if (currentHead) {
      updateHeadSelect();
      updateHeadInfo();
      updateStatus('Data loaded from local storage');
    }
  } catch (error) {
    updateStatus('Error loading data');
    console.error(error);
  }
}

function jumpToRow() {
  if (!currentHead) return;
  
  const row = parseInt(elements.rowJumpInput.value);
  if (!isNaN(row) && row >= 1 && row <= currentHead.rows) {
    currentHead.currentRow = row;
    updateUI();
    updateStatus(`Jumped to row ${row}`);
  } else {
    updateStatus(`Invalid row number. Please enter 1-${currentHead.rows}`);
  }
}

function exportAsJson() {
  if (!currentHead) return;
  
  const data = {
    head: {
      id: currentHead.id,
      name: currentHead.name,
      penetrations: currentHead.penetrations,
      layout: currentHead.layout,
      rows: currentHead.rows,
      currentRow: currentHead.currentRow
    },
    penetrationData: currentHead.penetrationData,
    completionPercentage: currentHead.getCompletionPercentage(),
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reactor-head-${currentHead.id}-inspection.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  updateStatus('Exported as JSON');
}

function exportAsCsv() {
  if (!currentHead) return;
  
  let csv = 'Penetration ID,Quadrant 1,Quadrant 2,Quadrant 3,Quadrant 4,Status\n';
  const quadrantLabels = ['Pending', 'In Progress', 'Inspected', 'Needs Attention'];
  
  for (let penId = 1; penId <= currentHead.penetrations; penId++) {
    const statuses = currentHead.penetrationData[penId]?.quadrants || Array(4).fill(0);
    const statusText = statuses.map(s => quadrantLabels[s]).join(',');
    csv += `${penId},${statuses.join(',')},${statusText}\n`;
  }
  
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reactor-head-${currentHead.id}-inspection.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  updateStatus('Exported as CSV');
}

function printView() {
  window.print();
  updateStatus('Print view opened');
}
// Penetration control functions
function addPenetration() {
  if (!currentHead) return;
  
  const newId = currentHead.penetrations + 1;
  currentHead.penetrations++;
  currentHead.penetrationData[newId] = {
    quadrants: Array(4).fill(0)
  };
  
  updateHeadInfo();
  updateUI();
  updateStatus(`Added penetration ${newId}`);
}

function startMovePenetration() {
  if (!currentHead) return;
  
  const promptText = `Enter penetration ID to move (1-${currentHead.penetrations}):\n\nCurrent order: ${Array.from({length: currentHead.penetrations}, (_, i) => i + 1).join(', ')}`;
  const penIdStr = prompt(promptText);
  if (!penIdStr) return;
  
  const penId = parseInt(penIdStr);
  if (isNaN(penId) || penId < 1 || penId > currentHead.penetrations) {
    updateStatus('Invalid penetration ID');
    return;
  }
  
  const movePromptText = `Enter new position for penetration ${penId} (1-${currentHead.penetrations}):`;
  const newPosStr = prompt(movePromptText);
  if (!newPosStr) return;
  
  const newPos = parseInt(newPosStr);
  if (isNaN(newPos) || newPos < 1 || newPos > currentHead.penetrations) {
    updateStatus('Invalid position');
    return;
  }
  
  movePenetration(penId, newPos);
}

function movePenetration(fromId, toId) {
  if (fromId === toId) return;
  
  // Swap penetration data
  const fromData = currentHead.penetrationData[fromId];
  const toData = currentHead.penetrationData[toId];
  
  currentHead.penetrationData[fromId] = toData;
  currentHead.penetrationData[toId] = fromData;
  
  updateUI();
  updateStatus(`Moved penetration ${fromId} to position ${toId}`);
}

function deletePenetration() {
  if (!currentHead) return;
  
  const promptText = `Enter penetration ID to delete (1-${currentHead.penetrations}):\n\nCurrent order: ${Array.from({length: currentHead.penetrations}, (_, i) => i + 1).join(', ')}`;
  const penIdStr = prompt(promptText);
  if (!penIdStr) return;
  
  const penId = parseInt(penIdStr);
  if (isNaN(penId) || penId < 1 || penId > currentHead.penetrations) {
    updateStatus('Invalid penetration ID');
    return;
  }
  
  if (!confirm(`Delete penetration ${penId}? This cannot be undone.`)) return;
  
  // Remove the penetration
  delete currentHead.penetrationData[penId];
  currentHead.penetrations--;
  
  // Renumber remaining penetrations
  const remainingIds = Object.keys(currentHead.penetrationData)
    .map(Number)
    .sort((a, b) => a - b);
  
  const newPenetrationData = {};
  remainingIds.forEach((oldId, index) => {
    newPenetrationData[index + 1] = currentHead.penetrationData[oldId];
  });
  
  currentHead.penetrationData = newPenetrationData;
  
  updateHeadInfo();
  updateUI();
  updateStatus(`Deleted penetration ${penId}`);
}
