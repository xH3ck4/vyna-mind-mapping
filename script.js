class MindMap {
    constructor() {
        this.nodes = [];
        this.connections = [];
        this.selectedNode = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.connecting = false;
        this.connectionStart = null;
        this.currentEditingNode = null;
        this.connectMode = false;
        this.connectSourceNode = null;
        this.hasDragged = false;
        this.zoomLevel = 1;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.spacePressed = false;
        this.lastScrollLeft = 0;
        this.lastScrollTop = 0;
        this.isConnecting = false;
        this.connectingStartNode = null;
        this.tempConnectionLine = null;
        this.justClosedModal = false;
        this.copiedNode = null;
        this.selectedConnection = null;
        this.lastTapTime = 0;
        this.lastTapNode = null;
        this.lastPinchDistance = 0;
        this.isPinching = false;
        this.longPressTimer = null;
        this.longPressNode = null;
        this.touchStartPos = { x: 0, y: 0 };
        this.mobileContextMenu = null;
        this.hasMoved = false;
        
        this.init();
    }
    
    init() {
        this.svg = document.getElementById('svgCanvas');
        this.canvasGroup = document.getElementById('canvasGroup');
        this.nodesGroup = document.getElementById('nodes');
        this.connectionsGroup = document.getElementById('connections');
        this.container = document.getElementById('canvasContainer');
        this.canvasScroll = document.getElementById('canvasScroll');
        this.infoPanel = document.getElementById('infoPanel');
        this.toggleInfoBtn = document.getElementById('toggleInfoBtn');
        
        // Hide info panel by default on all devices
        this.infoPanel.classList.add('hidden');
        
        // Check if mobile
        this.isMobile = this.checkIfMobile();
        
        // Center scroll on load
        this.centerCanvas();
        
        // Event listeners
        document.getElementById('addNodeBtn').addEventListener('click', () => this.addNode());
        document.getElementById('connectBtn').addEventListener('click', () => this.toggleConnectMode());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadAsPNG());
        document.getElementById('saveNodeBtn').addEventListener('click', () => this.saveNodeText());
        document.getElementById('cancelNodeBtn').addEventListener('click', () => this.closeEditModal());
        document.querySelector('.close').addEventListener('click', () => this.closeEditModal());
        this.toggleInfoBtn.addEventListener('click', () => this.toggleInfoPanel());
        
        // FAB for mobile
        const fabBtn = document.getElementById('fabAddNode');
        if (fabBtn) {
            fabBtn.addEventListener('click', () => {
                this.addNode();
                // Haptic feedback
                if (navigator.vibrate) {
                    navigator.vibrate(30);
                }
            });
        }
        
        // Copy paste handlers
        document.addEventListener('copy', (e) => this.handleCopy(e));
        document.addEventListener('paste', (e) => this.handlePaste(e));
        document.addEventListener('cut', (e) => this.handleCut(e));
        
        // Zoom controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetZoomBtn').addEventListener('click', () => this.resetZoom());
        document.getElementById('fitToScreenBtn').addEventListener('click', () => this.fitToScreen());
        
        // Zoom with mouse wheel
        this.container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Keyboard events for pan
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.closest('input') && !e.target.closest('textarea')) {
                e.preventDefault();
                this.spacePressed = true;
                this.updateCursor();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                this.isPanning = false;
                this.updateCursor();
            }
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('editModal');
            if (e.key === 'Delete' && this.selectedNode && modal.style.display !== 'block') {
                this.deleteNode(this.selectedNode);
            }
            if (e.key === 'Escape') {
                this.closeEditModal();
                if (modal.style.display !== 'block') {
                    this.selectedNode = null;
                    this.updateDisplay();
                }
            }
            // Zoom with keyboard
            if ((e.ctrlKey || e.metaKey) && e.key === '=') {
                e.preventDefault();
                this.zoomIn();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                this.zoomOut();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                this.resetZoom();
            }
            // Copy paste
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && this.selectedNode && !e.target.closest('input')) {
                e.preventDefault();
                this.copyNode();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.target.closest('input')) {
                e.preventDefault();
                this.pasteNode();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'x' && this.selectedNode && !e.target.closest('input')) {
                e.preventDefault();
                this.cutNode();
            }
            // Delete connection
            if (e.key === 'Delete' && this.selectedConnection) {
                e.preventDefault();
                this.deleteConnection(this.selectedConnection);
                this.selectedConnection = null;
                this.updateDisplay();
            }
        });
        
        // Enter key to save in modal
        document.getElementById('nodeTextInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveNodeText();
            }
        });
        
        // Canvas click events
        let clickStartTime = 0;
        let mouseDownHandler = (e) => {
            clickStartTime = Date.now();
            this.hasDragged = false;
            
            // Handle panning with space or middle mouse
            if (this.spacePressed || e.button === 1) {
                e.preventDefault();
                e.stopPropagation();
                this.isPanning = true;
                this.panStart = { 
                    x: e.clientX + this.container.scrollLeft, 
                    y: e.clientY + this.container.scrollTop 
                };
                this.updateCursor();
                return;
            }
            
            this.handleMouseDown(e);
        };
        
        let mouseMoveHandler = (e) => {
            // Handle panning
            if (this.isPanning && (this.spacePressed || e.buttons === 4)) {
                e.preventDefault();
                e.stopPropagation();
                const scrollLeft = this.panStart.x - e.clientX;
                const scrollTop = this.panStart.y - e.clientY;
                this.container.scrollLeft = scrollLeft;
                this.container.scrollTop = scrollTop;
                this.lastScrollLeft = scrollLeft;
                this.lastScrollTop = scrollTop;
                return;
            }
            
            if (this.isDragging) {
                this.hasDragged = true;
            }
            this.handleMouseMove(e);
        };
        
        let mouseUpHandler = (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.updateCursor();
                return;
            }
            
            this.handleMouseUp(e);
            // Only trigger click if we didn't drag much
            if (!this.hasDragged && Date.now() - clickStartTime < 300) {
                setTimeout(() => this.handleCanvasClick(e), 10);
            }
            // Reset after a short delay to allow click handler to check
            setTimeout(() => { this.hasDragged = false; }, 50);
        };
        
        this.container.addEventListener('mousedown', mouseDownHandler);
        this.container.addEventListener('mousemove', mouseMoveHandler);
        this.container.addEventListener('mouseup', mouseUpHandler);
        this.container.addEventListener('mouseleave', () => {
            this.isPanning = false;
            this.isDragging = false;
            this.updateCursor();
        });
        
        // Touch event handlers for mobile
        let touchStartHandler = (e) => {
            // Convert touch to mouse-like event
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.touchStartPos = { x: touch.clientX, y: touch.clientY };
                this.hasMoved = false;
                
                // Close mobile context menu if open
                this.closeMobileContextMenu();
                
                // Check if touching a node for long-press
                const node = this.getNodeAt(touch.clientX, touch.clientY);
                if (node && this.isMobile) {
                    this.longPressNode = node;
                    this.longPressTimer = setTimeout(() => {
                        // Only show context menu if user hasn't moved
                        if (!this.hasMoved && !this.isDragging) {
                            this.showMobileContextMenu(node, touch.clientX, touch.clientY);
                            // Haptic feedback if available
                            if (navigator.vibrate) {
                                navigator.vibrate(50);
                            }
                            // Cancel drag if context menu is shown
                            this.isDragging = false;
                            this.container.classList.remove('node-dragging');
                        }
                    }, 2000); // 2000ms (2 detik) long-press - prioritaskan drag
                }
                
                const mouseEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0,
                    target: e.target,
                    closest: (selector) => e.target.closest ? e.target.closest(selector) : null,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                };
                mouseDownHandler(mouseEvent);
            }
        };
        
        let touchMoveHandler = (e) => {
            // Cancel long-press if moved - prioritaskan drag
            if (this.longPressTimer && e.touches.length === 1) {
                const touch = e.touches[0];
                const moveDistance = Math.sqrt(
                    Math.pow(touch.clientX - this.touchStartPos.x, 2) +
                    Math.pow(touch.clientY - this.touchStartPos.y, 2)
                );
                // Threshold rendah agar drag lebih mudah
                if (moveDistance > 3) { // 3px threshold - menandai sudah bergerak
                    this.hasMoved = true;
                }
                if (moveDistance > 8) { // 8px threshold - cancel long-press, prioritaskan drag
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                    this.longPressNode = null;
                }
            }
            
            // Cancel long-press jika sudah mulai drag
            if (this.isDragging && this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
                this.longPressNode = null;
            }
            
            // Handle pinch to zoom with two fingers
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                const distance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                if (this.isPinching && this.lastPinchDistance > 0) {
                    const delta = distance / this.lastPinchDistance;
                    this.setZoom(this.zoomLevel * delta);
                }
                
                this.isPinching = true;
                this.lastPinchDistance = distance;
                return;
            }
            
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const mouseEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    buttons: 1,
                    target: e.target,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                };
                mouseMoveHandler(mouseEvent);
                if (this.isDragging || this.isConnecting) {
                    e.preventDefault(); // Prevent scrolling while dragging
                }
            }
        };
        
        let touchEndHandler = (e) => {
            // Clear long-press timer
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
                this.longPressNode = null;
            }
            
            // Reset pinch state
            if (e.touches.length < 2) {
                this.isPinching = false;
                this.lastPinchDistance = 0;
            }
            
            // If pinching just ended, don't process other events
            if (this.isPinching) {
                return;
            }
            
            const touch = e.changedTouches[0];
            
            // Handle double tap for editing nodes on mobile (only if not dragged)
            if (!this.hasDragged && !this.hasMoved) {
                const node = this.getNodeAt(touch.clientX, touch.clientY);
                const currentTime = Date.now();
                const tapDelay = currentTime - this.lastTapTime;
                
                if (node && this.lastTapNode === node && tapDelay < 400) {
                    // Double tap detected - open edit modal
                    this.selectedNode = node;
                    this.openEditModal(node);
                    this.lastTapTime = 0;
                    this.lastTapNode = null;
                    // Reset flags
                    this.hasMoved = false;
                    return;
                }
                
                this.lastTapTime = currentTime;
                this.lastTapNode = node;
            }
            
            // Reset moved flag
            this.hasMoved = false;
            
            const mouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0,
                target: e.target,
                detail: e.detail || 1,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation()
            };
            mouseUpHandler(mouseEvent);
        };
        
        this.container.addEventListener('touchstart', touchStartHandler, { passive: false });
        this.container.addEventListener('touchmove', touchMoveHandler, { passive: false });
        this.container.addEventListener('touchend', touchEndHandler, { passive: false });
        this.container.addEventListener('touchcancel', touchEndHandler, { passive: false });
        
        // Prevent context menu and middle mouse button default behavior
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Track scroll position
        this.container.addEventListener('scroll', () => {
            this.lastScrollLeft = this.container.scrollLeft;
            this.lastScrollTop = this.container.scrollTop;
        });
    }
    
    checkIfMobile() {
        return window.innerWidth <= 768 || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0);
    }
    
    toggleInfoPanel() {
        this.infoPanel.classList.toggle('hidden');
        this.toggleInfoBtn.classList.toggle('active');
    }
    
    centerCanvas() {
        // Center the canvas view
        setTimeout(() => {
            this.container.scrollLeft = 2000;
            this.container.scrollTop = 2000;
            this.lastScrollLeft = 2000;
            this.lastScrollTop = 2000;
        }, 100);
    }
    
    updateCursor() {
        if (this.isPanning || this.spacePressed) {
            this.container.classList.add('panning');
        } else {
            this.container.classList.remove('panning');
        }
    }
    
    handleWheel(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.setZoom(this.zoomLevel * delta);
        }
    }
    
    zoomIn() {
        this.setZoom(this.zoomLevel * 1.2);
    }
    
    zoomOut() {
        this.setZoom(this.zoomLevel / 1.2);
    }
    
    resetZoom() {
        this.setZoom(1);
        this.centerCanvas();
    }
    
    fitToScreen() {
        if (this.nodes.length === 0) {
            this.resetZoom();
            return;
        }
        
        // Calculate bounding box of all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.nodes.forEach(node => {
            minX = Math.min(minX, node.x - node.width / 2);
            minY = Math.min(minY, node.y - node.height / 2);
            maxX = Math.max(maxX, node.x + node.width / 2);
            maxY = Math.max(maxY, node.y + node.height / 2);
        });
        
        const padding = 100;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const containerRect = this.container.getBoundingClientRect();
        
        const scaleX = containerRect.width / width;
        const scaleY = containerRect.height / height;
        const scale = Math.min(scaleX, scaleY, 3); // Max 3x zoom
        
        this.setZoom(scale);
        
        // Center on nodes
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Calculate scroll position to center on nodes
        // Need to account for zoom level
        const scrollX = 2500 + (centerX * this.zoomLevel) - (containerRect.width / 2);
        const scrollY = 2500 + (centerY * this.zoomLevel) - (containerRect.height / 2);
        
        setTimeout(() => {
            this.container.scrollLeft = scrollX;
            this.container.scrollTop = scrollY;
            this.lastScrollLeft = scrollX;
            this.lastScrollTop = scrollY;
        }, 50);
    }
    
    setZoom(level) {
        this.zoomLevel = Math.max(0.1, Math.min(5, level));
        this.canvasGroup.setAttribute('transform', `translate(2500, 2500) scale(${this.zoomLevel})`);
        document.getElementById('zoomLevel').textContent = Math.round(this.zoomLevel * 100) + '%';
        this.updateDisplay();
    }
    
    addNode(x = null, y = null) {
        // Get viewport center in SVG coordinates
        const containerRect = this.container.getBoundingClientRect();
        const scrollX = this.container.scrollLeft;
        const scrollY = this.container.scrollTop;
        
        let svgX, svgY;
        
        if (x !== null && y !== null) {
            // Convert screen coordinates to SVG coordinates
            const screenX = x - containerRect.left;
            const screenY = y - containerRect.top;
            svgX = (screenX + scrollX - 2500) / this.zoomLevel;
            svgY = (screenY + scrollY - 2500) / this.zoomLevel;
        } else {
            // Center of viewport in SVG coordinates
            svgX = (containerRect.width / 2 + scrollX - 2500) / this.zoomLevel;
            svgY = (containerRect.height / 2 + scrollY - 2500) / this.zoomLevel;
        }
        
        const node = {
            id: Date.now(),
            x: svgX,
            y: svgY,
            text: 'Node Baru',
            width: this.isMobile ? 140 : 120,
            height: this.isMobile ? 70 : 60
        };
        
        this.nodes.push(node);
        this.selectedNode = node;
        this.updateDisplay();
        
        // Delay modal opening on mobile to avoid conflicts
        if (this.isMobile) {
            setTimeout(() => this.openEditModal(node), 100);
        } else {
            this.openEditModal(node);
        }
    }
    
    createNodeElement(node) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('node');
        group.setAttribute('data-id', node.id);
        
        if (this.selectedNode && this.selectedNode.id === node.id) {
            group.classList.add('selected');
        }
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.classList.add('node-rect');
        rect.setAttribute('x', node.x - node.width / 2);
        rect.setAttribute('y', node.y - node.height / 2);
        rect.setAttribute('width', node.width);
        rect.setAttribute('height', node.height);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.classList.add('node-text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.textContent = node.text;
        
        // Adjust width based on text length with mobile consideration
        const textLength = node.text.length;
        const minWidth = this.isMobile ? 140 : 120;
        const charWidth = this.isMobile ? 9 : 8;
        node.width = Math.max(minWidth, textLength * charWidth + 40);
        rect.setAttribute('width', node.width);
        rect.setAttribute('x', node.x - node.width / 2);
        
        // Pointer events - rect menerima semua events untuk hover dan click
        rect.setAttribute('pointer-events', 'all');
        text.setAttribute('pointer-events', 'none');
        
        // Group tidak menghalangi events, biarkan rect yang menangani
        // Tidak perlu set pointer-events pada group karena rect sudah menanganinya
        
        group.appendChild(rect);
        group.appendChild(text);
        
        return group;
    }
    
    updateDisplay() {
        // Clear existing nodes (but keep temp connection line if exists)
        this.nodesGroup.innerHTML = '';
        
        // Clear connections but preserve temp line
        const tempLine = this.tempConnectionLine;
        this.connectionsGroup.innerHTML = '';
        if (tempLine) {
            this.connectionsGroup.appendChild(tempLine);
            this.tempConnectionLine = tempLine;
        }
        
        // Draw connections
        this.connections.forEach((conn, index) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.classList.add('connection');
            line.setAttribute('data-conn-id', index);
            
            // Update connection coordinates
            const fromNode = this.nodes.find(n => n.id === conn.fromId);
            const toNode = this.nodes.find(n => n.id === conn.toId);
            
            if (fromNode && toNode) {
                conn.from = { x: fromNode.x, y: fromNode.y };
                conn.to = { x: toNode.x, y: toNode.y };
            }
            
            line.setAttribute('x1', conn.from.x);
            line.setAttribute('y1', conn.from.y);
            line.setAttribute('x2', conn.to.x);
            line.setAttribute('y2', conn.to.y);
            line.setAttribute('fill', 'none');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            
            // Highlight selected connection
            if (this.selectedConnection === conn) {
                line.setAttribute('stroke', '#db2777');
                line.setAttribute('stroke-width', '4');
            } else {
                line.setAttribute('stroke', '#666');
                line.setAttribute('stroke-width', '2');
            }
            
            line.style.cursor = 'pointer';
            
            this.connectionsGroup.appendChild(line);
        });
        
        // Draw nodes
        this.nodes.forEach(node => {
            const nodeElement = this.createNodeElement(node);
            this.nodesGroup.appendChild(nodeElement);
        });
    }
    
    getNodeAt(screenX, screenY) {
        // Convert screen coordinates to SVG coordinates
        const containerRect = this.container.getBoundingClientRect();
        const scrollX = this.container.scrollLeft;
        const scrollY = this.container.scrollTop;
        
        const svgX = (screenX - containerRect.left + scrollX - 2500) / this.zoomLevel;
        const svgY = (screenY - containerRect.top + scrollY - 2500) / this.zoomLevel;
        
        for (let node of this.nodes) {
            const halfWidth = node.width / 2;
            const halfHeight = node.height / 2;
            if (svgX >= node.x - halfWidth && svgX <= node.x + halfWidth &&
                svgY >= node.y - halfHeight && svgY <= node.y + halfHeight) {
                return node;
            }
        }
        return null;
    }
    
    getConnectionAt(screenX, screenY) {
        // Convert screen coordinates to SVG coordinates
        const containerRect = this.container.getBoundingClientRect();
        const scrollX = this.container.scrollLeft;
        const scrollY = this.container.scrollTop;
        
        const svgX = (screenX - containerRect.left + scrollX - 2500) / this.zoomLevel;
        const svgY = (screenY - containerRect.top + scrollY - 2500) / this.zoomLevel;
        
        // Increase touch target on mobile
        const hitRadius = this.isMobile ? 20 : 10;
        
        // Check each connection to see if click is near the line
        for (let conn of this.connections) {
            const fromNode = this.nodes.find(n => n.id === conn.fromId);
            const toNode = this.nodes.find(n => n.id === conn.toId);
            
            if (!fromNode || !toNode) continue;
            
            const x1 = fromNode.x;
            const y1 = fromNode.y;
            const x2 = toNode.x;
            const y2 = toNode.y;
            
            // Calculate distance from point to line segment
            const A = svgX - x1;
            const B = svgY - y1;
            const C = x2 - x1;
            const D = y2 - y1;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            
            if (lenSq !== 0) param = dot / lenSq;
            
            let xx, yy;
            
            if (param < 0) {
                xx = x1;
                yy = y1;
            } else if (param > 1) {
                xx = x2;
                yy = y2;
            } else {
                xx = x1 + param * C;
                yy = y1 + param * D;
            }
            
            const dx = svgX - xx;
            const dy = svgY - yy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if click is within hit radius of the line
            if (distance < hitRadius / this.zoomLevel) {
                return conn;
            }
        }
        return null;
    }
    
    deleteConnection(connection) {
        this.connections = this.connections.filter(conn => conn !== connection);
        if (this.selectedConnection === connection) {
            this.selectedConnection = null;
        }
        this.updateDisplay();
    }
    
    handleCanvasClick(e) {
        // Don't handle clicks if panning or if clicking on zoom controls
        if (this.isPanning || e.target.closest('.zoom-controls')) {
            return;
        }
        
        // Prevent click after modal just closed
        if (this.justClosedModal) {
            this.justClosedModal = false;
            return;
        }
        
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        // Check if clicking on a connection first
        const connection = this.getConnectionAt(x, y);
        if (connection) {
            if (e.button === 2 || (e.ctrlKey && e.button === 0)) {
                // Right click or Ctrl+Click to delete connection
                this.deleteConnection(connection);
                this.updateDisplay();
                return;
            }
            this.selectedConnection = connection;
            this.selectedNode = null;
            this.updateDisplay();
            return;
        }
        this.selectedConnection = null;
        
        // Check if clicking on a node by checking SVG coordinates
        const node = this.getNodeAt(x, y);
        
        if (node) {
            if (e.detail === 2) {
                // Double click to edit
                this.selectedNode = node;
                this.openEditModal(node);
            } else if (this.isConnecting && this.connectingStartNode && this.connectingStartNode.id !== node.id) {
                // Finish connecting
                this.connectNodes(this.connectingStartNode, node);
                this.isConnecting = false;
                this.connectingStartNode = null;
                if (this.tempConnectionLine) {
                    this.tempConnectionLine.remove();
                    this.tempConnectionLine = null;
                }
                this.selectedNode = node;
                this.updateDisplay();
            } else if (this.connectMode) {
                // Connect mode - connect nodes
                if (this.connectSourceNode && this.connectSourceNode.id !== node.id) {
                    this.connectNodes(this.connectSourceNode, node);
                    this.connectSourceNode = null;
                    this.connectMode = false;
                    const btn = document.getElementById('connectBtn');
                    btn.classList.remove('active');
                    const btnIcon = btn.querySelector('.btn-icon');
                    const btnText = btn.querySelector('.btn-text');
                    if (btnIcon) btnIcon.textContent = '🔗';
                    if (btnText) btnText.textContent = 'Hubungkan';
                    this.selectedNode = node;
                } else {
                    this.connectSourceNode = node;
                    this.selectedNode = node;
                }
                this.updateDisplay();
            } else {
                // Single click - just select the node
                this.selectedNode = node;
                this.updateDisplay();
            }
        } else {
            // Click on canvas - deselect
            if (this.isConnecting) {
                this.isConnecting = false;
                this.connectingStartNode = null;
                if (this.tempConnectionLine) {
                    this.tempConnectionLine.remove();
                    this.tempConnectionLine = null;
                }
            }
            if (this.connectMode) {
                // Cancel connect mode if clicking on empty canvas
                this.connectMode = false;
                this.connectSourceNode = null;
                const btn = document.getElementById('connectBtn');
                btn.classList.remove('active');
                const btnIcon = btn.querySelector('.btn-icon');
                const btnText = btn.querySelector('.btn-text');
                if (btnIcon) btnIcon.textContent = '🔗';
                if (btnText) btnText.textContent = 'Hubungkan';
            }
            this.selectedNode = null;
            this.selectedConnection = null;
            this.updateDisplay();
        }
    }
    
    handleMouseDown(e) {
        // Don't start dragging if clicking on text input or modal
        if (e.target.tagName === 'INPUT' || e.target.closest('.modal')) {
            return;
        }
        
        // Don't drag nodes when panning
        if (this.spacePressed || e.button === 1) {
            return;
        }
        
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        const node = this.getNodeAt(x, y);
        if (node) {
            if (this.connectMode) {
                // Start connecting mode - drag from node
                this.isConnecting = true;
                this.connectingStartNode = node;
                this.selectedNode = node;
                this.updateDisplay();
                e.preventDefault();
                return;
            }
            
            if (!e.ctrlKey && !e.metaKey) {
                this.isDragging = true;
                this.selectedNode = node;
                
                // Add dragging class to container on mobile to prevent scrolling
                if (this.isMobile) {
                    this.container.classList.add('node-dragging');
                    // Haptic feedback saat mulai drag
                    if (navigator.vibrate) {
                        navigator.vibrate(10);
                    }
                }
                
                // Calculate drag offset in SVG coordinates
                const scrollX = this.container.scrollLeft;
                const scrollY = this.container.scrollTop;
                const screenX = x - rect.left;
                const screenY = y - rect.top;
                const svgX = (screenX + scrollX - 2500) / this.zoomLevel;
                const svgY = (screenY + scrollY - 2500) / this.zoomLevel;
                
                this.dragOffset.x = svgX - node.x;
                this.dragOffset.y = svgY - node.y;
                this.updateDisplay();
                e.preventDefault();
            }
        }
    }
    
    handleMouseMove(e) {
        if (this.isConnecting && this.connectingStartNode) {
            // Draw temporary connection line
            const containerRect = this.container.getBoundingClientRect();
            const scrollX = this.container.scrollLeft;
            const scrollY = this.container.scrollTop;
            
            const screenX = e.clientX - containerRect.left;
            const screenY = e.clientY - containerRect.top;
            
            const svgX = (screenX + scrollX - 2500) / this.zoomLevel;
            const svgY = (screenY + scrollY - 2500) / this.zoomLevel;
            
            if (!this.tempConnectionLine) {
                this.tempConnectionLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                this.tempConnectionLine.setAttribute('stroke', '#ec4899');
                this.tempConnectionLine.setAttribute('stroke-width', '3');
                this.tempConnectionLine.setAttribute('stroke-dasharray', '5,5');
                this.tempConnectionLine.setAttribute('opacity', '0.7');
                this.tempConnectionLine.setAttribute('x1', this.connectingStartNode.x);
                this.tempConnectionLine.setAttribute('y1', this.connectingStartNode.y);
                this.connectionsGroup.appendChild(this.tempConnectionLine);
            }
            
            this.tempConnectionLine.setAttribute('x2', svgX);
            this.tempConnectionLine.setAttribute('y2', svgY);
        }
        
        if (this.isDragging && this.selectedNode) {
            // Convert screen coordinates to SVG coordinates
            const containerRect = this.container.getBoundingClientRect();
            const scrollX = this.container.scrollLeft;
            const scrollY = this.container.scrollTop;
            
            const screenX = e.clientX - containerRect.left;
            const screenY = e.clientY - containerRect.top;
            
            const svgX = (screenX + scrollX - 2500) / this.zoomLevel;
            const svgY = (screenY + scrollY - 2500) / this.zoomLevel;
            
            this.selectedNode.x = svgX - this.dragOffset.x / this.zoomLevel;
            this.selectedNode.y = svgY - this.dragOffset.y / this.zoomLevel;
            
            // Add dragging class for visual feedback
            const nodeElement = this.nodesGroup.querySelector(`[data-id="${this.selectedNode.id}"]`);
            if (nodeElement && !nodeElement.classList.contains('dragging')) {
                nodeElement.classList.add('dragging');
            }
            
            // Update connections
            this.updateConnections();
            this.updateDisplay();
        }
    }
    
    handleMouseUp(e) {
        // Remove dragging class
        if (this.selectedNode) {
            const nodeElement = this.nodesGroup.querySelector(`[data-id="${this.selectedNode.id}"]`);
            if (nodeElement) {
                nodeElement.classList.remove('dragging');
            }
        }
        
        // Haptic feedback saat selesai drag di mobile
        if (this.isDragging && this.isMobile && navigator.vibrate) {
            navigator.vibrate(10);
        }
        
        // Remove dragging class from container
        this.container.classList.remove('node-dragging');
        
        this.isDragging = false;
        
        // If connecting, check if we released over a node
        if (this.isConnecting && this.connectingStartNode) {
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;
            const node = this.getNodeAt(x, y);
            
            if (node && node.id !== this.connectingStartNode.id) {
                this.connectNodes(this.connectingStartNode, node);
                // Haptic feedback
                if (navigator.vibrate) {
                    navigator.vibrate(30);
                }
            }
            
            this.isConnecting = false;
            this.connectingStartNode = null;
            if (this.tempConnectionLine) {
                this.tempConnectionLine.remove();
                this.tempConnectionLine = null;
            }
            this.updateDisplay();
        }
    }
    
    updateConnections() {
        this.connections.forEach(conn => {
            const fromNode = this.nodes.find(n => n.id === conn.fromId);
            const toNode = this.nodes.find(n => n.id === conn.toId);
            if (fromNode && toNode) {
                conn.from = { x: fromNode.x, y: fromNode.y };
                conn.to = { x: toNode.x, y: toNode.y };
            }
        });
    }
    
    deleteNode(node) {
        // Remove node
        this.nodes = this.nodes.filter(n => n.id !== node.id);
        
        // Remove connections
        this.connections = this.connections.filter(
            conn => conn.fromId !== node.id && conn.toId !== node.id
        );
        
        if (this.selectedNode && this.selectedNode.id === node.id) {
            this.selectedNode = null;
        }
        
        this.updateDisplay();
    }
    
    openEditModal(node) {
        this.currentEditingNode = node;
        document.getElementById('nodeTextInput').value = node.text;
        document.getElementById('editModal').style.display = 'block';
        document.getElementById('nodeTextInput').focus();
        document.getElementById('nodeTextInput').select();
    }
    
    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditingNode = null;
        // Prevent click event after modal closes
        this.justClosedModal = true;
        setTimeout(() => {
            this.justClosedModal = false;
        }, 100);
    }
    
    saveNodeText() {
        if (this.currentEditingNode) {
            const newText = document.getElementById('nodeTextInput').value.trim();
            if (newText) {
                this.currentEditingNode.text = newText;
                this.updateDisplay();
            }
        }
        this.closeEditModal();
    }
    
    clearAll() {
        if (this.nodes.length === 0 && this.connections.length === 0) {
            alert('Tidak ada yang perlu dihapus.');
            return;
        }
        
        if (confirm('Apakah Anda yakin ingin menghapus SEMUA node dan koneksi?')) {
            this.nodes = [];
            this.connections = [];
            this.selectedNode = null;
            this.selectedConnection = null;
            this.connectMode = false;
            this.connectSourceNode = null;
            this.isConnecting = false;
            this.connectingStartNode = null;
            if (this.tempConnectionLine) {
                this.tempConnectionLine.remove();
                this.tempConnectionLine = null;
            }
            const btn = document.getElementById('connectBtn');
            btn.classList.remove('active');
            const btnIcon = btn.querySelector('.btn-icon');
            const btnText = btn.querySelector('.btn-text');
            if (btnIcon) btnIcon.textContent = '🔗';
            if (btnText) btnText.textContent = 'Hubungkan';
            this.updateDisplay();
        }
    }
    
    async downloadAsPNG() {
        try {
            // Show loading
            const downloadBtn = document.getElementById('downloadBtn');
            const btnIcon = downloadBtn.querySelector('.btn-icon');
            const btnText = downloadBtn.querySelector('.btn-text');
            const originalIcon = btnIcon ? btnIcon.textContent : '';
            const originalText = btnText ? btnText.textContent : '';
            
            if (btnIcon) btnIcon.textContent = '⏳';
            if (btnText) btnText.textContent = 'Mengunduh...';
            downloadBtn.disabled = true;
            
            // Create a temporary SVG with all nodes visible
            const tempSvg = this.svg.cloneNode(true);
            tempSvg.setAttribute('width', '5000');
            tempSvg.setAttribute('height', '5000');
            tempSvg.style.position = 'absolute';
            tempSvg.style.left = '-9999px';
            document.body.appendChild(tempSvg);
            
            // Calculate bounding box
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            if (this.nodes.length > 0) {
                this.nodes.forEach(node => {
                    minX = Math.min(minX, node.x - node.width / 2);
                    minY = Math.min(minY, node.y - node.height / 2);
                    maxX = Math.max(maxX, node.x + node.width / 2);
                    maxY = Math.max(maxY, node.y + node.height / 2);
                });
            } else {
                minX = -100;
                minY = -100;
                maxX = 100;
                maxY = 100;
            }
            
            const padding = 50;
            const width = maxX - minX + padding * 2;
            const height = maxY - minY + padding * 2;
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            
            // Create a container for export
            const exportContainer = document.createElement('div');
            exportContainer.style.width = width + 'px';
            exportContainer.style.height = height + 'px';
            exportContainer.style.position = 'absolute';
            exportContainer.style.left = '-9999px';
            exportContainer.style.background = '#fafafa';
            document.body.appendChild(exportContainer);
            
            // Create export SVG
            const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            exportSvg.setAttribute('width', width);
            exportSvg.setAttribute('height', height);
            exportSvg.style.display = 'block';
            
            // Add grid pattern
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            pattern.setAttribute('id', 'exportGrid');
            pattern.setAttribute('width', '50');
            pattern.setAttribute('height', '50');
            pattern.setAttribute('patternUnits', 'userSpaceOnUse');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 50 0 L 0 0 0 50');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#e0e0e0');
            path.setAttribute('stroke-width', '1');
            pattern.appendChild(path);
            defs.appendChild(pattern);
            exportSvg.appendChild(defs);
            
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', '100%');
            rect.setAttribute('height', '100%');
            rect.setAttribute('fill', 'url(#exportGrid)');
            exportSvg.appendChild(rect);
            
            // Add marker
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'exportArrowhead');
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '10');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0 0, 10 3, 0 6');
            polygon.setAttribute('fill', '#666');
            marker.appendChild(polygon);
            defs.appendChild(marker);
            
            // Create group with offset
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('transform', `translate(${width/2 - centerX}, ${height/2 - centerY})`);
            
            // Add connections
            const connectionsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            this.connections.forEach(conn => {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', conn.from.x);
                line.setAttribute('y1', conn.from.y);
                line.setAttribute('x2', conn.to.x);
                line.setAttribute('y2', conn.to.y);
                line.setAttribute('stroke', '#666');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('fill', 'none');
                line.setAttribute('marker-end', 'url(#exportArrowhead)');
                connectionsGroup.appendChild(line);
            });
            group.appendChild(connectionsGroup);
            
            // Add nodes
            const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            this.nodes.forEach(node => {
                const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const nodeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                nodeRect.setAttribute('x', node.x - node.width / 2);
                nodeRect.setAttribute('y', node.y - node.height / 2);
                nodeRect.setAttribute('width', node.width);
                nodeRect.setAttribute('height', node.height);
                nodeRect.setAttribute('fill', 'white');
                nodeRect.setAttribute('stroke', '#ec4899');
                nodeRect.setAttribute('stroke-width', '3');
                nodeRect.setAttribute('rx', '10');
                nodeRect.setAttribute('ry', '10');
                nodeGroup.appendChild(nodeRect);
                
                const nodeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                nodeText.setAttribute('x', node.x);
                nodeText.setAttribute('y', node.y);
                nodeText.setAttribute('text-anchor', 'middle');
                nodeText.setAttribute('dominant-baseline', 'middle');
                nodeText.setAttribute('fill', '#333');
                nodeText.setAttribute('font-size', '16');
                nodeText.setAttribute('font-weight', '600');
                nodeText.setAttribute('font-family', 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif');
                nodeText.textContent = node.text;
                nodeGroup.appendChild(nodeText);
                
                nodesGroup.appendChild(nodeGroup);
            });
            group.appendChild(nodesGroup);
            
            exportSvg.appendChild(group);
            exportContainer.appendChild(exportSvg);
            
            // Use html2canvas to convert to PNG
            const canvas = await html2canvas(exportContainer, {
                backgroundColor: '#fafafa',
                scale: 2,
                useCORS: true,
                logging: false,
                width: width,
                height: height
            });
            
            // Create download link
            const link = document.createElement('a');
            link.download = `mind-map-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // Cleanup
            document.body.removeChild(tempSvg);
            document.body.removeChild(exportContainer);
            
            // Restore button
            if (btnIcon) btnIcon.textContent = originalIcon;
            if (btnText) btnText.textContent = originalText;
            downloadBtn.disabled = false;
        } catch (error) {
            console.error('Error downloading image:', error);
            alert('Terjadi kesalahan saat mengunduh gambar. Silakan coba lagi.');
            if (btnIcon) btnIcon.textContent = '📥';
            if (btnText) btnText.textContent = 'Download';
            downloadBtn.disabled = false;
        }
    }
    
    toggleConnectMode() {
        this.connectMode = !this.connectMode;
        const btn = document.getElementById('connectBtn');
        const btnIcon = btn.querySelector('.btn-icon');
        const btnText = btn.querySelector('.btn-text');
        
        if (this.connectMode) {
            btn.classList.add('active');
            if (btnIcon) btnIcon.textContent = '✓';
            if (btnText) btnText.textContent = 'Mode Aktif';
            this.container.style.cursor = 'crosshair';
            if (this.selectedNode) {
                this.connectSourceNode = this.selectedNode;
            }
        } else {
            btn.classList.remove('active');
            if (btnIcon) btnIcon.textContent = '🔗';
            if (btnText) btnText.textContent = 'Hubungkan';
            this.connectSourceNode = null;
            this.isConnecting = false;
            this.connectingStartNode = null;
            if (this.tempConnectionLine) {
                this.tempConnectionLine.remove();
                this.tempConnectionLine = null;
            }
            this.container.style.cursor = 'default';
            this.updateDisplay();
        }
    }
    
    copyNode() {
        if (this.selectedNode) {
            this.copiedNode = {
                text: this.selectedNode.text,
                width: this.selectedNode.width,
                height: this.selectedNode.height
            };
        }
    }
    
    pasteNode() {
        if (this.copiedNode) {
            const containerRect = this.container.getBoundingClientRect();
            const scrollX = this.container.scrollLeft;
            const scrollY = this.container.scrollTop;
            
            // Paste near the selected node or at viewport center
            let svgX, svgY;
            if (this.selectedNode) {
                svgX = this.selectedNode.x + 150;
                svgY = this.selectedNode.y + 100;
            } else {
                svgX = (containerRect.width / 2 + scrollX - 2500) / this.zoomLevel;
                svgY = (containerRect.height / 2 + scrollY - 2500) / this.zoomLevel;
            }
            
            const newNode = {
                id: Date.now(),
                x: svgX,
                y: svgY,
                text: this.copiedNode.text + ' (Copy)',
                width: this.copiedNode.width,
                height: this.copiedNode.height
            };
            
            this.nodes.push(newNode);
            this.selectedNode = newNode;
            this.updateDisplay();
        }
    }
    
    cutNode() {
        if (this.selectedNode) {
            this.copyNode();
            this.deleteNode(this.selectedNode);
        }
    }
    
    handleCopy(e) {
        if (this.selectedNode && !e.target.closest('input')) {
            this.copyNode();
            e.clipboardData.setData('text/plain', this.selectedNode.text);
            e.preventDefault();
        }
    }
    
    handlePaste(e) {
        if (!e.target.closest('input')) {
            this.pasteNode();
            e.preventDefault();
        }
    }
    
    handleCut(e) {
        if (this.selectedNode && !e.target.closest('input')) {
            this.cutNode();
            e.preventDefault();
        }
    }
    
    connectNodes(fromNode, toNode) {
        if (fromNode.id === toNode.id) return;
        
        const existingConnection = this.connections.find(
            conn => (conn.fromId === fromNode.id && conn.toId === toNode.id) ||
                   (conn.fromId === toNode.id && conn.toId === fromNode.id)
        );
        
        if (!existingConnection) {
            this.connections.push({
                fromId: fromNode.id,
                toId: toNode.id,
                from: { x: fromNode.x, y: fromNode.y },
                to: { x: toNode.x, y: toNode.y }
            });
            this.updateDisplay();
        }
    }
    
    showMobileContextMenu(node, x, y) {
        // Close any existing menu
        this.closeMobileContextMenu();
        
        // Create mobile context menu
        const menu = document.createElement('div');
        menu.className = 'mobile-context-menu';
        menu.id = 'mobileContextMenu';
        
        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Menu items
        const menuItems = [
            {
                icon: '✏️',
                text: 'Edit',
                action: () => {
                    this.selectedNode = node;
                    this.openEditModal(node);
                    this.closeMobileContextMenu();
                }
            },
            {
                icon: '📋',
                text: 'Copy',
                action: () => {
                    this.selectedNode = node;
                    this.copyNode();
                    this.showToast('Node disalin!');
                    this.closeMobileContextMenu();
                }
            },
            {
                icon: '📌',
                text: 'Paste',
                action: () => {
                    if (this.copiedNode) {
                        this.selectedNode = node;
                        this.pasteNode();
                        this.showToast('Node ditempel!');
                    } else {
                        this.showToast('Tidak ada yang disalin');
                    }
                    this.closeMobileContextMenu();
                },
                disabled: !this.copiedNode
            },
            {
                icon: '🔗',
                text: 'Connect',
                action: () => {
                    this.selectedNode = node;
                    this.connectSourceNode = node;
                    this.connectMode = true;
                    const btn = document.getElementById('connectBtn');
                    btn.classList.add('active');
                    const btnIcon = btn.querySelector('.btn-icon');
                    const btnText = btn.querySelector('.btn-text');
                    if (btnIcon) btnIcon.textContent = '✓';
                    if (btnText) btnText.textContent = 'Mode Aktif';
                    this.showToast('Tap node lain untuk menghubungkan');
                    this.closeMobileContextMenu();
                }
            },
            {
                icon: '🗑️',
                text: 'Delete',
                action: () => {
                    if (confirm('Hapus node ini?')) {
                        this.deleteNode(node);
                        this.showToast('Node dihapus');
                    }
                    this.closeMobileContextMenu();
                },
                danger: true
            }
        ];
        
        menuItems.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'mobile-menu-item' + (item.danger ? ' danger' : '') + (item.disabled ? ' disabled' : '');
            btn.innerHTML = `<span class="menu-icon">${item.icon}</span><span class="menu-text">${item.text}</span>`;
            if (!item.disabled) {
                // Use both click and touchend for better compatibility
                const handleAction = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Haptic feedback
                    if (navigator.vibrate) {
                        navigator.vibrate(20);
                    }
                    item.action();
                };
                btn.addEventListener('click', handleAction);
                btn.addEventListener('touchend', handleAction);
            }
            menu.appendChild(btn);
        });
        
        // Position menu
        const menuWidth = 200;
        const menuHeight = menuItems.length * 50;
        let menuX = x - menuWidth / 2;
        let menuY = y - menuHeight - 20; // Above the touch point
        
        // Keep menu within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (menuX < 10) menuX = 10;
        if (menuX + menuWidth > viewportWidth - 10) menuX = viewportWidth - menuWidth - 10;
        if (menuY < 10) menuY = y + 20; // Show below if not enough space above
        if (menuY + menuHeight > viewportHeight - 10) menuY = viewportHeight - menuHeight - 10;
        
        menu.style.left = menuX + 'px';
        menu.style.top = menuY + 'px';
        
        document.body.appendChild(menu);
        this.mobileContextMenu = menu;
        
        // Close menu when clicking outside
        this.closeMobileContextMenuHandler = this.createCloseMobileContextMenuHandler();
        setTimeout(() => {
            document.addEventListener('click', this.closeMobileContextMenuHandler, true);
            document.addEventListener('touchstart', this.closeMobileContextMenuHandler, true);
        }, 100);
        
        // Animate in
        setTimeout(() => menu.classList.add('show'), 10);
    }
    
    closeMobileContextMenu() {
        if (this.mobileContextMenu) {
            this.mobileContextMenu.classList.remove('show');
            setTimeout(() => {
                if (this.mobileContextMenu && this.mobileContextMenu.parentNode) {
                    this.mobileContextMenu.parentNode.removeChild(this.mobileContextMenu);
                }
                this.mobileContextMenu = null;
            }, 200);
            if (this.closeMobileContextMenuHandler) {
                document.removeEventListener('click', this.closeMobileContextMenuHandler, true);
                document.removeEventListener('touchstart', this.closeMobileContextMenuHandler, true);
            }
        }
    }
    
    createCloseMobileContextMenuHandler() {
        return (e) => {
            // Don't close if clicking inside the menu
            if (e.target.closest('.mobile-context-menu')) {
                return;
            }
            this.closeMobileContextMenu();
        };
    }
    
    showToast(message) {
        // Remove existing toast if any
        const existingToast = document.getElementById('toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after 2 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Initialize mind map when page loads
let mindMap;
document.addEventListener('DOMContentLoaded', () => {
    mindMap = new MindMap();
});
