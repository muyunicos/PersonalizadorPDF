/**
 * Advanced Gradient Picker with Drag Handlers
 * Allows visual editing of gradient color stops with drag-and-drop
 */

(function() {
    'use strict';

    class GradientPicker {
        constructor(container, updateInput) {
            this.container = container;
            this.updateInput = updateInput;
            this.stops = [];
            this.draggingStop = null;
            this.dragOffset = 0;
            
            this.init();
        }

        init() {
            // Parse existing gradient value
            this.parseGradient(this.updateInput.value);
            
            // Create UI
            this.createUI();
            
            // Bind events
            this.bindEvents();
        }

        parseGradient(value) {
            this.stops = [];
            if (!value) {
                // Default gradient
                this.stops = [
                    { color: '#ff0000', position: 0 },
                    { color: '#00ff00', position: 100 }
                ];
                return;
            }

            // Parse format: "#rrggbbaa position%, #rrggbbaa position%, ..."
            const parts = value.split(',').map(p => p.trim());
            parts.forEach(part => {
                const match = part.match(/#([0-9a-f]{8})\s+(\d+)%/i);
                if (match) {
                    const color = '#' + match[1].substring(0, 6);
                    const position = parseInt(match[2], 10);
                    this.stops.push({ color, position });
                }
            });

            // Sort by position
            this.stops.sort((a, b) => a.position - b.position);

            // Ensure at least 2 stops
            if (this.stops.length < 2) {
                this.stops = [
                    { color: '#ff0000', position: 0 },
                    { color: '#00ff00', position: 100 }
                ];
            }
        }

        createUI() {
            // Clear container
            this.container.innerHTML = '';

            // Preview bar
            this.preview = document.createElement('div');
            this.preview.className = 'gradient-preview';
            this.preview.style.cssText = 'width:100%;height:30px;border-radius:4px;cursor:pointer;border:1px solid #444;margin-bottom:8px;';
            this.container.appendChild(this.preview);

            // Gradient track
            this.track = document.createElement('div');
            this.track.className = 'gradient-track';
            this.track.style.cssText = 'width:100%;height:20px;background:linear-gradient(to right, #333 0%, #333 100%);position:relative;border-radius:4px;border:1px solid #555;';
            this.container.appendChild(this.track);

            // Create stop handles
            this.renderStops();

            // Add stop button
            const addBtn = document.createElement('button');
            addBtn.textContent = '+ Add Color';
            addBtn.style.cssText = 'margin-top:8px;padding:4px 8px;cursor:pointer;background:#444;color:#fff;border:none;border-radius:4px;';
            addBtn.addEventListener('click', () => this.addStop());
            this.container.appendChild(addBtn);

            // Update preview
            this.updatePreview();
        }

        renderStops() {
            // Remove existing stops
            this.track.querySelectorAll('.gradient-stop').forEach(el => el.remove());

            // Create stop handles
            this.stops.forEach((stop, index) => {
                const handle = document.createElement('div');
                handle.className = 'gradient-stop';
                handle.dataset.index = index;
                handle.style.cssText = `
                    position: absolute;
                    top: -5px;
                    width: 14px;
                    height: 30px;
                    background: ${stop.color};
                    border: 2px solid #fff;
                    border-radius: 3px;
                    cursor: ew-resize;
                    transform: translateX(-50%);
                    left: ${stop.position}%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                `;

                // Color picker: the hidden input must live INSIDE the picker container (and
                // therefore inside any floating editor panel). A programmatic
                // .click() bubbles to the document, and the fill-style editor
                // closes on outside-clicks detected in the capture phase — an
                // input appended to document.body closed the panel instantly.
                handle.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this._colorInput && this._colorInput.parentNode) {
                        this._colorInput.parentNode.removeChild(this._colorInput);
                    }
                    const colorInput = document.createElement('input');
                    colorInput.type = 'color';
                    colorInput.value = stop.color;
                    colorInput.style.display = 'none';
                    this.container.appendChild(colorInput);
                    this._colorInput = colorInput;
                    colorInput.addEventListener('input', (ev) => {
                        stop.color = ev.target.value;
                        handle.style.background = stop.color;
                        this.updatePreview();
                        this.updateInputValue();
                    });
                    colorInput.addEventListener('change', () => {
                        if (colorInput.parentNode) colorInput.parentNode.removeChild(colorInput);
                        if (this._colorInput === colorInput) this._colorInput = null;
                    });
                    colorInput.click();
                });

                // Delete on right-click (except first and last)
                if (index > 0 && index < this.stops.length - 1) {
                    handle.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        this.removeStop(index);
                    });
                }

                // Drag events
                handle.addEventListener('mousedown', (e) => this.startDrag(e, index, handle));

                this.track.appendChild(handle);
            });
        }

        startDrag(e, index, handle) {
            e.preventDefault();
            this.draggingStop = index;
            const rect = this.track.getBoundingClientRect();
            this.dragOffset = e.clientX - rect.left;
            
            const onMouseMove = (e) => {
                const rect = this.track.getBoundingClientRect();
                let position = ((e.clientX - rect.left) / rect.width) * 100;
                position = Math.max(0, Math.min(100, position));
                
                this.stops[index].position = Math.round(position);
                handle.style.left = position + '%';
                this.updatePreview();
                this.updateInputValue();
            };

            const onMouseUp = () => {
                this.draggingStop = null;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        addStop() {
            // Add stop at middle position
            const middlePos = 50;
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            
            this.stops.push({ color: randomColor, position: middlePos });
            this.stops.sort((a, b) => a.position - b.position);
            
            this.renderStops();
            this.updatePreview();
            this.updateInputValue();
        }

        removeStop(index) {
            if (this.stops.length <= 2) return; // Keep at least 2 stops
            this.stops.splice(index, 1);
            this.renderStops();
            this.updatePreview();
            this.updateInputValue();
        }

        updatePreview() {
            const gradientStr = this.stops
                .sort((a, b) => a.position - b.position)
                .map(stop => `${stop.color} ${stop.position}%`)
                .join(', ');
            this.preview.style.background = `linear-gradient(to right, ${gradientStr})`;
        }

        updateInputValue() {
            const value = this.stops
                .sort((a, b) => a.position - b.position)
                .map(stop => {
                    // Convert hex to rgba format
                    const hex = stop.color.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    const a = 255; // Full opacity
                    return `#${hex}${a.toString(16).padStart(2, '0')} ${stop.position}%`;
                })
                .join(', ');
            
            this.updateInput.value = value;
            
            // Always notify listeners: the static hidden inputs are bound via
            // bindGradientColorInputs() and the fill-style editor's input has
            // its own listener. The old `dataset.ttOption` gate silently
            // dropped updates for inputs without the attribute, so gradient
            // edits never reached the settings or the canvas.
            this.updateInput.dispatchEvent(new Event('input'));
        }

        bindEvents() {
            // Click on track to add stop
            this.track.addEventListener('click', (e) => {
                if (e.target === this.track) {
                    const rect = this.track.getBoundingClientRect();
                    const position = ((e.clientX - rect.left) / rect.width) * 100;
                    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                    
                    this.stops.push({ color: randomColor, position: Math.round(position) });
                    this.stops.sort((a, b) => a.position - b.position);
                    
                    this.renderStops();
                    this.updatePreview();
                    this.updateInputValue();
                }
            });
        }
    }

    // Initialize all gradient pickers
    function initGradientPickers() {
        document.querySelectorAll('.tt-gradient-picker').forEach(function(picker) {
            const updateInput = document.getElementById(picker.dataset.updateInput);
            if (!updateInput) return;
            
            new GradientPicker(picker, updateInput);
        });
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGradientPickers);
    } else {
        initGradientPickers();
    }

    // Expose for manual initialization
    window.GradientPicker = {
        init: initGradientPickers,
        create: function(container, updateInput) { return new GradientPicker(container, updateInput); }
    };
})();
