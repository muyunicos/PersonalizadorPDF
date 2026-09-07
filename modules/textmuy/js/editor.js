/* ===== TEXTSTUDIO EDITOR - Canvas Rendering Engine ===== */

(function() {
    'use strict';

    // Default settings matching TextStudio's preset structure
    // Conceptual order: TEXT → 3D & FILLING → OUTLINES → SHADOWS → ICON → BACKGROUND → ANIMATION → DOWNLOAD
    const defaultSettings = {
        editable: 1,
        // ===== TEXT =====
        text: 'TEXT',
        font: {
            src: 'Bangers',
            size: 76,
            weight: 'normal',
            name: '',
        },
        align: 'center',
        rotate: 0,
        lineHeight: 1,
        letterSpacing: 0,
        distort: { arc: { angle: 0 } },
        mergeGradients: false,
        // Persistent per-line overrides. The base settings above are All.

        // ===== 3D & FILLING =====
        // Filling (Relleno principal) - RGB format matching TextStudio
        fill: {
            active: true,
            alpha: 1,
            color: { r: 255, g: 255, b: 255 },
            texture: { active: false, alpha: 1, blendmode: 'over', src: null, repeat: 'repeat', position: 'left top', size: 1, lettering: false },
            gradient: { active: false, angle: 0, colors: [] },
            palette: { active: false, lettering: { method: 'letter' }, styles: [] }
        },

        // Lettering (Comportamiento tipográfico)
        lettering: {
            editable: true,
            active: false,
            blendmode: 'over',
            // Flag v2: wave model shared by Tilt/Rise (per-letter actions) and
            // Wave width/Wave shift/Shape (wave geometry). See flagWaveAt().
            flag: { active: false, tilt: 0, rise: 0, waveWidth: 100, waveShift: 0, shape: 'smooth', tiltMode: 'wave' },
            // Keys match the UI labels ("Max rotation", "Scatter height").
            boggle: { active: false, maxRotation: 40, scatterHeight: 50 },
            reverseOverlap: { letters: 1, lines: 0 },
            shadow: { active: false, size: 0.04, distance: 0.02, angle: 180, fill: { alpha: 1, color: { r: 0, g: 0, b: 0 } } }
        },

        // Processing (efectos de procesamiento de imagen)
        processing: {},

        // 3D Projection #1 (Extrusión tridimensional) - RGB format
        depth: {
            active: false,
            length: 0.2,
            angle: 135,
            fill: {
                alpha: 1,
                color: { r: 255, g: 255, b: 255 },
                mergeAlpha: false,
                gradient: { active: true, type: 'depth', angle: 0, colors: [] },
                texture: { active: false, alpha: 1, blendmode: 'over', src: null, repeat: 'repeat', position: 'center', size: 1 }
            }
        },

        // 3D Projection #2 (Extrusión tridimensional) - RGB format
        depth2: {
            active: false,
            length: 0.2,
            angle: 135,
            fill: {
                alpha: 1,
                color: { r: 255, g: 255, b: 255 },
                mergeAlpha: false,
                gradient: { active: true, type: 'depth', angle: 0, colors: [] },
                texture: { active: false, alpha: 1, blendmode: 'over', src: null, repeat: 'repeat', position: 'center', size: 1 }
            }
        },

        // ===== OUTLINES =====
        // Outline structure matching TextStudio
        outline: {
            first: {
                active: false,
                width: 0.1,
                position: 'outside',
                dash: 0,
                join: 'round',
                fill: {
                    alpha: 1,
                    color: { r: 0, g: 0, b: 0 },
                    gradient: { active: false, angle: 0, colors: [] },
                    palette: { active: false, lettering: { method: 'letter' }, styles: [] },
                    texture: { active: false, alpha: 1, blendmode: 'over', src: null, repeat: 'repeat', position: 'center', size: 1, lettering: false }
                }
            },
            second: {
                active: false,
                width: 0.1,
                position: 'outside',
                dash: 0,
                join: 'round',
                fill: {
                    alpha: 1,
                    color: { r: 0, g: 0, b: 0 },
                    gradient: { active: false, angle: 0, colors: [] },
                    palette: { active: false, lettering: { method: 'letter' }, styles: [] },
                    texture: { active: false, alpha: 1, blendmode: 'over', src: null, repeat: 'repeat', position: 'center', size: 1, lettering: false }
                }
            },
            global: {
                active: false,
                width: 0.1,
                join: 'round',
                mask: false,
                projection: true,
                vector: true,
                shadow: { active: false, color: { r: 0, g: 0, b: 0, a: 1 }, size: 0.5 },
                fill: {
                    alpha: 1,
                    color: { r: 255, g: 255, b: 255 },
                    gradient: { active: false, angle: 0, colors: [] },
                    texture: { active: false, alpha: 1, blendmode: 'over', src: null, repeat: 'repeat', position: 'center', size: 1 }
                }
            },
            global2: {
                active: false,
                width: 0.1,
                join: 'round',
                mask: false,
                projection: true,
                vector: true,
                shadow: { active: false, color: { r: 0, g: 0, b: 0, a: 1 }, size: 0.5 },
                fill: {
                    alpha: 1,
                    color: { r: 255, g: 255, b: 255 },
                    gradient: { active: false, angle: 0, colors: [] },
                    texture: { active: false, alpha: 1, blendmode: 'over', src: null, repeat: 'repeat', position: 'center', size: 1 }
                }
            }
        },

        // Legacy compatibility - map to outline.first
        outline2: {
            active: false,
            width: 0.1,
            color: '#000000',
            join: 'round',
            gradient: { active: false, startColor: '#000000', endColor: '#000000', angle: 0, colors: [] },
            alpha: 1
        },

        // ===== SHADOWS =====
        // Bevel structure matching TextStudio (inner + inner2 "brother")
        bevel: {
            inner: {
                active: false,
                size: 0.1,
                smoothing: 0,
                soften: 0.1,
                angle: 135,
                altitude: 0,
                highlight: { alpha: 1, blendmode: 'over', color: { r: 255, g: 255, b: 255 } },
                shadow: { alpha: 1, blendmode: 'over', color: { r: 0, g: 0, b: 0 } }
            },
            inner2: {
                active: false,
                size: 0.1,
                smoothing: 0,
                soften: 0.1,
                angle: 135,
                altitude: 0,
                highlight: { alpha: 1, blendmode: 'over', color: { r: 255, g: 255, b: 255 } },
                shadow: { alpha: 1, blendmode: 'over', color: { r: 0, g: 0, b: 0 } }
            }
        },

        // Specular inner lighting
        specular: {
            inner: {
                active: false,
                type: 'default',
                color: { r: 255, g: 255, b: 255 },
                blendmode: 'screen',
                blur: 0.5,
                constant: 0.5,
                exponent: 12,
                azimuth: 0,
                elevation: 50,
                point: { x: 0, y: 0, z: 1 },
                scale: 1
            }
        },

        // Shadow structure matching TextStudio
        shadow: {
            outer: {
                active: false,
                size: 0.2,
                strength: 0,
                mask: false,
                distance: 0.1,
                angle: 135,
                fill: {
                    alpha: 1,
                    color: { r: 0, g: 0, b: 0 },
                    gradient: { active: false, angle: 0, colors: [] }
                }
            },
            outer2: {
                active: false,
                size: 0.2,
                strength: 0,
                mask: false,
                distance: 0.1,
                angle: 135,
                fill: {
                    alpha: 1,
                    color: { r: 0, g: 0, b: 255 },
                    gradient: { active: false, angle: 0, colors: [] }
                }
            },
            inner: {
                active: false,
                size: 0.2,
                strength: 0,
                alpha: 1,
                color: { r: 0, g: 0, b: 0 },
                distance: 0.03,
                angle: -45,
                offset: 0,
                erosion: { size: 0, vector: 1 },
                blendmode: 'over'
            },
            inner2: {
                active: false,
                size: 0.2,
                strength: 0,
                alpha: 1,
                color: { r: 255, g: 255, b: 255 },
                distance: 0.03,
                angle: 135,
                offset: 0,
                erosion: { size: 0, vector: 1 },
                blendmode: 'over'
            }
        },

        // Legacy compatibility
        shadowInner: {
            active: false,
            size: 0,
            distance: 0,
            angle: 0,
            offset: 0,
            color: '#000000',
            alpha: 1,
            blendmode: 'normal'
        },
        shadowInner2: {
            active: false,
            size: 0,
            distance: 0,
            angle: 0,
            offset: 0,
            color: '#000000',
            alpha: 1,
            blendmode: 'normal'
        },
        shadowOuter: {
            active: false,
            size: 0,
            distance: 0,
            angle: 0,
            strength: 0,
            fill: { color: '#000000', alpha: 1, gradient: { active: false, startColor: '#000000', endColor: '#ffffff', angle: 0, colors: [] } },
            mask: false,
            blendmode: 'normal'
        },
        shadowOuter2: {
            active: false,
            size: 0,
            distance: 0,
            angle: 0,
            strength: 0,
            fill: { color: '#000000', alpha: 1, gradient: { active: false, startColor: '#000000', endColor: '#ffffff', angle: 0, colors: [] } },
            mask: false,
            blendmode: 'normal'
        },

        // ===== ICON =====
        icon: {
            editable: true,
            active: false,
            alpha: 1,
            src: null,
            size: 1,
            rotate: 0,
            position: 'center',
            composite: 'source-over',
            offset: { x: 0, y: 0 }
        },

        // ===== BACKGROUND =====
        background: {
            editable: true,
            active: true,
            composite: 'source-over',
            fill: {
                alpha: 1,
                color: { r: 0, g: 0, b: 0 },
                image: { active: false, alpha: 1, src: null, size: 'cover', repeat: 'repeat' },
                gradient: { active: false, angle: 0, type: 'radial', colors: [] }
            }
        },

        // ===== ANIMATION =====
        animation: {
            editable: true,
            active: true,
            id: '',
            pause: 1000,
            duration: 1000
        },

        // ===== DOWNLOAD =====
        download: {
            size: 'medium',
            format: 'png',
            ratio: 'fit',
            spacing: 0.05
        },

        // ===== CANVAS =====
        canvas: {
            width: 240,
            height: 600,
            ratio: 2.5,
            autoFit: false,
            zoom: 100,
            maxFontSize: 100,
            padding: 0
        },

        // ===== PROCESSING =====
        processing: {
            active: false,
            code: null
        }
    };

    // Helper function for safe property access
    function safeGet(obj, path, defaultValue) {
        if (!obj) return defaultValue;
        const keys = path.split('.');
        let current = obj;
        for (const key of keys) {
            if (current === null || current === undefined) {
                return defaultValue;
            }
            current = current[key];
        }
        return current !== undefined ? current : defaultValue;
    }

    // Helper function to safely check if property is active
    function isActive(obj, path) {
        return safeGet(obj, path + '.active', false);
    }

// ---- Performance plumbing -------------------------------------------
    const TEXTURE_CACHE_MAX_IMAGES = 128;            // hard cap on cached textures
    const TEXTURE_CACHE_MAX_BYTES = 64 * 1024 * 1024; // ~64 MB estimated cache size
    const CANVAS_POOL_MAX = 4;                        // reusable offscreen layers
    const CANVAS_POOL_MAX_AREA = 4096 * 4096;         // don't park oversized layers
    // Editor state
    const state = {
        settings: JSON.parse(JSON.stringify(defaultSettings)),
        canvas: null,
        ctx: null,
        scale: 2,
        isRendering: false,
        iconImg: null,
        bgImg: null,
        transparentOutput: false,
        textureImages: {}, // loaded texture images by src
        textureOrder: [],  // LRU order (oldest first)
        textureBytes: 0,   // estimated cached bytes
        canvasPool: []     // reusable offscreen 2D canvases
    };

    // Initialize the editor
    function init(canvasId) {
        state.canvas = document.getElementById(canvasId);
        if (!state.canvas) {
            console.error('Canvas element not found:', canvasId);
            return;
        }
        state.ctx = state.canvas.getContext('2d');

        const textarea = document.getElementById('tt-text-textarea');
        if (textarea) {
            textarea.value = state.settings.text;
        }

        // Preload custom fonts
        if (window.FontLoader) {
            FontLoader.preloadAll();
        }

        const canvasWrapper = document.getElementById('tt-canvas-wrapper');
        if (canvasWrapper && typeof ResizeObserver !== 'undefined') {
            state.canvasResizeObserver = new ResizeObserver(function() {
                render();
            });
            state.canvasResizeObserver.observe(canvasWrapper);
        }

        render();
    }

    // Calculate extra width/height from effects (outline, depth, shadow)
    // Updated for TextStudio structure (outline.first, outline.second, outline.global, etc.)
    function calcExtraWidth(s, fontSizePx) {
        let extra = 0;
        
        // Outline layers
        if (isActive(s, 'outline.first')) extra += safeGet(s, 'outline.first.width', 0) * fontSizePx * 2;
        if (isActive(s, 'outline.second')) extra += safeGet(s, 'outline.second.width', 0) * fontSizePx * 2;
        if (isActive(s, 'outline.global')) extra += safeGet(s, 'outline.global.width', 0) * fontSizePx * 2;
        
        // Legacy compatibility
        if (isActive(s, 'outline')) extra += safeGet(s, 'outline.width', 0) * fontSizePx * 2;
        if (isActive(s, 'outline2')) extra += safeGet(s, 'outline2.width', 0) * fontSizePx * 2;
        
        // Shadow layers
        if (isActive(s, 'shadow.outer')) extra += safeGet(s, 'shadow.outer.distance', 0) * fontSizePx * 2 + safeGet(s, 'shadow.outer.size', 0) * fontSizePx * 2;
        if (isActive(s, 'shadow.outer2')) extra += safeGet(s, 'shadow.outer2.distance', 0) * fontSizePx * 2 + safeGet(s, 'shadow.outer2.size', 0) * fontSizePx * 2;
        
        // Legacy compatibility
        if (isActive(s, 'shadowOuter')) extra += safeGet(s, 'shadowOuter.distance', 0) * fontSizePx * 2 + safeGet(s, 'shadowOuter.size', 0) * fontSizePx * 2;
        if (isActive(s, 'shadowOuter2')) extra += safeGet(s, 'shadowOuter2.distance', 0) * fontSizePx * 2 + safeGet(s, 'shadowOuter2.size', 0) * fontSizePx * 2;
        
        // Depth layers
        if (isActive(s, 'depth')) extra += safeGet(s, 'depth.length', 0) * fontSizePx * 2;
        if (isActive(s, 'depth2')) extra += safeGet(s, 'depth2.length', 0) * fontSizePx * 2;
        
        return extra;
    }

    function calcExtraHeight(s, fontSizePx) {
        return calcExtraWidth(s, fontSizePx); // Same calculation for both dimensions
    }

    // Measure text width with letter spacing
    function measureTextWidth(ctx, text, letterSpacing, fontSizePx) {
        let totalWidth = 0;
        const spacing = letterSpacing * fontSizePx * 0.1;
        for (let i = 0; i < text.length; i++) {
            totalWidth += ctx.measureText(text[i]).width;
        }
        totalWidth += spacing * Math.max(0, text.length - 1);
        return totalWidth;
    }

    // Canvas pixels always keep their configured size. Zoom affects only the
    
    // Canvas pixels always keep their configured size. Zoom affects only the

    /**
     * Apply reverse overlap effect - overlap letters in reverse order
     * This creates a stacked/overlapping effect
     */
    // Canvas pixels always keep their configured size. Zoom affects only the
    // preview CSS size so it cannot alter the output or stretch its aspect ratio.
    function calculateDynamicCanvasSize(ctx, text, s) {
        const baseCanvasWidth = s.canvas.width || 240;
        const baseCanvasHeight = s.canvas.height || 600;
        return {
            width: Math.max(1, Math.round(baseCanvasWidth)),
            height: Math.max(1, Math.round(baseCanvasHeight))
        };
    }

    function calculateCanvasDisplaySize(canvasWidth, canvasHeight, zoomValue) {
        const wrapper = document.getElementById('tt-canvas-wrapper');
        const availableWidth = wrapper && wrapper.clientWidth ? wrapper.clientWidth * 0.9 : canvasWidth;
        const availableHeight = wrapper && wrapper.clientHeight ? wrapper.clientHeight * 0.9 : canvasHeight;
        const fitScale = Math.min(1, availableWidth / canvasWidth, availableHeight / canvasHeight);
        // At 0%, keep the shortest canvas edge at 50px when the wrapper has
        // room, so tall or wide canvases remain usable while preserving ratio.
        const minimumScale = 50 / Math.min(canvasWidth, canvasHeight);
        const zoom = Math.max(0, Math.min(300, Number(zoomValue) || 0));

        let requestedScale;
        if (zoom <= 100) {
            requestedScale = minimumScale + (fitScale - minimumScale) * (zoom / 100);
        } else {
            requestedScale = fitScale + (3 - fitScale) * ((zoom - 100) / 200);
        }

        // Up to 100% the preview is contained. Above it, preserve the
        // requested scale and let the centered viewer clip the overflow.
        const displayScale = zoom > 100 ? requestedScale : Math.min(requestedScale, fitScale);
        return Math.max(1, Math.round(canvasWidth * displayScale));
    }

    // Auto-fit: find the largest font size that fits within the canvas
    function autoFitText(ctx, text, lines, canvasWidth, canvasHeight, s) {
        const fontName = window.FontLoader ? FontLoader.getFontName(s.font.src || s.font) : (s.font.src || s.font);
        const fontWeight = s.font.weight || 'normal';
        const padding = canvasWidth * (s.canvas.padding !== undefined ? s.canvas.padding : 0);
        const availW = canvasWidth - padding * 2;
        const availH = canvasHeight - padding * 2;

        let lo = 8;
        let hi = Math.max(8, Math.ceil(Math.max(canvasWidth, canvasHeight)));
        let best = 8;

        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            ctx.font = `${fontWeight} ${mid}px ${fontName}`;

            // Find the widest line
            let maxLineWidth = 0;
            for (let i = 0; i < lines.length; i++) {
                const w = measureTextWidth(ctx, lines[i], s.letterSpacing, mid);
                if (w > maxLineWidth) maxLineWidth = w;
            }

            const metrics = ctx.measureText('Ag');
            const ascent = metrics.actualBoundingBoxAscent || mid * 0.8;
            const descent = metrics.actualBoundingBoxDescent || mid * 0.2;
            const lineAdvance = mid * (s.lineHeight !== undefined ? s.lineHeight : 1);
            const textHeight = ascent + descent + (lines.length - 1) * lineAdvance;
            const extraW = calcExtraWidth(s, mid);
            const extraH = calcExtraHeight(s, mid);
            let renderedWidth = maxLineWidth + extraW;
            let renderedHeight = textHeight + extraH;
            const arcAngle = safeGet(s, 'distort.arc.angle', 0);
            if (Math.abs(arcAngle) >= 0.1 && typeof DistortEngine !== 'undefined') {
                const arcBounds = DistortEngine.getArcGeometry(renderedWidth, renderedHeight, arcAngle);
                renderedWidth = arcBounds.width;
                renderedHeight = arcBounds.height;
            }
            const rotation = Math.abs(s.rotate || 0) * Math.PI / 180;
            if (rotation > 0.0001) {
                const rotatedWidth = Math.abs(renderedWidth * Math.cos(rotation)) + Math.abs(renderedHeight * Math.sin(rotation));
                const rotatedHeight = Math.abs(renderedWidth * Math.sin(rotation)) + Math.abs(renderedHeight * Math.cos(rotation));
                renderedWidth = rotatedWidth;
                renderedHeight = rotatedHeight;
            }

            if (renderedWidth <= availW && renderedHeight <= availH) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }

        return best;
    }

    // ===== PERFORMANCE HELPERS =====
    // Reusable offscreen canvases avoid churn on the large text-composition
    // layer that is recreated on every frame.
    function acquireCanvas(width, height) {
        const pool = state.canvasPool;
        for (let i = 0; i < pool.length; i++) {
            const c = pool[i];
            if (c.width === width && c.height === height) {
                pool.splice(i, 1);
                const cctx = c.getContext('2d');
                cctx.setTransform(1, 0, 0, 1, 0, 0);
                cctx.clearRect(0, 0, c.width, c.height);
                return c;
            }
        }
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        return c;
    }

    function releaseCanvas(canvas) {
        if (!canvas) return;
        if (canvas.width * canvas.height > CANVAS_POOL_MAX_AREA) return;
        if (state.canvasPool.length >= CANVAS_POOL_MAX) return;
        state.canvasPool.push(canvas);
    }

    function estimateImageBytes(img) {
        if (!img) return 0;
        if (img.width && img.height) return img.width * img.height * 4;
        return 1 * 1024 * 1024;
    }

    // Texture src referenced by the current settings, so the LRU never evicts
    // an image the very next render would have to reload.
    function activeTextureSrcs() {
        const s = state.settings;
        const srcs = new Set();
        function add(v) { if (typeof v === 'string' && v) srcs.add(v); }
        add(safeGet(s, 'fill.texture.src'));
        add(safeGet(s, 'outline.first.fill.texture.src'));
        add(safeGet(s, 'outline.second.fill.texture.src'));
        add(safeGet(s, 'outline.global.fill.texture.src'));
        add(safeGet(s, 'depth.fill.texture.src'));
        add(safeGet(s, 'depth2.fill.texture.src'));
        const layers = s.fill && s.fill.layers;
        if (Array.isArray(layers)) {
            layers.forEach(function(layer) {
                (layer && Array.isArray(layer.styles) ? layer.styles : []).forEach(function(style) {
                    if (style && style.texture) add(style.texture.src);
                });
            });
        }
        return srcs;
    }

    function cacheTexture(src, img) {
        state.textureImages[src] = img;
        state.textureBytes += estimateImageBytes(img);
        state.textureOrder.push(src);
        trimTextureCache();
    }

    function touchTexture(src) {
        const idx = state.textureOrder.indexOf(src);
        if (idx !== -1) state.textureOrder.splice(idx, 1);
        state.textureOrder.push(src);
    }

    function removeTexture(src) {
        const img = state.textureImages[src];
        state.textureBytes -= estimateImageBytes(img);
        delete state.textureImages[src];
        const idx = state.textureOrder.indexOf(src);
        if (idx !== -1) state.textureOrder.splice(idx, 1);
    }

    function trimTextureCache() {
        const active = activeTextureSrcs();
        while (
            state.textureOrder.length > TEXTURE_CACHE_MAX_IMAGES ||
            state.textureBytes > TEXTURE_CACHE_MAX_BYTES
        ) {
            if (!state.textureOrder.length) break;
            const victim = state.textureOrder[0];
            if (active.has(victim)) {
                // Oldest candidate is still in use; evict the next free entry.
                const next = state.textureOrder.find(function(src) { return !active.has(src); });
                if (!next) break;
                removeTexture(next);
                continue;
            }
            removeTexture(victim);
        }
    }

    function clearTextureCache() {
        state.textureImages = {};
        state.textureOrder = [];
        state.textureBytes = 0;
    }

    // Main render function
    function render() {
        if (state.isRendering || !state.ctx) return;
        state.isRendering = true;

        const ctx = state.ctx;
        const s = state.settings;

        const text = s.text || 'TEXT';

        // The fixed pixel canvas never grows to fit the text; autoFitText()
        // shrinks the font instead. Zoom only changes the preview size.
        const dynamicSize = calculateDynamicCanvasSize(ctx, text, s);
        const canvasWidth = dynamicSize.width;
        const canvasHeight = dynamicSize.height;

        // Only reassign when the size actually changes: writing to
        // .width/.height resets every 2D context property in most browsers.
        if (state.canvas.width !== canvasWidth) state.canvas.width = canvasWidth;
        if (state.canvas.height !== canvasHeight) state.canvas.height = canvasHeight;

        const displayWidth = calculateCanvasDisplaySize(canvasWidth, canvasHeight, s.canvas.zoom);
        state.canvas.style.width = displayWidth + 'px';
        state.canvas.style.height = 'auto';

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Draw background
        drawBackground(ctx, canvasWidth, canvasHeight);

        const lines = text.split('\n');

        // Max Font Size is based on one character and the canvas's limiting
        // axis: height for horizontal canvases, width for vertical ones.
        // Auto-fit can still reduce that cap when the complete text needs it.
        const fontSizePadding = canvasWidth * (s.canvas.padding !== undefined ? s.canvas.padding : 0);
        const availableWidth = Math.max(1, canvasWidth - fontSizePadding * 2);
        const availableHeight = Math.max(1, canvasHeight - fontSizePadding * 2);
        const singleCharacterReference = canvasWidth >= canvasHeight ? availableHeight : availableWidth;
        const maxFontPercentage = Math.max(0, Math.min(100, s.canvas.maxFontSize !== undefined ? s.canvas.maxFontSize : 100)) / 100;
        const maxFontSizePx = singleCharacterReference * maxFontPercentage;
        const fittingFontSize = autoFitText(ctx, text, lines, canvasWidth, canvasHeight, s);
        const fontSizePx = Math.max(8, Math.round(Math.min(fittingFontSize, maxFontSizePx)));

        // Changing canvas dimensions resets every 2D context property.
        setTextFont(ctx, s, fontSizePx);

        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        // Load icon image if needed
        if (isActive(s, 'icon') && safeGet(s, 'icon.src')) {
            loadIconImage(s.icon.src);
        }

        // Load texture images if needed
        if (isActive(s, 'fill.texture') && safeGet(s, 'fill.texture.src')) {
            loadTextureImage(s.fill.texture.src);
        }
        if (isActive(s, 'outline.texture') && safeGet(s, 'outline.texture.src')) {
            loadTextureImage(s.outline.texture.src);
        }

        // Render all text-related pixels offscreen. The arc is intentionally
        // applied only after this complete layer has been composed, so every
        // fill, outline and shadow follows exactly the same curve. A rotated
        // or fully curved text block can be wider or taller before its final
        // transform than its final bounding box, so size this source layer
        // from the untransformed content to prevent early clipping.
        const rotationValue = Math.abs(s.rotate || 0) * Math.PI / 180;
        const arcAngle = safeGet(s, 'distort.arc.angle', 0);
        const offscreenGutter = 4;
        const textMetrics = ctx.measureText('Ag');
        const textAscent = textMetrics.actualBoundingBoxAscent || fontSizePx * 0.8;
        const textDescent = textMetrics.actualBoundingBoxDescent || fontSizePx * 0.2;
        const lineAdvancePx = fontSizePx * (s.lineHeight !== undefined ? s.lineHeight : 1);
        let textBlockWidth = 0;
        for (let lw = 0; lw < lines.length; lw++) {
            const w = measureTextWidth(ctx, lines[lw], s.letterSpacing, fontSizePx);
            if (w > textBlockWidth) textBlockWidth = w;
        }
        const textBlockHeight = textAscent + textDescent + (lines.length - 1) * lineAdvancePx;
        const offscreenSide = Math.ceil(Math.hypot(canvasWidth, canvasHeight)) + offscreenGutter * 2;
        const sourceWidth = Math.ceil(textBlockWidth + calcExtraWidth(s, fontSizePx)) + offscreenGutter * 2;
        const sourceHeight = Math.ceil(textBlockHeight + calcExtraHeight(s, fontSizePx)) + offscreenGutter * 2;
        const needsExpandedTextLayer = rotationValue > 0.0001 || Math.abs(arcAngle) >= 0.1;
        const textLayerWidth = needsExpandedTextLayer
            ? Math.max(canvasWidth, sourceWidth, rotationValue > 0.0001 ? offscreenSide : 0)
            : canvasWidth;
        const textLayerHeight = needsExpandedTextLayer
            ? Math.max(canvasHeight, sourceHeight, rotationValue > 0.0001 ? offscreenSide : 0)
            : canvasHeight;
        const textLayer = acquireCanvas(textLayerWidth, textLayerHeight);
        textLayer.width = textLayerWidth;
        textLayer.height = textLayerHeight;
        const textCtx = textLayer.getContext('2d');
        textCtx.save();
        textCtx.translate(textLayerWidth / 2, textLayerHeight / 2);

        // Render order matching TextStudio pipeline
        // 1. Outer shadow 2 (TextStudio: shadow.outer2)
        if (isActive(s, 'shadow.outer2') || isActive(s, 'shadowOuter2')) {
            drawOuterShadow2(textCtx, text, lines, fontSizePx, s);
        }

        // 2. Outer shadow (TextStudio: shadow.outer)
        if (isActive(s, 'shadow.outer') || isActive(s, 'shadowOuter')) {
            drawOuterShadow(textCtx, text, lines, fontSizePx, s);
        }

        // 3. 3D depth 2
        if (isActive(s, 'depth2')) {
            drawDepth2(textCtx, text, lines, fontSizePx, s);
        }

        // 4. 3D depth
        if (isActive(s, 'depth')) {
            drawDepth(textCtx, text, lines, fontSizePx, s);
        }

        // 5. Fill
        if (isActive(s, 'fill')) {
            drawFill(textCtx, text, lines, fontSizePx, s);
        }

        // 6. Outline second (TextStudio: outline.second)
        if (isActive(s, 'outline.second') || isActive(s, 'outline2')) {
            drawOutline2(textCtx, text, lines, fontSizePx, s);
        }

        // 7. Outline first (TextStudio: outline.first)
        if (isActive(s, 'outline.first') || isActive(s, 'outline')) {
            drawOutline(textCtx, text, lines, fontSizePx, s);
        }

        // 8. Outline global (TextStudio: outline.global)
        if (isActive(s, 'outline.global')) {
            drawOutlineGlobal(textCtx, text, lines, fontSizePx, s);
        }

        // 9. Bevel inner (TextStudio: bevel.inner)
        if (isActive(s, 'bevel.inner') || isActive(s, 'bevel')) {
            drawBevel(textCtx, text, lines, fontSizePx, s);
        }

        // 10. Inner shadow 2 (TextStudio: shadow.inner2)
        if (isActive(s, 'shadow.inner2') || isActive(s, 'shadowInner2')) {
            drawInnerShadow2(textCtx, text, lines, fontSizePx, s);
        }

        // 11. Inner shadow (TextStudio: shadow.inner)
        if (isActive(s, 'shadow.inner') || isActive(s, 'shadowInner')) {
            drawInnerShadow(textCtx, text, lines, fontSizePx, s);
        }

        // 12. Icon
        if (isActive(s, 'icon') && state.iconImg) {
            drawIcon(textCtx, text, lines, fontSizePx, s);
        }

        textCtx.restore();

        let composedLayer = textLayer;
        let hasTrimmedContent = false;
        if (Math.abs(arcAngle) >= 0.1 && typeof DistortEngine !== 'undefined') {
            if (!state.distortEngine) state.distortEngine = new DistortEngine();
            const croppedLayer = state.distortEngine.trimTransparent(textLayer);
            if (croppedLayer) {
                composedLayer = state.distortEngine.curve(croppedLayer, arcAngle);
                hasTrimmedContent = true;
            }
        }

        // Rotation is deliberately final, applied after the curve so the
        // order matches the reference editor.  The final canvas remains
        // fixed.  To avoid clipping the rotated text against the canvas
        // edges, the empty transparent border of the composed layer is
        // trimmed before rotating, so rotation is centered on the actual
        // content instead of the full-canvas transparent box.
        let rotateLayer = composedLayer;
        if (rotationValue > 0.0001 && typeof DistortEngine !== 'undefined') {
            if (!state.distortEngine) state.distortEngine = new DistortEngine();
            const trimmedLayer = state.distortEngine.trimTransparent(composedLayer);
            if (trimmedLayer) {
                rotateLayer = trimmedLayer;
                hasTrimmedContent = true;
            }
        }

        // Curving and trimming add their own antialiasing gutter, which is
        // not present in the pre-render estimate used by autoFitText(). Fit
        // the actual final layer as a last step so a rotated curve cannot be
        // clipped by the fixed output canvas.
        const rotationCos = Math.abs(Math.cos(rotationValue));
        const rotationSin = Math.abs(Math.sin(rotationValue));
        const finalWidth = rotateLayer.width * rotationCos + rotateLayer.height * rotationSin;
        const finalHeight = rotateLayer.width * rotationSin + rotateLayer.height * rotationCos;
        const canvasPadding = canvasWidth * (s.canvas.padding !== undefined ? s.canvas.padding : 0);
        const availableContentWidth = Math.max(1, canvasWidth - canvasPadding * 2);
        const availableContentHeight = Math.max(1, canvasHeight - canvasPadding * 2);
        const finalScale = hasTrimmedContent
            ? Math.min(1, availableContentWidth / finalWidth, availableContentHeight / finalHeight)
            : 1;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(finalScale, finalScale);
        ctx.rotate((s.rotate * Math.PI) / 180);
        ctx.drawImage(rotateLayer, -rotateLayer.width / 2, -rotateLayer.height / 2);
        ctx.restore();

        // The composed pixels have already been drawn into the target context,
        // so the source layer can be parked for reuse on the next frame.
        releaseCanvas(textLayer);

        state.isRendering = false;
    }

    // Load icon image
    function loadIconImage(src) {
        if (state.iconImg && state.iconImg.src === src) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            state.iconImg = img;
            render();
        };
        img.onerror = function() {
            state.iconImg = null;
        };
        img.src = src;
    }

    // Load texture image (LRU-cached)
    function loadTextureImage(src, callback) {
        if (!src) {
            if (callback) callback(null);
            return;
        }
        if (state.textureImages[src]) {
            touchTexture(src);
            if (callback) callback(state.textureImages[src]);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            cacheTexture(src, img);
            if (callback) callback(img);
            // Textures decode asynchronously: repaint right away so a freshly
            // uploaded pattern appears without needing another interaction
            // (icons and background images already do this).
            render();
        };
        img.onerror = function() {
            if (callback) callback(null);
        };
        img.src = src;
    }

    // Draw background
    function drawBackground(ctx, width, height) {
        const s = state.settings;

        ctx.save();
        if (safeGet(s, 'background.composite')) {
            ctx.globalCompositeOperation = s.background.composite;
        }

        // Support both legacy structure and new TextStudio structure
        const bgConfig = s.background;
        const bgFill = bgConfig.fill || bgConfig;
        const bgImage = bgFill.image || bgConfig.image;
        const bgGradient = bgFill.gradient || bgConfig.gradient;

        if (bgImage && bgImage.active && bgImage.src) {
            loadBackgroundImage(bgImage.src);
            if (state.bgImg) {
                const img = state.bgImg;
                const size = bgImage.size || 'cover';
                const repeat = bgImage.repeat || 'repeat';
                const alpha = bgImage.alpha || 1;

                if (repeat === 'repeat') {
                    ctx.globalAlpha = alpha;
                    const pattern = ctx.createPattern(img, repeat);
                    ctx.fillStyle = pattern;
                    ctx.fillRect(0, 0, width, height);
                } else {
                    ctx.globalAlpha = alpha;
                    let dw = width, dh = height;
                    if (size === 'contain') {
                        const ratio = Math.min(width / img.width, height / img.height);
                        dw = img.width * ratio;
                        dh = img.height * ratio;
                    } else if (size === 'stretch') {
                        dw = width;
                        dh = height;
                    }
                    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
                }
                ctx.restore();
                return;
            }
        }

        if (bgGradient && bgGradient.active) {
            const angle = (bgGradient.angle || 0) * Math.PI / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const grad = ctx.createLinearGradient(
                width / 2 - cos * width / 2, height / 2 - sin * height / 2,
                width / 2 + cos * width / 2, height / 2 + sin * height / 2
            );
            addGradientStops(grad, bgGradient);
            ctx.fillStyle = grad;
            ctx.globalAlpha = bgFill.alpha || 1;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            return;
        }

        if (isActive(s, 'background') && (bgFill.alpha || 0) > 0) {
            const color = bgFill.color || '#000000';
            ctx.fillStyle = getColorValue(color, bgFill.alpha || 1);
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            return;
        }

        ctx.restore();

        if (!state.transparentOutput) {
            // Checkered background for transparency preview only
            const size = 20;
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#222';
            for (let y = 0; y < height; y += size) {
                for (let x = 0; x < width; x += size) {
                    if ((x / size + y / size) % 2 === 0) {
                        ctx.fillRect(x, y, size, size);
                    }
                }
            }
        }
    }

    // Load background image
    function loadBackgroundImage(src) {
        if (state.bgImg && state.bgImg.src === src) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            state.bgImg = img;
            render();
        };
        img.onerror = function() {
            state.bgImg = null;
        };
        img.src = src;
    }

    // Draw outer shadow
    function drawOuterShadow(ctx, text, lines, fontSizePx, s) {
        // Support both legacy structure and new TextStudio structure
        const shadowConfig = s.shadow.outer || s.shadowOuter;
        const distance = (shadowConfig.distance || 0.1) * fontSizePx;
        const angle = (shadowConfig.angle || 135) * Math.PI / 180;
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;
        const blur = (shadowConfig.size || 0.2) * fontSizePx * 2;
        const alpha = safeGet(shadowConfig, 'fill.alpha', 1);
        const color = shadowConfig.fill?.color || shadowConfig.color || '#000000';

        ctx.save();
        ctx.shadowColor = getColorValue(color, alpha);
        ctx.shadowOffsetX = offsetX;
        ctx.shadowOffsetY = offsetY;
        ctx.shadowBlur = blur;

        ctx.fillStyle = 'transparent';
        drawTextLines(ctx, text, lines, fontSizePx, s);

        ctx.restore();
    }

    // Draw 3D depth (extrusion)
    function drawDepth(ctx, text, lines, fontSizePx, s) {
        const length = (s.depth.length || 0.2) * fontSizePx;
        const angle = (s.depth.angle || 135) * Math.PI / 180;
        const offsetX = Math.cos(angle) * length;
        const offsetY = Math.sin(angle) * length;
        const alpha = safeGet(s, 'depth.fill.alpha', 1);
        const color = s.depth.fill?.color || { r: 255, g: 255, b: 255 };

        ctx.save();
        
        // Draw multiple layers for 3D effect
        const layers = Math.ceil(length / 2);
        for (let i = 0; i < layers; i++) {
            const layerOffsetX = (offsetX / layers) * (i + 1);
            const layerOffsetY = (offsetY / layers) * (i + 1);
            
            ctx.translate(layerOffsetX, layerOffsetY);
            
            if (isActive(s, 'depth.fill.gradient')) {
                const gradient = createGradient(ctx, text, lines, fontSizePx, s.depth.fill.gradient, s);
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = getColorValue(color, alpha);
            }
            
            ctx.strokeStyle = 'transparent';
            drawTextLines(ctx, text, lines, fontSizePx, s);
            
            ctx.translate(-layerOffsetX, -layerOffsetY);
        }
        
        ctx.restore();
    }

    // Draw text fill
    // ===== FILL LAYER ENGINE =====
    // fill.layers: [{ active, alpha, blendmode, repeat, styles: [...] }]
    // style:  { type: 'color'|'gradient'|'texture', color?, gradient?{angle,colors}, texture?{src,repeat} }
    // repeat: 'none' (style spans the whole text block, styles stack in order)
    //         'letter'|'word'|'line' (styles cycle per unit, painted edge to edge)
    const MAX_FILL_LAYERS = 4;

    function normalizeFillStyle(style) {
        if (typeof style === 'string') return { type: 'color', color: style };
        if (!style || typeof style !== 'object') return { type: 'color', color: '#ffffff' };
        if (style.type === 'gradient' || (style.gradient && !style.type)) {
            const g = style.gradient || {};
            return { type: 'gradient', gradient: { angle: g.angle || 0, colors: Array.isArray(g.colors) ? g.colors : [] } };
        }
        if (style.type === 'texture' || (style.texture && !style.type)) {
            const t = style.texture || {};
            return { type: 'texture', texture: {
                src: t.src || null,
                repeat: t.repeat || 'repeat',
                position: t.position || 'center',
                fit: t.fit || 'fill',
                scale: t.scale !== undefined ? t.scale : 1
            } };
        }
        return { type: 'color', color: style.color !== undefined ? style.color : '#ffffff' };
    }

    // Build fill layers from the legacy fields (color/gradient/texture/palette)
    function migrateLegacyFillLayers(fill) {
        const baseAlpha = fill.alpha !== undefined ? fill.alpha : 1;
        if (fill.palette && fill.palette.active && Array.isArray(fill.palette.styles) && fill.palette.styles.length) {
            const method = (fill.palette.lettering && fill.palette.lettering.method) || 'letter';
            return [{
                active: true,
                alpha: baseAlpha,
                blendmode: 'source-over',
                repeat: method,
                styles: fill.palette.styles.map(normalizeFillStyle)
            }];
        }
        if (fill.gradient && fill.gradient.active && Array.isArray(fill.gradient.colors) && fill.gradient.colors.length >= 2) {
            return [{
                active: true,
                alpha: baseAlpha,
                blendmode: 'source-over',
                repeat: 'none',
                styles: [{ type: 'gradient', gradient: { angle: fill.gradient.angle || 0, colors: fill.gradient.colors } }]
            }];
        }
        if (fill.texture && fill.texture.active && fill.texture.src) {
            return [{
                active: true,
                alpha: baseAlpha * (fill.texture.alpha !== undefined ? fill.texture.alpha : 1),
                blendmode: fill.texture.blendmode === 'over' ? 'source-over' : (fill.texture.blendmode || 'source-over'),
                repeat: 'none',
                styles: [{ type: 'texture', texture: { src: fill.texture.src, repeat: fill.texture.repeat || 'repeat', position: 'center', fit: 'fill', scale: 1 } }]
            }];
        }
        return [{
            active: true,
            alpha: baseAlpha,
            blendmode: 'source-over',
            repeat: 'none',
            styles: [{ type: 'color', color: fill.color !== undefined ? fill.color : '#ffffff' }]
        }];
    }

    function getFillLayers(s) {
        if (Array.isArray(s.fill.layers) && s.fill.layers.length) return s.fill.layers;
        return migrateLegacyFillLayers(s.fill);
    }

    function drawFill(ctx, text, lines, fontSizePx, s) {
        getFillLayers(s).forEach(function(layer) {
            if (!layer || layer.active === false) return;
            drawFillLayer(ctx, text, lines, fontSizePx, s, layer);
        });
    }

    function drawFillLayer(ctx, text, lines, fontSizePx, s, layer) {
        const styles = (Array.isArray(layer.styles) ? layer.styles : []).filter(Boolean);
        if (!styles.length) return;
        const repeat = layer.repeat || 'none';
        const alpha = layer.alpha !== undefined ? layer.alpha : 1;
        if (alpha <= 0) return;
        const blendmode = layer.blendmode === 'over' ? 'source-over' : (layer.blendmode || 'source-over');

        if (repeat === 'none') {
            // Each style paints the whole text block, stacked in order
            styles.forEach(function(style) {
                drawFillStyleOnBlock(ctx, text, lines, fontSizePx, s, normalizeFillStyle(style), alpha, blendmode);
            });
        } else {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = blendmode;
            drawFillUnits(ctx, text, lines, fontSizePx, s, repeat, styles.map(normalizeFillStyle));
            ctx.restore();
        }
    }

    // Paint one style across the whole text block. Solid colors paint
    // directly; gradients/patterns with the Flag effect active are painted
    // offscreen spanning the block box and clipped to the text silhouette so
    // they are not rotated by the per-letter transforms.
    function drawFillStyleOnBlock(ctx, text, lines, fontSizePx, s, style, alpha, blendmode) {
        const flagActive = !isFlagNeutral(s) || isActive(s, 'lettering.boggle');
        const box = getTextBlockBox(ctx, s, lines, fontSizePx);

        if (style.type === 'color' || !flagActive) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = blendmode;
            if (style.type === 'color') {
                ctx.fillStyle = getColorValue(style.color, 1);
            } else if (style.type === 'gradient') {
                if (!style.gradient.colors || style.gradient.colors.length < 2) { ctx.restore(); return; }
                ctx.fillStyle = createGradientInBox(ctx, style.gradient, box);
            } else {
                const img = state.textureImages[style.texture.src];
                if (!img) {
                    if (style.texture.src) loadTextureImage(style.texture.src);
                    ctx.restore();
                    return;
                }
                ctx.fillStyle = createPatternForBox(ctx, img, style.texture, box);
            }
            ctx.strokeStyle = 'transparent';
            drawTextLines(ctx, text, lines, fontSizePx, s, false);
            ctx.restore();
            return;
        }

        // Flag active + gradient/texture: mask approach so the style spans
        // the block in global space, unaffected by per-letter transforms.
        if (style.type === 'gradient' && (!style.gradient.colors || style.gradient.colors.length < 2)) return;
        if (style.type === 'texture' && !style.texture.src) return;

        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

        const mask = document.createElement('canvas');
        mask.width = W; mask.height = H;
        const mctx = mask.getContext('2d');
        mctx.setTransform(ctx.getTransform());
        mctx.fillStyle = '#ffffff';
        drawTextLines(mctx, text, lines, fontSizePx, s, false);

        const styled = document.createElement('canvas');
        styled.width = W; styled.height = H;
        const sctx = styled.getContext('2d');
        sctx.setTransform(ctx.getTransform());
        if (style.type === 'gradient') {
            sctx.fillStyle = createGradientInBox(sctx, style.gradient, box);
        } else {
            const img = state.textureImages[style.texture.src];
            if (!img) {
                loadTextureImage(style.texture.src);
                return;
            }
            sctx.fillStyle = createPatternForBox(sctx, img, style.texture, box);
        }
        sctx.fillRect(box.x - 2, box.y - 2, box.width + 4, box.height + 4);

        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.globalCompositeOperation = 'destination-in';
        sctx.drawImage(mask, 0, 0);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = blendmode;
        ctx.drawImage(styled, 0, 0);
        ctx.restore();
    }

    // Pattern stretched so it covers 'box' edge to edge
    // Compute the pattern placement (scale + origin) inside 'box' from the
    // texture options:
    //   fit:   'stretch' (non-proportional fill) | 'fit' (proportional contain)
    //          | 'fill' (proportional cover)
    //   scale: 0.1..1.0 fraction of the box the pattern targets
    //   position: 9-position origin (left top .. right bottom)
    function computePatternPlacement(img, texture, box) {
        const fit = texture.fit || 'fill';
        const scale = texture.scale !== undefined ? texture.scale : 1;
        let sx, sy;
        if (fit === 'stretch') {
            sx = (box.width * scale) / img.width;
            sy = (box.height * scale) / img.height;
        } else if (fit === 'fit') {
            const s = Math.min(box.width * scale / img.width, box.height * scale / img.height);
            sx = s; sy = s;
        } else {
            const s = Math.max(box.width * scale / img.width, box.height * scale / img.height);
            sx = s; sy = s;
        }
        const w = img.width * sx;
        const h = img.height * sy;
        const pos = texture.position || 'center';
        let tx, ty;
        if (pos.indexOf('left') !== -1) tx = box.x;
        else if (pos.indexOf('right') !== -1) tx = box.x + box.width - w;
        else tx = box.x + (box.width - w) / 2;
        if (pos.indexOf('top') !== -1) ty = box.y;
        else if (pos.indexOf('bottom') !== -1) ty = box.y + box.height - h;
        else ty = box.y + (box.height - h) / 2;
        return { sx: sx, sy: sy, tx: tx, ty: ty };
    }

    function createPatternForBox(c, img, texture, box) {
        const pattern = c.createPattern(img, texture.repeat === 'no-repeat' ? 'no-repeat' : 'repeat');
        const p = computePatternPlacement(img, texture, box);
        if (typeof pattern.setTransform === 'function') {
            pattern.setTransform(new DOMMatrix([p.sx, 0, 0, p.sy, p.tx, p.ty]));
        }
        return pattern;
    }

    // Gradient endpoints (global coordinates) for a box and angle
    function gradientEndpointsForBox(box, angleDeg) {
        const angle = angleDeg * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const half = (Math.abs(cos) * box.width + Math.abs(sin) * box.height) / 2;
        return { x1: cx - cos * half, y1: cy - sin * half, x2: cx + cos * half, y2: cy + sin * half };
    }

    // Gradient for a box; when the char is Flag-transformed the endpoints are
    // mapped through the inverse of T(cx,cy)·R(rot) so the gradient stays
    // anchored to the global layout instead of rotating with the letter.
    function gradientForBoxAtChar(ctx, gradient, box, tf) {
        const g = gradientEndpointsForBox(box, gradient.angle || 0);
        let x1 = g.x1, y1 = g.y1, x2 = g.x2, y2 = g.y2;
        if (tf) {
            const cos = Math.cos(tf.rot);
            const sin = Math.sin(tf.rot);
            const map = function(px, py) {
                const dx = px - tf.cx;
                const dy = py - tf.cy;
                return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
            };
            const p1 = map(g.x1, g.y1);
            const p2 = map(g.x2, g.y2);
            x1 = p1.x; y1 = p1.y; x2 = p2.x; y2 = p2.y;
        }
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        addGradientStops(grad, gradient);
        return grad;
    }

    // Pattern fitted to a box; 'tf' is the char Flag transform — the pattern
    // matrix is compensated with its inverse so the pattern stays anchored to
    // the global layout.
    function patternForBoxAtChar(ctx, img, texture, box, tf) {
        const pattern = ctx.createPattern(img, texture.repeat === 'no-repeat' ? 'no-repeat' : 'repeat');
        const p = computePatternPlacement(img, texture, box);
        let m = new DOMMatrix([p.sx, 0, 0, p.sy, p.tx, p.ty]);
        if (tf) {
            const inv = new DOMMatrix().rotate(-tf.rot * 180 / Math.PI).translate(-tf.cx, -tf.cy);
            m = inv.multiply(m);
        }
        if (typeof pattern.setTransform === 'function') pattern.setTransform(m);
        return pattern;
    }

    // letter/word/line units: each unit cycles through the layer styles and
    // is painted edge to edge of its own box.
    function drawFillUnits(ctx, text, lines, fontSizePx, s, repeat, styles) {
        const blockMetrics = getTextBlockMetrics(ctx, lines, fontSizePx, s);
        const spacing = s.letterSpacing * fontSizePx * 0.1;
        const flagActive = !isFlagNeutral(s) || isActive(s, 'lettering.boggle');
        const measure = ctx.measureText('Ag');
        const ascent = measure.actualBoundingBoxAscent || fontSizePx * 0.8;
        const descent = measure.actualBoundingBoxDescent || fontSizePx * 0.2;

        const lineWidths = [];
        let maxLineWidth = 0;
        for (let i = 0; i < lines.length; i++) {
            const lw = measureTextWidth(ctx, lines[i], s.letterSpacing, fontSizePx);
            lineWidths.push(lw);
            if (lw > maxLineWidth) maxLineWidth = lw;
        }

        let unitIndex = 0;
        for (let li = 0; li < lines.length; li++) {
            const line = lines[li];
            const y = blockMetrics.firstBaseline + li * blockMetrics.lineAdvance;
            let lineStartX = -lineWidths[li] / 2;
            if (s.align === 'left') lineStartX = -maxLineWidth / 2;
            else if (s.align === 'right') lineStartX = maxLineWidth / 2 - lineWidths[li];

            const positions = [];
            let px = lineStartX;
            for (let j = 0; j < line.length; j++) {
                const cw = ctx.measureText(line[j]).width;
                positions.push({ x: px, width: cw });
                px += cw + spacing;
            }

            const units = [];
            if (repeat === 'letter') {
                for (let j = 0; j < line.length; j++) units.push([j]);
            } else if (repeat === 'word') {
                let start = 0;
                for (let j = 0; j <= line.length; j++) {
                    if (j === line.length || line[j] === ' ') {
                        if (j > start) {
                            const idxs = [];
                            for (let k = start; k < j; k++) idxs.push(k);
                            units.push(idxs);
                        }
                        start = j + 1;
                    }
                }
            } else {
                const idxs = [];
                for (let j = 0; j < line.length; j++) idxs.push(j);
                if (idxs.length) units.push(idxs);
            }

            for (const charIdxs of units) {
                const style = styles[unitIndex % styles.length];
                unitIndex++;
                if (!style) continue;
                if (line[charIdxs[0]] === ' ') continue;

                const first = positions[charIdxs[0]];
                const last = positions[charIdxs[charIdxs.length - 1]];
                const unitBox = { x: first.x, y: y - ascent, width: last.x + last.width - first.x, height: ascent + descent };

                if (style.type === 'texture' && style.texture.src && !state.textureImages[style.texture.src]) {
                    loadTextureImage(style.texture.src);
                    continue;
                }

                for (const j of charIdxs) {
                    const ch = line[j];
                    if (ch === ' ') continue;
                    const p = positions[j];
                    const tf = getLetterTransform(s, j, fontSizePx, line.length);
                    const charY = y + (tf ? tf.offsetY : 0);
                    const glyphCenter = (ascent - descent) / 2;
                    const pivotY = charY - glyphCenter;
                    const gradTf = tf ? { rot: tf.rot, cx: p.x + p.width / 2, cy: pivotY } : null;
                    const charBox = { x: p.x, y: y - ascent, width: p.width, height: ascent + descent };

                    ctx.save();
                    if (tf) {
                        ctx.translate(p.x + p.width / 2, pivotY);
                        ctx.rotate(tf.rot);
                    }
                    if (style.type === 'color') {
                        ctx.fillStyle = getColorValue(style.color, 1);
                    } else if (style.type === 'gradient') {
                        if (repeat === 'letter') {
                            // Edge to edge of each letter, in its own space
                            const localBox = tf
                                ? { x: -p.width / 2, y: -ascent, width: p.width, height: ascent + descent }
                                : charBox;
                            ctx.fillStyle = gradientForBoxAtChar(ctx, style.gradient, localBox, null);
                        } else {
                            // Edge to edge of the unit, anchored to the layout
                            ctx.fillStyle = gradientForBoxAtChar(ctx, style.gradient, unitBox, gradTf);
                        }
                    } else if (state.textureImages[style.texture.src]) {
                        if (repeat === 'letter') {
                            const localBox = tf
                                ? { x: -p.width / 2, y: -ascent, width: p.width, height: ascent + descent }
                                : charBox;
                            ctx.fillStyle = patternForBoxAtChar(ctx, state.textureImages[style.texture.src], style.texture, localBox, null);
                        } else {
                            ctx.fillStyle = patternForBoxAtChar(ctx, state.textureImages[style.texture.src], style.texture, unitBox, gradTf);
                        }
                    }
                    if (tf) {
                        ctx.fillText(ch, -p.width / 2, glyphCenter);
                    } else {
                        ctx.fillText(ch, p.x, y);
                    }
                    ctx.restore();
                }
            }
        }
    }

        // Draw text outline
    function drawOutline(ctx, text, lines, fontSizePx, s) {
        // Support both legacy structure and new TextStudio structure
        const outlineConfig = s.outline.first || s.outline;
        const width = (outlineConfig.width || 0.1) * fontSizePx;
        const alpha = safeGet(outlineConfig, 'fill.alpha', 1);
        const join = outlineConfig.join || 'round';

        // Check if texture is active
        if (isActive(outlineConfig, 'fill.texture') && safeGet(outlineConfig, 'fill.texture.src')) {
            const textureImg = state.textureImages[outlineConfig.fill.texture.src];
            if (textureImg) {
                ctx.save();
                if (outlineConfig.fill.texture.blendmode) {
                    ctx.globalCompositeOperation = outlineConfig.fill.texture.blendmode;
                }
                const pattern = ctx.createPattern(textureImg, outlineConfig.fill.texture.repeat || 'repeat');
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = pattern;
                ctx.lineWidth = width;
                ctx.lineJoin = join;
                ctx.lineCap = 'round';
                ctx.fillStyle = 'transparent';
                drawTextLines(ctx, text, lines, fontSizePx, s, true);
                ctx.restore();
                return;
            }
        }

        ctx.save();
        if (isActive(outlineConfig, 'fill.gradient')) {
            const gradient = createGradient(ctx, text, lines, fontSizePx, outlineConfig.fill.gradient, s);
            ctx.strokeStyle = gradient;
        } else {
            const color = outlineConfig.fill?.color || outlineConfig.color || '#000000';
            ctx.strokeStyle = getColorValue(color, alpha);
        }

        ctx.lineWidth = width;
        ctx.lineJoin = join;
        ctx.lineCap = 'round';
        ctx.fillStyle = 'transparent';

        const alignment = outlineConfig.position || 'outside';
        drawTextStrokeAligned(ctx, text, lines, fontSizePx, s, width, alignment);
        ctx.restore();
    }

    // Stroke the text honoring a stroke alignment (inside / center / outside).
    // Canvas strokeText always draws a centered stroke, so 'inside' and
    // 'outside' are achieved with an offscreen stroke masked by the glyph
    // shape (destination-in / destination-out).
    function drawTextStrokeAligned(ctx, text, lines, fontSizePx, s, width, alignment) {
        if (alignment !== 'inside' && alignment !== 'outside') {
            // 'center' (legacy behavior): plain centered stroke
            ctx.lineWidth = width;
            drawTextLines(ctx, text, lines, fontSizePx, s, true);
            return;
        }

        // 1. Render the stroke on an offscreen canvas that mirrors the current
        //    transform, using double width for 'outside' (half of it will be
        //    removed by the mask, leaving `width` fully outside the glyphs).
        const off = document.createElement('canvas');
        off.width = ctx.canvas.width;
        off.height = ctx.canvas.height;
        const offCtx = off.getContext('2d');
        offCtx.setTransform(ctx.getTransform());
        offCtx.lineJoin = 'round';
        offCtx.lineCap = 'round';
        offCtx.strokeStyle = ctx.strokeStyle;
        offCtx.lineWidth = alignment === 'outside' ? width * 2 : width;
        drawTextLines(offCtx, text, lines, fontSizePx, s, true);

        // 2. Build a glyph mask (solid filled text) with the same transform.
        const mask = document.createElement('canvas');
        mask.width = off.width;
        mask.height = off.height;
        const maskCtx = mask.getContext('2d');
        maskCtx.setTransform(ctx.getTransform());
        maskCtx.fillStyle = '#ffffff';
        drawTextLines(maskCtx, text, lines, fontSizePx, s, false);

        // 3. Mask the stroke: keep only pixels inside or outside the glyphs.
        //    The transform must be reset first, otherwise the mask is drawn
        //    offset by the text translate (it would land half a canvas away
        //    and 'inside' would erase everything / 'outside' erase nothing).
        offCtx.globalCompositeOperation = alignment === 'outside' ? 'destination-out' : 'destination-in';
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.drawImage(mask, 0, 0);

        // 4. Blit the masked stroke 1:1 onto the target context.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(off, 0, 0);
        ctx.restore();
    }

    // Draw global outline (TextStudio: outline.global)
    // This renders an outline around the entire text block, not per-character
    function drawOutlineGlobal(ctx, text, lines, fontSizePx, s) {
        // Placeholder for global outline implementation
        // This requires rendering the entire text as a single path
        // For now, skip to avoid errors
        console.log('drawOutlineGlobal called - not yet implemented');
    }

    // Draw inner shadow
    function drawInnerShadow(ctx, text, lines, fontSizePx, s) {
        // Support both legacy structure and new TextStudio structure
        const shadowConfig = s.shadow.inner || s.shadowInner;
        const distance = (shadowConfig.distance || 0.03) * fontSizePx;
        const angle = (shadowConfig.angle || -45) * Math.PI / 180;
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;
        const offset = (shadowConfig.offset || 0) * fontSizePx;
        const blur = (shadowConfig.size || 0.2) * fontSizePx * 2;
        const alpha = shadowConfig.alpha || 1;
        const color = shadowConfig.color || '#000000';

        const canvas = state.canvas;
        const offscreen = document.createElement('canvas');
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const offCtx = offscreen.getContext('2d');

        offCtx.font = ctx.font;
        offCtx.translate(offscreen.width / 2, offscreen.height / 2);
        offCtx.fillStyle = getColorValue(color, alpha);
        offCtx.shadowColor = getColorValue(color, alpha);
        offCtx.shadowOffsetX = offsetX + offset;
        offCtx.shadowOffsetY = offsetY + offset;
        offCtx.shadowBlur = blur;

        offCtx.save();
        drawTextLines(offCtx, text, lines, fontSizePx, s);
        offCtx.restore();

        ctx.save();
        const blendmode = shadowConfig.blendmode || 'source-atop';
        ctx.globalCompositeOperation = blendmode;
        ctx.drawImage(offscreen, -canvas.width / 2, -canvas.height / 2);
        ctx.restore();
    }

    // Draw icon
    function drawIcon(ctx, text, lines, fontSizePx, s) {
        if (!state.iconImg) return;

        const icon = state.iconImg;
        const iconSize = fontSizePx * 0.5 * s.icon.size;
        const offsetX = s.icon.offset.x * fontSizePx;
        const offsetY = s.icon.offset.y * fontSizePx;

        const metrics = ctx.measureText(text.replace(/\n/g, ' '));
        const textWidth = metrics.width;
        const textHeight = fontSizePx * 1.3 * lines.length;

        let x, y;
        if (s.icon.position === 'right') {
            x = textWidth / 2 + iconSize / 2 + fontSizePx * 0.15 + offsetX;
        } else if (s.icon.position === 'center') {
            x = offsetX;
        } else {
            x = -textWidth / 2 - iconSize / 2 - fontSizePx * 0.15 + offsetX;
        }
        y = -iconSize * 0.2 + offsetY;

        ctx.save();
        ctx.globalAlpha = s.icon.alpha;
        if (s.icon.blendmode) {
            ctx.globalCompositeOperation = s.icon.blendmode;
        }
        if (s.icon.composite) {
            ctx.globalCompositeOperation = s.icon.composite;
        }
        ctx.drawImage(icon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
        ctx.restore();
    }

    // Draw 3D depth 2
    function drawDepth2(ctx, text, lines, fontSizePx, s) {
        const length = (s.depth2.length || 0.2) * fontSizePx;
        const angle = (s.depth2.angle || 135) * Math.PI / 180;
        const offsetX = Math.cos(angle) * length;
        const offsetY = Math.sin(angle) * length;
        const alpha = safeGet(s, 'depth2.fill.alpha', 1);
        const color = s.depth2.fill?.color || { r: 255, g: 255, b: 255 };

        const steps = Math.max(1, Math.floor(length / 2));
        const stepX = offsetX / steps;
        const stepY = offsetY / steps;

        ctx.save();
        
        // Use gradient if active, otherwise solid color
        if (isActive(s, 'depth2.fill.gradient')) {
            const gradient = createGradient(ctx, text, lines, fontSizePx, s.depth2.fill.gradient, s);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = getColorValue(color, alpha);
        }
        
        ctx.strokeStyle = 'transparent';

        for (let i = steps; i >= 0; i--) {
            ctx.save();
            ctx.translate(stepX * i, stepY * i);
            drawTextLines(ctx, text, lines, fontSizePx, s);
            ctx.restore();
        }

        ctx.restore();
    }

    // Draw outline 2
    function drawOutline2(ctx, text, lines, fontSizePx, s) {
        // Support both legacy structure and new TextStudio structure
        const outlineConfig = s.outline.second || s.outline2;
        const width = (outlineConfig.width || 0.1) * fontSizePx;
        const alpha = safeGet(outlineConfig, 'fill.alpha', 1);
        const join = outlineConfig.join || 'round';

        ctx.save();
        if (isActive(outlineConfig, 'fill.gradient')) {
            const gradient = createGradient(ctx, text, lines, fontSizePx, outlineConfig.fill.gradient, s);
            ctx.strokeStyle = gradient;
        } else {
            const color = outlineConfig.fill?.color || outlineConfig.color || '#000000';
            ctx.strokeStyle = getColorValue(color, alpha);
        }

        ctx.lineWidth = width;
        ctx.lineJoin = join;
        ctx.lineCap = 'round';
        ctx.fillStyle = 'transparent';

        const alignment = outlineConfig.position || 'outside';
        drawTextStrokeAligned(ctx, text, lines, fontSizePx, s, width, alignment);
        ctx.restore();
    }

    // Draw outer shadow 2
    function drawOuterShadow2(ctx, text, lines, fontSizePx, s) {
        // Support both legacy structure and new TextStudio structure
        const shadowConfig = s.shadow.outer2 || s.shadowOuter2;
        const distance = (shadowConfig.distance || 0.1) * fontSizePx;
        const angle = (shadowConfig.angle || 135) * Math.PI / 180;
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;
        const blur = (shadowConfig.size || 0.2) * fontSizePx * 2;
        const alpha = safeGet(shadowConfig, 'fill.alpha', 1);
        const color = shadowConfig.fill?.color || shadowConfig.color || '#000000';

        ctx.save();
        ctx.shadowColor = getColorValue(color, alpha);
        ctx.shadowOffsetX = offsetX;
        ctx.shadowOffsetY = offsetY;
        ctx.shadowBlur = blur;

        ctx.fillStyle = 'transparent';
        drawTextLines(ctx, text, lines, fontSizePx, s);

        ctx.restore();
    }

    // Draw inner shadow 2
    function drawInnerShadow2(ctx, text, lines, fontSizePx, s) {
        // Support both legacy structure and new TextStudio structure
        const shadowConfig = s.shadow.inner2 || s.shadowInner2;
        const distance = (shadowConfig.distance || 0.03) * fontSizePx;
        const angle = (shadowConfig.angle || 135) * Math.PI / 180;
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;
        const offset = (shadowConfig.offset || 0) * fontSizePx;
        const blur = (shadowConfig.size || 0.2) * fontSizePx * 2;
        const alpha = shadowConfig.alpha || 1;
        const color = shadowConfig.color || '#000000';

        const canvas = state.canvas;
        const offscreen = document.createElement('canvas');
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const offCtx = offscreen.getContext('2d');

        offCtx.font = ctx.font;
        offCtx.translate(offscreen.width / 2, offscreen.height / 2);
        offCtx.fillStyle = getColorValue(color, alpha);
        offCtx.shadowColor = getColorValue(color, alpha);
        offCtx.shadowOffsetX = offsetX + offset;
        offCtx.shadowOffsetY = offsetY + offset;
        offCtx.shadowBlur = blur;

        offCtx.save();
        drawTextLines(offCtx, text, lines, fontSizePx, s);
        offCtx.restore();

        ctx.save();
        const blendmode = shadowConfig.blendmode || 'source-atop';
        ctx.globalCompositeOperation = blendmode;
        ctx.drawImage(offscreen, -canvas.width / 2, -canvas.height / 2);
        ctx.restore();
    }

    // Draw bevel effect (modern TextStudio structure: bevel.inner)
    function drawBevel(ctx, text, lines, fontSizePx, s, config) {
        // Use explicit config (for bevel.inner2) or default to bevel.inner / legacy bevel
        const bevelConfig = config || safeGet(s, 'bevel.inner', null) || safeGet(s, 'bevel', {});
        const size = (bevelConfig.size || 0.1) * fontSizePx;
        const angle = bevelConfig.angle || 135;
        const soften = bevelConfig.soften || 0.1;

        const highlightCfg = bevelConfig.highlight || { color: '#ffffff', alpha: 1 };
        const shadowCfg = bevelConfig.shadow || { color: '#000000', alpha: 1 };

        const highlightColor = getColorValue(highlightCfg.color, highlightCfg.alpha);
        const shadowColor = getColorValue(shadowCfg.color, shadowCfg.alpha);
        const highlightHex = colorToHex(highlightCfg.color);
        const shadowHex = colorToHex(shadowCfg.color);

        // Try WebGL bevel if available
        if (typeof BevelWebGLEngine !== 'undefined' && !state.bevelEngine) {
            state.bevelEngine = new BevelWebGLEngine();
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.canvas.width;
            tempCanvas.height = state.canvas.height;
            if (!state.bevelEngine.init(tempCanvas)) {
                state.bevelEngine = null;
            }
        }

        if (state.bevelEngine && size > 0) {
            // Create temporary canvas with just the text
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.canvas.width;
            tempCanvas.height = state.canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.save();
            tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
            tempCtx.font = ctx.font;
            tempCtx.fillStyle = '#ffffff';
            tempCtx.strokeStyle = '#ffffff';
            tempCtx.lineWidth = size;
            tempCtx.lineCap = 'round';
            tempCtx.lineJoin = 'round';
            drawTextLines(tempCtx, text, lines, fontSizePx, s, true);
            tempCtx.restore();

            // Apply WebGL bevel (colors converted to normalized floats)
            const hexToFloat = function(hex) {
                hex = hex.replace('#', '');
                if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
                return [
                    parseInt(hex.substring(0, 2), 16) / 255,
                    parseInt(hex.substring(2, 4), 16) / 255,
                    parseInt(hex.substring(4, 6), 16) / 255
                ];
            };

            const bevelCanvas = state.bevelEngine.apply(tempCanvas, {
                bevelSize: size / fontSizePx,
                bevelAngle: angle,
                lightColor: hexToFloat(highlightHex),
                shadowColor: hexToFloat(shadowHex),
                highlightIntensity: highlightCfg.alpha,
                shadowIntensity: shadowCfg.alpha,
                softness: soften
            });

            if (bevelCanvas) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(bevelCanvas, 0, 0);
                ctx.restore();
                return;
            }
        }

        // Fallback: Simple bevel simulation using offset strokes
        if (!size) return;
        const angleRad = (angle * Math.PI) / 180;
        const highlightOffset = size * 0.5;
        const shadowOffset = size * 0.5;

        const highlightX = Math.cos(angleRad) * highlightOffset;
        const highlightY = Math.sin(angleRad) * highlightOffset;
        const shadowX = -Math.cos(angleRad) * shadowOffset;
        const shadowY = -Math.sin(angleRad) * shadowOffset;

        // Draw highlight
        ctx.save();
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = size * 0.3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.translate(highlightX, highlightY);
        drawTextLines(ctx, text, lines, fontSizePx, s, true);
        ctx.restore();

        // Draw shadow
        ctx.save();
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = size * 0.3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.translate(shadowX, shadowY);
        drawTextLines(ctx, text, lines, fontSizePx, s, true);
        ctx.restore();
    }

    // Draw specular lighting effect
    function drawSpecular(ctx, text, lines, fontSizePx, s) {
        // Try WebGL specular if available
        if (typeof SpecularWebGLEngine !== 'undefined' && !state.specularEngine) {
            state.specularEngine = new SpecularWebGLEngine();
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.canvas.width;
            tempCanvas.height = state.canvas.height;
            if (!state.specularEngine.init(tempCanvas)) {
                state.specularEngine = null;
            }
        }

        if (state.specularEngine) {
            // Create temporary canvas with current state
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.canvas.width;
            tempCanvas.height = state.canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(state.canvas, 0, 0);

            // Apply WebGL specular
            const specularCanvas = state.specularEngine.apply(tempCanvas, {
                surfaceScale: 1.0,
                specularConstant: 0.5,
                specularExponent: 32.0,
                lightColor: [1.0, 1.0, 1.0],
                lightDirection: [0.5, 0.5, 1.0],
                ambientIntensity: 0.3,
                diffuseIntensity: 0.5
            });

            if (specularCanvas) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(specularCanvas, 0, 0);
                ctx.restore();
            }
        }
    }

    function setTextFont(ctx, s, fontSizePx) {
        const fontName = window.FontLoader ? FontLoader.getFontName(s.font.src || s.font) : (s.font.src || s.font);
        const fontWeight = s.font.weight || 'normal';
        ctx.font = `${fontWeight} ${fontSizePx}px ${fontName}`;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
    }

    // Return baseline positions that center the real glyph box at the origin.
    function getTextBlockMetrics(ctx, lines, fontSizePx, s) {
        setTextFont(ctx, s, fontSizePx);
        const measure = ctx.measureText('Ag');
        const ascent = measure.actualBoundingBoxAscent || fontSizePx * 0.8;
        const descent = measure.actualBoundingBoxDescent || fontSizePx * 0.2;
        const lineAdvance = fontSizePx * (s.lineHeight !== undefined ? s.lineHeight : 1);
        const totalHeight = ascent + descent + (lines.length - 1) * lineAdvance;

        return {
            lineAdvance: lineAdvance,
            firstBaseline: -totalHeight / 2 + ascent
        };
    }

    // Draw text lines helper
    function drawTextLines(ctx, text, lines, fontSizePx, s, isStroke) {
        const blockMetrics = getTextBlockMetrics(ctx, lines, fontSizePx, s);
        const letterSpacing = s.letterSpacing * fontSizePx * 0.1;

        // Calculate widths for alignment (TextStudio style: align lines relative to each other)
        const lineWidths = [];
        let maxLineWidth = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineWidth = measureTextWidth(ctx, lines[i], s.letterSpacing, fontSizePx);
            lineWidths.push(lineWidth);
            if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Calcular posición Y para cada línea
            const y = blockMetrics.firstBaseline + i * blockMetrics.lineAdvance;
            
            // Calculate X offset based on alignment (TextStudio style)
            let xOffset = 0;
            if (s.align === 'left') {
                xOffset = -maxLineWidth / 2; // Left align: borde izquierdo del contenedor más ancho
            } else if (s.align === 'right') {
                xOffset = maxLineWidth / 2; // Right align: borde derecho del contenedor más ancho
            }
            // Center is the default: drawTextWithSpacing offsets the line itself.
            // Curving is a post-composition bitmap operation (see render()).
            drawTextWithSpacing(ctx, line, xOffset, y, letterSpacing, isStroke, s, fontSizePx);
        }
    }

    // ===== Flag (bandera) — wave model =====
    // Every letter i of a line of n characters samples the same wave w in
    // [-1, 1].  Tilt (degrees) rotates each letter and Rise (% of font size)
    // shifts it vertically — both scale w, so tilt and rise always move
    // together like a waving banner.
    //
    //   waveWidth: % of the text that one swing (up -> down) takes.
    //     100% -> the whole line is a single sweep from +tilt to -tilt
    //     1%   -> neighbouring letters alternate (+10, -10, +10, ...)
    //   waveShift: % of the wave width the pattern slides along the text
    //     (50% puts the valley in the middle of the line).
    //   shape: 'smooth' (cosine) or 'linear' (straight ramp; 6 letters at
    //     100% width sample +1, .6, .2, -.2, -.6, -1 -> 5, 3, 1, -1, -3, -5
    //     with a 5 degree tilt).
    //
    // The wave resolves per line, so multi-line texts wave line by line.
    // Pure function (no settings access) and exposed on window.TextEditor
    // for unit tests, like DistortEngine.getArcGeometry.
    function flagWaveAt(charIndex, lineLength, waveWidth, waveShift, shape) {
        const n = Math.max(1, lineLength || 1);
        const width = clampValue(Number(waveWidth), 1, 100, 100);
        const shift = clampValue(Number(waveShift), 0, 100, 0);
        const half = Math.max(1, (width / 100) * (n - 1));
        const x = (charIndex + (shift / 100) * half) / half;
        if (shape === 'linear') {
            const m = x % 2;
            return m <= 1 ? 1 - 2 * m : 2 * m - 3;
        }
        return Math.cos(Math.PI * x);
    }

    // Per-letter rotation source for Tilt mode "follow wave": the wave slope —
    // how much and toward which direction the height changes from this letter
    // to the next. Letters lean into the movement (downhill when descending,
    // uphill when rising) and stay nearly vertical at the crest/trough, where
    // the wave flattens. At minimum wave width the travel between adjacent
    // letters is maximal and alternates even/odd, so letters keep the classic
    // alternating flag zigzag tilt.
    //
    // Raw slopes are normalized by the steepest letter of the line, so the
    // Tilt slider always means "maximum real degrees" regardless of wave
    // width. The wave is sampled one step past the last letter (the wave
    // continues beyond the text) to keep the even/odd alternation unbroken.
    // Pure function, exposed on window.TextEditor for unit tests.
    function flagWaveSlopes(lineLength, waveWidth, waveShift, shape) {
        const n = Math.max(1, lineLength || 1);
        const raw = [];
        for (let i = 0; i < n; i++) {
            raw.push((flagWaveAt(i, n, waveWidth, waveShift, shape) -
                      flagWaveAt(i + 1, n, waveWidth, waveShift, shape)) / 2);
        }
        let maxAbs = 0;
        for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(raw[i]));
        if (maxAbs < 1e-9) {
            for (let i = 0; i < n; i++) raw[i] = 0;
        } else {
            for (let i = 0; i < n; i++) raw[i] = raw[i] / maxAbs;
        }
        return raw;
    }

    // Flag is "neutral" when Tilt and Rise are both 0: every transform it
    // could produce is the identity, so the text renders exactly as if the
    // effect were off. Used to bypass per-letter transforms and the
    // gradient/texture mask path when the effect is enabled but untouched.
    function isFlagNeutral(s) {
        if (!isActive(s, 'lettering.flag')) return true;
        const tilt = clampValue(safeGet(s, 'lettering.flag.tilt', 0), -360, 360, 0);
        const rise = clampValue(safeGet(s, 'lettering.flag.rise', 0), -100, 100, 0);
        return tilt === 0 && rise === 0;
    }

    // Applies Tilt/Rise on top of the shared wave for a single letter.
    // tiltMode 'wave' rotates each letter by the wave slope (natural flag);
    // 'position' rotates by the wave value (progressive arc/cascade look).
    function getFlagTransform(s, charIndex, fontSizePx, lineLength) {
        if (isFlagNeutral(s)) return null;
        const tilt = clampValue(safeGet(s, 'lettering.flag.tilt', 0), -360, 360, 0);
        const rise = clampValue(safeGet(s, 'lettering.flag.rise', 0), -100, 100, 0);
        const tiltMode = safeGet(s, 'lettering.flag.tiltMode', 'wave') === 'position' ? 'position' : 'wave';
        const w = flagWaveAt(
            charIndex,
            lineLength,
            safeGet(s, 'lettering.flag.waveWidth', 100),
            safeGet(s, 'lettering.flag.waveShift', 0),
            safeGet(s, 'lettering.flag.shape', 'smooth')
        );
        let rotationSource = w;
        if (tiltMode === 'wave') {
            const slopes = flagWaveSlopes(
                lineLength,
                safeGet(s, 'lettering.flag.waveWidth', 100),
                safeGet(s, 'lettering.flag.waveShift', 0),
                safeGet(s, 'lettering.flag.shape', 'smooth')
            );
            rotationSource = slopes[Math.min(charIndex, slopes.length - 1)] || 0;
        }
        return {
            rot: tilt * Math.PI / 180 * rotationSource,
            offsetY: (rise / 100) * fontSizePx * w
        };
    }

    // Boggle: random-looking scattered letters. Deterministic per character
    // index so the layout does not flicker between renders.
    // maxRotation: 0..360 (max rotation); scatterHeight: 0..100 (% of font size).
    function hash01(seed) {
        const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    }

    function getBoggleTransform(s, charIndex, fontSizePx) {
        if (!isActive(s, 'lettering.boggle')) return null;
        const angle = clampValue(safeGet(s, 'lettering.boggle.maxRotation', 40), 0, 360, 40);
        const amplitude = clampValue(safeGet(s, 'lettering.boggle.scatterHeight', 50), 0, 100, 50);
        const rot = (hash01(charIndex * 37 + 1) - 0.5) * 2 * (angle * Math.PI / 180);
        const offY = (hash01(charIndex * 37 + 2) - 0.5) * 2 * (amplitude / 100) * fontSizePx;
        return { rot: rot, offsetY: offY };
    }

    // Combined transform (Flag and/or Boggle can be active at once).
    function getLetterTransform(s, charIndex, fontSizePx, lineLength) {
        const flag = getFlagTransform(s, charIndex, fontSizePx, lineLength);
        const boggle = getBoggleTransform(s, charIndex, fontSizePx);
        if (!flag && !boggle) return null;
        return {
            rot: (flag ? flag.rot : 0) + (boggle ? boggle.rot : 0),
            offsetY: (flag ? flag.offsetY : 0) + (boggle ? boggle.offsetY : 0)
        };
    }

    // Draw text with manual letter spacing plus the Flag/Boggle effects.
    // Transforms rotate each glyph around its visual center (not baseline).
    function drawTextWithSpacing(ctx, text, x, y, spacing, isStroke, s, fontSizePx) {
        const align = safeGet(s, 'align', 'center');

        let startX = x;
        const chars = [];
        let totalWidth = 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charWidth = ctx.measureText(char).width;
            chars.push({ char: char, width: charWidth });
            totalWidth += charWidth;
        }
        totalWidth += spacing * (text.length - 1);

        if (align === 'center') {
            startX = x - totalWidth / 2;
        } else if (align === 'left') {
            startX = x;
        } else if (align === 'right') {
            startX = x - totalWidth;
        }

        const measure = ctx.measureText('Ag');
        const ascent = measure.actualBoundingBoxAscent || fontSizePx * 0.8;
        const descent = measure.actualBoundingBoxDescent || fontSizePx * 0.2;
        const glyphCenter = (ascent - descent) / 2;

        let currentX = startX;
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const tf = getLetterTransform(s, i, fontSizePx, chars.length);
            const charY = y + (tf ? tf.offsetY : 0);

            if (tf) {
                ctx.save();
                ctx.translate(currentX + char.width / 2, charY - glyphCenter);
                ctx.rotate(tf.rot);
                if (isStroke) {
                    ctx.strokeText(char.char, -char.width / 2, glyphCenter);
                } else {
                    ctx.fillText(char.char, -char.width / 2, glyphCenter);
                }
                ctx.restore();
            } else {
                if (isStroke) {
                    ctx.strokeText(char.char, currentX, charY);
                } else {
                    ctx.fillText(char.char, currentX, charY);
                }
            }

            currentX += char.width + spacing;
        }
    }

    // format: "#rrggbb alpha pos%, ..." — used to mirror settings into the
    // hidden gradient inputs so the visual pickers can rebuild from them.
    function formatGradientColorsString(gradient) {
        const colors = gradient && gradient.colors;
        if (!Array.isArray(colors)) return '';
        return colors.map(function(stop) {
            let hex;
            if (typeof stop === 'string') {
                hex = stop.replace('#', '');
            } else if (stop && stop.color) {
                hex = String(stop.color).replace('#', '');
            } else if (stop && stop.r !== undefined) {
                hex = [stop.r, stop.g, stop.b].map(function(v) {
                    return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
                }).join('');
            } else {
                return null;
            }
            if (hex.length === 3) hex = hex.split('').map(function(c) { return c + c; }).join('');
            hex = hex.slice(0, 6);
            if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
            const pos = Math.round(Math.max(0, Math.min(1, stop.pos !== undefined ? Number(stop.pos) : 0)) * 100);
            return '#' + hex + 'ff ' + pos + '%';
        }).filter(Boolean).join(', ');
    }

    // Add color stops to a canvas gradient from settings
    function addGradientStops(gradientObj, gradient) {
        let stops;
        
        // Handle different gradient formats
        if (gradient.colors && gradient.colors.length >= 2) {
            stops = gradient.colors;
        } else if (gradient.startColor && gradient.endColor) {
            // Legacy 2-color format
            stops = [
                { color: gradient.startColor, pos: 0 },
                { color: gradient.endColor, pos: 1 }
            ];
        } else if (Array.isArray(gradient)) {
            // Simple array of colors
            stops = gradient.map((color, index) => ({
                color: color,
                pos: index / (gradient.length - 1)
            }));
        } else {
            // Fallback to default
            stops = [
                { color: '#ffffff', pos: 0 },
                { color: '#000000', pos: 1 }
            ];
        }

        // Process stops and add to gradient
        stops.forEach(function(stop, index) {
            let color;
            let pos;
            
            // Determine color
            if (stop.color) {
                color = stop.color;
            } else if (stop.r !== undefined) {
                const a = stop.a !== undefined ? stop.a : 1;
                color = 'rgba(' + Math.round(stop.r) + ',' + Math.round(stop.g) + ',' + Math.round(stop.b) + ',' + a + ')';
            } else if (typeof stop === 'string') {
                color = stop;
            } else {
                color = '#ffffff';
            }

            // Determine position
            if (stop.pos !== undefined) {
                pos = stop.pos;
            } else {
                // Auto-distribute positions if not defined
                pos = index / (stops.length - 1);
            }

            // Convert hex to rgba if needed
            if (typeof color === 'string' && color.startsWith('#')) {
                color = hexToRgba(color, 1);
            }

            // Clamp position to [0, 1]
            pos = Math.max(0, Math.min(1, pos));
            
            gradientObj.addColorStop(pos, color);
        });
    }

    // Compute the real bounding box of the text block, centered like the
    // rendered text (drawTextLines centers every line around the origin).
    // setTextFont() guarantees the block is measured with the real font even
    // when this runs before any draw pass (fill is the first pipeline pass on
    // a fresh export/thumbnail canvas, whose context defaults to 10px
    // sans-serif). Without it, "no repeat" fills were anchored to a tiny
    // wrong box, so stretch/fit/fill never spanned the full text frame.
    function getTextBlockBox(ctx, s, lines, fontSizePx) {
        setTextFont(ctx, s, fontSizePx);
        let width = 0;
        for (let i = 0; i < lines.length; i++) {
            const w = measureTextWidth(ctx, lines[i], s.letterSpacing, fontSizePx);
            if (w > width) width = w;
        }
        const measure = ctx.measureText('Ag');
        const ascent = measure.actualBoundingBoxAscent || fontSizePx * 0.8;
        const descent = measure.actualBoundingBoxDescent || fontSizePx * 0.2;
        // Keep lineHeight default in sync with getTextBlockMetrics()/autoFitText()
        // (1.0) so the block height matches the real line advance on multi-line text.
        const lineHeight = s.lineHeight !== undefined ? s.lineHeight : 1;
        const height = ascent + descent + (lines.length - 1) * fontSizePx * lineHeight;
        return { x: -width / 2, y: -height / 2, width: width, height: height };
    }

    // Create a gradient spanning the box along the angle (degrees), edge to edge.
    function createGradientInBox(ctx, gradient, box) {
        const angle = ((gradient.angle || 0) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const halfLength = (Math.abs(cos) * box.width + Math.abs(sin) * box.height) / 2;
        const gradientObj = ctx.createLinearGradient(
            cx - cos * halfLength, cy - sin * halfLength,
            cx + cos * halfLength, cy + sin * halfLength
        );
        addGradientStops(gradientObj, gradient);
        return gradientObj;
    }

    // Create gradient across the whole text block (real bounds)
    function createGradient(ctx, text, lines, fontSizePx, gradient, s) {
        const box = getTextBlockBox(ctx, s, lines, fontSizePx);
        return createGradientInBox(ctx, gradient, box);
    }

    // Convert hex color to rgba
    function hexToRgba(hex, alpha) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Convert RGB object to rgba string (TextStudio format)
    function rgbToRgba(rgb, alpha = 1) {
        if (!rgb || typeof rgb !== 'object') {
            return `rgba(255, 255, 255, ${alpha})`;
        }
        const r = Math.max(0, Math.min(255, Math.round(rgb.r || 0)));
        const g = Math.max(0, Math.min(255, Math.round(rgb.g || 0)));
        const b = Math.max(0, Math.min(255, Math.round(rgb.b || 0)));
        const a = rgb.a !== undefined ? rgb.a : alpha;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    // Get color from either hex string or RGB object
    function getColorValue(color, alpha = 1) {
        if (typeof color === 'string') {
            return hexToRgba(color, alpha);
        } else if (typeof color === 'object' && color !== null) {
            return rgbToRgba(color, alpha);
        }
        return `rgba(255, 255, 255, ${alpha})`;
    }

    // Set a nested property on an object by dot path (creates intermediate objects)
    function setNested(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]] || typeof current[keys[i]] !== 'object') current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    }

    // Convert a TextStudio color (hex string or {r,g,b[,a]}) to a plain hex string
    function colorToHex(color) {
        if (typeof color === 'string') return color;
        if (color && typeof color === 'object') {
            const r = Math.max(0, Math.min(255, Math.round(color.r || 0)));
            const g = Math.max(0, Math.min(255, Math.round(color.g || 0)));
            const b = Math.max(0, Math.min(255, Math.round(color.b || 0)));
            return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
        }
        return '#ffffff';
    }

    // Update settings
    function updateSettings(newSettings) {
        Object.assign(state.settings, newSettings);
        render();
    }

    // Helper: Convert RGB object to hex with validation
    function rgbToHex(rgb) {
        if (typeof rgb === 'string') return rgb; // already hex — pass through
        if (!rgb || typeof rgb !== 'object') return '#ffffff';
        const r = Math.max(0, Math.min(255, Math.round(rgb.r || 0)));
        const g = Math.max(0, Math.min(255, Math.round(rgb.g || 0)));
        const b = Math.max(0, Math.min(255, Math.round(rgb.b || 0)));
        return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    }

    // Helper: Validate and clamp numeric value
    function clampValue(value, min, max, defaultValue) {
        if (value === undefined || value === null || isNaN(value)) return defaultValue;
        return Math.max(min, Math.min(max, value));
    }

    // Load preset with enhanced TextStudio compatibility
    function loadPreset(preset, targetSettings) {
        // Passing a target is used by the API/export path.  It keeps preset
        // conversion independent from the visible editor and its DOM controls.
        const s = targetSettings || state.settings;

        // Basic text properties with validation
        if (preset.text !== undefined) s.text = String(preset.text || 'TEXT');
        if (preset.font) {
            if (!s.font || typeof s.font === 'string') {
                s.font = { src: preset.font.src || preset.font.name || preset.font, size: 64, weight: 'normal' };
            }
            if (preset.font.src) s.font.src = preset.font.src;
            if (preset.font.name) s.font.src = preset.font.name;
            if (preset.font.size) s.font.size = clampValue(preset.font.size, 12, 140, 64);
            if (preset.font.weight) s.font.weight = preset.font.weight;
        }
        if (preset.align) s.align = preset.align;
        if (preset.rotate !== undefined) s.rotate = clampValue(preset.rotate, -180, 180, 0);
        if (preset.lineHeight !== undefined) s.lineHeight = clampValue(preset.lineHeight, 0, 1.5, 1);
        if (preset.letterSpacing !== undefined) s.letterSpacing = clampValue(preset.letterSpacing, -0.5, 1.5, 0);

        // Fill with enhanced validation
        if (preset.fill) {
            if (preset.fill.active !== undefined) s.fill.active = Boolean(preset.fill.active);
            if (preset.fill.color) s.fill.color = rgbToHex(preset.fill.color);
            if (preset.fill.alpha !== undefined) s.fill.alpha = clampValue(preset.fill.alpha, 0, 1, 1);
            if (preset.fill.gradient) {
                s.fill.gradient.active = Boolean(preset.fill.gradient.active);
                if (preset.fill.gradient.angle !== undefined) s.fill.gradient.angle = clampValue(preset.fill.gradient.angle, 0, 360, 0);
                if (preset.fill.gradient.colors && preset.fill.gradient.colors.length >= 2) {
                    s.fill.gradient.startColor = rgbToHex(preset.fill.gradient.colors[0]);
                    s.fill.gradient.endColor = rgbToHex(preset.fill.gradient.colors[1]);
                }
            }
            if (preset.fill.texture) {
                if (preset.fill.texture.active !== undefined) s.fill.texture.active = Boolean(preset.fill.texture.active);
                if (preset.fill.texture.src) s.fill.texture.src = preset.fill.texture.src;
                if (preset.fill.texture.alpha !== undefined) s.fill.texture.alpha = clampValue(preset.fill.texture.alpha, 0, 1, 1);
                if (preset.fill.texture.size !== undefined) s.fill.texture.size = preset.fill.texture.size;
                if (preset.fill.texture.blendmode) s.fill.texture.blendmode = preset.fill.texture.blendmode;
            }
            if (preset.fill.palette) {
                if (preset.fill.palette.active !== undefined) s.fill.palette.active = Boolean(preset.fill.palette.active);
                if (preset.fill.palette.styles && Array.isArray(preset.fill.palette.styles)) {
                    s.fill.palette.styles = preset.fill.palette.styles;
                }
            }
        }

        // Outline with enhanced validation (modern TextStudio structure)
        if (preset.outline) {
            // Outline #1 (outline.first)
            if (preset.outline.first) {
                if (preset.outline.first.active !== undefined) s.outline.first.active = Boolean(preset.outline.first.active);
                if (preset.outline.first.width !== undefined) s.outline.first.width = clampValue(preset.outline.first.width, 0, 1, 0.1);
                if (preset.outline.first.join) s.outline.first.join = preset.outline.first.join;
                if (preset.outline.first.dash !== undefined) s.outline.first.dash = preset.outline.first.dash;
                if (preset.outline.first.fill) {
                    if (preset.outline.first.fill.color) s.outline.first.fill.color = colorToHex(preset.outline.first.fill.color);
                    if (preset.outline.first.fill.alpha !== undefined) s.outline.first.fill.alpha = clampValue(preset.outline.first.fill.alpha, 0, 1, 1);
                    if (preset.outline.first.fill.gradient) {
                        s.outline.first.fill.gradient.active = Boolean(preset.outline.first.fill.gradient.active);
                        if (preset.outline.first.fill.gradient.angle !== undefined) s.outline.first.fill.gradient.angle = clampValue(preset.outline.first.fill.gradient.angle, 0, 360, 0);
                        if (preset.outline.first.fill.gradient.colors && preset.outline.first.fill.gradient.colors.length >= 2) {
                            s.outline.first.fill.gradient.colors = preset.outline.first.fill.gradient.colors;
                        }
                    }
                    if (preset.outline.first.fill.texture) {
                        if (preset.outline.first.fill.texture.active !== undefined) s.outline.first.fill.texture.active = Boolean(preset.outline.first.fill.texture.active);
                        if (preset.outline.first.fill.texture.src) s.outline.first.fill.texture.src = preset.outline.first.fill.texture.src;
                        if (preset.outline.first.fill.texture.size !== undefined) s.outline.first.fill.texture.size = clampValue(preset.outline.first.fill.texture.size, 0.1, 5, 1);
                        if (preset.outline.first.fill.texture.blendmode) s.outline.first.fill.texture.blendmode = preset.outline.first.fill.texture.blendmode;
                        if (preset.outline.first.fill.texture.repeat) s.outline.first.fill.texture.repeat = preset.outline.first.fill.texture.repeat;
                        if (preset.outline.first.fill.texture.position) s.outline.first.fill.texture.position = preset.outline.first.fill.texture.position;
                        if (preset.outline.first.fill.texture.alpha !== undefined) s.outline.first.fill.texture.alpha = clampValue(preset.outline.first.fill.texture.alpha, 0, 1, 1);
                        if (preset.outline.first.fill.texture.lettering !== undefined) s.outline.first.fill.texture.lettering = Boolean(preset.outline.first.fill.texture.lettering);
                    }
                    if (preset.outline.first.fill.palette) {
                        if (preset.outline.first.fill.palette.active !== undefined) s.outline.first.fill.palette.active = Boolean(preset.outline.first.fill.palette.active);
                        if (preset.outline.first.fill.palette.lettering && preset.outline.first.fill.palette.lettering.method) s.outline.first.fill.palette.lettering.method = preset.outline.first.fill.palette.lettering.method;
                        if (preset.outline.first.fill.palette.styles && Array.isArray(preset.outline.first.fill.palette.styles)) s.outline.first.fill.palette.styles = preset.outline.first.fill.palette.styles;
                    }
                }
                if (preset.outline.first.specular) {
                    s.outline.first.specular = preset.outline.first.specular;
                }
            }

            // Outline #2 (outline.second)
            if (preset.outline.second) {
                if (preset.outline.second.active !== undefined) s.outline.second.active = Boolean(preset.outline.second.active);
                if (preset.outline.second.width !== undefined) s.outline.second.width = clampValue(preset.outline.second.width, 0, 1, 0.1);
                if (preset.outline.second.join) s.outline.second.join = preset.outline.second.join;
                if (preset.outline.second.dash !== undefined) s.outline.second.dash = preset.outline.second.dash;
                if (preset.outline.second.fill) {
                    if (preset.outline.second.fill.color) s.outline.second.fill.color = colorToHex(preset.outline.second.fill.color);
                    if (preset.outline.second.fill.alpha !== undefined) s.outline.second.fill.alpha = clampValue(preset.outline.second.fill.alpha, 0, 1, 1);
                    if (preset.outline.second.fill.gradient) {
                        s.outline.second.fill.gradient.active = Boolean(preset.outline.second.fill.gradient.active);
                        if (preset.outline.second.fill.gradient.angle !== undefined) s.outline.second.fill.gradient.angle = clampValue(preset.outline.second.fill.gradient.angle, 0, 360, 0);
                        if (preset.outline.second.fill.gradient.colors && preset.outline.second.fill.gradient.colors.length >= 2) {
                            s.outline.second.fill.gradient.colors = preset.outline.second.fill.gradient.colors;
                        }
                    }
                    if (preset.outline.second.fill.texture) {
                        if (preset.outline.second.fill.texture.active !== undefined) s.outline.second.fill.texture.active = Boolean(preset.outline.second.fill.texture.active);
                        if (preset.outline.second.fill.texture.src) s.outline.second.fill.texture.src = preset.outline.second.fill.texture.src;
                        if (preset.outline.second.fill.texture.size !== undefined) s.outline.second.fill.texture.size = clampValue(preset.outline.second.fill.texture.size, 0.1, 5, 1);
                        if (preset.outline.second.fill.texture.blendmode) s.outline.second.fill.texture.blendmode = preset.outline.second.fill.texture.blendmode;
                        if (preset.outline.second.fill.texture.repeat) s.outline.second.fill.texture.repeat = preset.outline.second.fill.texture.repeat;
                        if (preset.outline.second.fill.texture.position) s.outline.second.fill.texture.position = preset.outline.second.fill.texture.position;
                        if (preset.outline.second.fill.texture.alpha !== undefined) s.outline.second.fill.texture.alpha = clampValue(preset.outline.second.fill.texture.alpha, 0, 1, 1);
                        if (preset.outline.second.fill.texture.lettering !== undefined) s.outline.second.fill.texture.lettering = Boolean(preset.outline.second.fill.texture.lettering);
                    }
                    if (preset.outline.second.fill.palette) {
                        if (preset.outline.second.fill.palette.active !== undefined) s.outline.second.fill.palette.active = Boolean(preset.outline.second.fill.palette.active);
                        if (preset.outline.second.fill.palette.lettering && preset.outline.second.fill.palette.lettering.method) s.outline.second.fill.palette.lettering.method = preset.outline.second.fill.palette.lettering.method;
                        if (preset.outline.second.fill.palette.styles && Array.isArray(preset.outline.second.fill.palette.styles)) s.outline.second.fill.palette.styles = preset.outline.second.fill.palette.styles;
                    }
                }
                if (preset.outline.second.specular) {
                    s.outline.second.specular = preset.outline.second.specular;
                }
            }

            // Contour 3D #1 (outline.global)
            if (preset.outline.global) {
                if (preset.outline.global.active !== undefined) s.outline.global.active = Boolean(preset.outline.global.active);
                if (preset.outline.global.width !== undefined) s.outline.global.width = clampValue(preset.outline.global.width, 0, 1, 0.1);
                if (preset.outline.global.join) s.outline.global.join = preset.outline.global.join;
                if (preset.outline.global.mask !== undefined) s.outline.global.mask = Boolean(preset.outline.global.mask);
                if (preset.outline.global.projection !== undefined) s.outline.global.projection = Boolean(preset.outline.global.projection);
                if (preset.outline.global.shadow) {
                    s.outline.global.shadow.active = Boolean(preset.outline.global.shadow.active);
                    if (preset.outline.global.shadow.color) s.outline.global.shadow.color = colorToHex(preset.outline.global.shadow.color);
                    if (preset.outline.global.shadow.size !== undefined) s.outline.global.shadow.size = preset.outline.global.shadow.size;
                }
                if (preset.outline.global.fill) {
                    if (preset.outline.global.fill.color) s.outline.global.fill.color = colorToHex(preset.outline.global.fill.color);
                    if (preset.outline.global.fill.alpha !== undefined) s.outline.global.fill.alpha = clampValue(preset.outline.global.fill.alpha, 0, 1, 1);
                    if (preset.outline.global.fill.gradient) {
                        s.outline.global.fill.gradient.active = Boolean(preset.outline.global.fill.gradient.active);
                        if (preset.outline.global.fill.gradient.angle !== undefined) s.outline.global.fill.gradient.angle = clampValue(preset.outline.global.fill.gradient.angle, 0, 360, 0);
                        if (preset.outline.global.fill.gradient.colors && preset.outline.global.fill.gradient.colors.length >= 2) {
                            s.outline.global.fill.gradient.colors = preset.outline.global.fill.gradient.colors;
                        }
                    }
                    if (preset.outline.global.fill.texture) {
                        if (preset.outline.global.fill.texture.active !== undefined) s.outline.global.fill.texture.active = Boolean(preset.outline.global.fill.texture.active);
                        if (preset.outline.global.fill.texture.src) s.outline.global.fill.texture.src = preset.outline.global.fill.texture.src;
                        if (preset.outline.global.fill.texture.size !== undefined) s.outline.global.fill.texture.size = clampValue(preset.outline.global.fill.texture.size, 0.1, 5, 1);
                        if (preset.outline.global.fill.texture.blendmode) s.outline.global.fill.texture.blendmode = preset.outline.global.fill.texture.blendmode;
                        if (preset.outline.global.fill.texture.repeat) s.outline.global.fill.texture.repeat = preset.outline.global.fill.texture.repeat;
                        if (preset.outline.global.fill.texture.position) s.outline.global.fill.texture.position = preset.outline.global.fill.texture.position;
                        if (preset.outline.global.fill.texture.alpha !== undefined) s.outline.global.fill.texture.alpha = clampValue(preset.outline.global.fill.texture.alpha, 0, 1, 1);
                    }
                }
            }

            // Contour 3D #2 (outline.global2)
            if (preset.outline.global2) {
                if (preset.outline.global2.active !== undefined) s.outline.global2.active = Boolean(preset.outline.global2.active);
                if (preset.outline.global2.width !== undefined) s.outline.global2.width = clampValue(preset.outline.global2.width, 0, 1, 0.1);
                if (preset.outline.global2.join) s.outline.global2.join = preset.outline.global2.join;
                if (preset.outline.global2.mask !== undefined) s.outline.global2.mask = Boolean(preset.outline.global2.mask);
                if (preset.outline.global2.projection !== undefined) s.outline.global2.projection = Boolean(preset.outline.global2.projection);
                if (preset.outline.global2.shadow) {
                    s.outline.global2.shadow.active = Boolean(preset.outline.global2.shadow.active);
                    if (preset.outline.global2.shadow.color) s.outline.global2.shadow.color = colorToHex(preset.outline.global2.shadow.color);
                    if (preset.outline.global2.shadow.size !== undefined) s.outline.global2.shadow.size = preset.outline.global2.shadow.size;
                }
                if (preset.outline.global2.fill) {
                    if (preset.outline.global2.fill.color) s.outline.global2.fill.color = colorToHex(preset.outline.global2.fill.color);
                    if (preset.outline.global2.fill.alpha !== undefined) s.outline.global2.fill.alpha = clampValue(preset.outline.global2.fill.alpha, 0, 1, 1);
                    if (preset.outline.global2.fill.gradient) {
                        s.outline.global2.fill.gradient.active = Boolean(preset.outline.global2.fill.gradient.active);
                        if (preset.outline.global2.fill.gradient.angle !== undefined) s.outline.global2.fill.gradient.angle = clampValue(preset.outline.global2.fill.gradient.angle, 0, 360, 0);
                        if (preset.outline.global2.fill.gradient.colors && preset.outline.global2.fill.gradient.colors.length >= 2) {
                            s.outline.global2.fill.gradient.colors = preset.outline.global2.fill.gradient.colors;
                        }
                    }
                    if (preset.outline.global2.fill.texture) {
                        if (preset.outline.global2.fill.texture.active !== undefined) s.outline.global2.fill.texture.active = Boolean(preset.outline.global2.fill.texture.active);
                        if (preset.outline.global2.fill.texture.src) s.outline.global2.fill.texture.src = preset.outline.global2.fill.texture.src;
                        if (preset.outline.global2.fill.texture.size !== undefined) s.outline.global2.fill.texture.size = clampValue(preset.outline.global2.fill.texture.size, 0.1, 5, 1);
                        if (preset.outline.global2.fill.texture.blendmode) s.outline.global2.fill.texture.blendmode = preset.outline.global2.fill.texture.blendmode;
                        if (preset.outline.global2.fill.texture.repeat) s.outline.global2.fill.texture.repeat = preset.outline.global2.fill.texture.repeat;
                        if (preset.outline.global2.fill.texture.position) s.outline.global2.fill.texture.position = preset.outline.global2.fill.texture.position;
                        if (preset.outline.global2.fill.texture.alpha !== undefined) s.outline.global2.fill.texture.alpha = clampValue(preset.outline.global2.fill.texture.alpha, 0, 1, 1);
                    }
                }
            }
        }

        // Shadow Inner #1 (shadow.inner)
        if (preset.shadow && preset.shadow.inner) {
            if (preset.shadow.inner.active !== undefined) s.shadow.inner.active = Boolean(preset.shadow.inner.active);
            if (preset.shadow.inner.size !== undefined) s.shadow.inner.size = clampValue(preset.shadow.inner.size, 0, 1, 0.2);
            if (preset.shadow.inner.strength !== undefined) s.shadow.inner.strength = clampValue(preset.shadow.inner.strength, 0, 1, 0);
            if (preset.shadow.inner.distance !== undefined) s.shadow.inner.distance = clampValue(preset.shadow.inner.distance, 0, 1, 0.1);
            if (preset.shadow.inner.angle !== undefined) s.shadow.inner.angle = clampValue(preset.shadow.inner.angle, -180, 180, -45);
            if (preset.shadow.inner.offset !== undefined) s.shadow.inner.offset = clampValue(preset.shadow.inner.offset, 0, 1, 0);
            if (preset.shadow.inner.color) s.shadow.inner.color = colorToHex(preset.shadow.inner.color);
            if (preset.shadow.inner.alpha !== undefined) s.shadow.inner.alpha = clampValue(preset.shadow.inner.alpha, 0, 1, 1);
            if (preset.shadow.inner.blendmode) s.shadow.inner.blendmode = preset.shadow.inner.blendmode;
            if (preset.shadow.inner.erosion) s.shadow.inner.erosion = preset.shadow.inner.erosion;
        }

        // Shadow Inner #2 (shadow.inner2)
        if (preset.shadow && preset.shadow.inner2) {
            if (preset.shadow.inner2.active !== undefined) s.shadow.inner2.active = Boolean(preset.shadow.inner2.active);
            if (preset.shadow.inner2.size !== undefined) s.shadow.inner2.size = clampValue(preset.shadow.inner2.size, 0, 1, 0.2);
            if (preset.shadow.inner2.strength !== undefined) s.shadow.inner2.strength = clampValue(preset.shadow.inner2.strength, 0, 1, 0);
            if (preset.shadow.inner2.distance !== undefined) s.shadow.inner2.distance = clampValue(preset.shadow.inner2.distance, 0, 1, 0.1);
            if (preset.shadow.inner2.angle !== undefined) s.shadow.inner2.angle = clampValue(preset.shadow.inner2.angle, -180, 180, 135);
            if (preset.shadow.inner2.offset !== undefined) s.shadow.inner2.offset = clampValue(preset.shadow.inner2.offset, 0, 1, 0);
            if (preset.shadow.inner2.color) s.shadow.inner2.color = colorToHex(preset.shadow.inner2.color);
            if (preset.shadow.inner2.alpha !== undefined) s.shadow.inner2.alpha = clampValue(preset.shadow.inner2.alpha, 0, 1, 1);
            if (preset.shadow.inner2.blendmode) s.shadow.inner2.blendmode = preset.shadow.inner2.blendmode;
            if (preset.shadow.inner2.erosion) s.shadow.inner2.erosion = preset.shadow.inner2.erosion;
        }

        // Shadow Outer #1 (shadow.outer)
        if (preset.shadow && preset.shadow.outer) {
            if (preset.shadow.outer.active !== undefined) s.shadow.outer.active = Boolean(preset.shadow.outer.active);
            if (preset.shadow.outer.size !== undefined) s.shadow.outer.size = clampValue(preset.shadow.outer.size, 0, 1, 0.2);
            if (preset.shadow.outer.strength !== undefined) s.shadow.outer.strength = clampValue(preset.shadow.outer.strength, 0, 1, 0);
            if (preset.shadow.outer.distance !== undefined) s.shadow.outer.distance = clampValue(preset.shadow.outer.distance, 0, 1, 0.1);
            if (preset.shadow.outer.angle !== undefined) s.shadow.outer.angle = clampValue(preset.shadow.outer.angle, -180, 180, 135);
            if (preset.shadow.outer.mask !== undefined) s.shadow.outer.mask = Boolean(preset.shadow.outer.mask);
            if (preset.shadow.outer.fill) {
                if (preset.shadow.outer.fill.color) s.shadow.outer.fill.color = colorToHex(preset.shadow.outer.fill.color);
                if (preset.shadow.outer.fill.alpha !== undefined) s.shadow.outer.fill.alpha = clampValue(preset.shadow.outer.fill.alpha, 0, 1, 1);
                if (preset.shadow.outer.fill.gradient) {
                    s.shadow.outer.fill.gradient.active = Boolean(preset.shadow.outer.fill.gradient.active);
                    if (preset.shadow.outer.fill.gradient.angle !== undefined) s.shadow.outer.fill.gradient.angle = clampValue(preset.shadow.outer.fill.gradient.angle, 0, 360, 0);
                    if (preset.shadow.outer.fill.gradient.colors && preset.shadow.outer.fill.gradient.colors.length >= 2) {
                        s.shadow.outer.fill.gradient.colors = preset.shadow.outer.fill.gradient.colors;
                    }
                }
            }
        }

        // Shadow Outer #2 (shadow.outer2)
        if (preset.shadow && preset.shadow.outer2) {
            if (preset.shadow.outer2.active !== undefined) s.shadow.outer2.active = Boolean(preset.shadow.outer2.active);
            if (preset.shadow.outer2.size !== undefined) s.shadow.outer2.size = clampValue(preset.shadow.outer2.size, 0, 1, 0.2);
            if (preset.shadow.outer2.strength !== undefined) s.shadow.outer2.strength = clampValue(preset.shadow.outer2.strength, 0, 1, 0);
            if (preset.shadow.outer2.distance !== undefined) s.shadow.outer2.distance = clampValue(preset.shadow.outer2.distance, 0, 1, 0.1);
            if (preset.shadow.outer2.angle !== undefined) s.shadow.outer2.angle = clampValue(preset.shadow.outer2.angle, -180, 180, 135);
            if (preset.shadow.outer2.mask !== undefined) s.shadow.outer2.mask = Boolean(preset.shadow.outer2.mask);
            if (preset.shadow.outer2.fill) {
                if (preset.shadow.outer2.fill.color) s.shadow.outer2.fill.color = colorToHex(preset.shadow.outer2.fill.color);
                if (preset.shadow.outer2.fill.alpha !== undefined) s.shadow.outer2.fill.alpha = clampValue(preset.shadow.outer2.fill.alpha, 0, 1, 1);
                if (preset.shadow.outer2.fill.gradient) {
                    s.shadow.outer2.fill.gradient.active = Boolean(preset.shadow.outer2.fill.gradient.active);
                    if (preset.shadow.outer2.fill.gradient.angle !== undefined) s.shadow.outer2.fill.gradient.angle = clampValue(preset.shadow.outer2.fill.gradient.angle, 0, 360, 0);
                    if (preset.shadow.outer2.fill.gradient.colors && preset.shadow.outer2.fill.gradient.colors.length >= 2) {
                        s.shadow.outer2.fill.gradient.colors = preset.shadow.outer2.fill.gradient.colors;
                    }
                }
            }
        }

        // Depth with enhanced validation
        if (preset.depth) {
            if (preset.depth.active !== undefined) s.depth.active = Boolean(preset.depth.active);
            if (preset.depth.length !== undefined) s.depth.length = clampValue(preset.depth.length, 0, 1, 0.2);
            if (preset.depth.angle !== undefined) s.depth.angle = clampValue(preset.depth.angle, 0, 360, 135);
            if (preset.depth.fill && preset.depth.fill.color) s.depth.fill.color = rgbToHex(preset.depth.fill.color);
            if (preset.depth.fill && preset.depth.fill.alpha !== undefined) s.depth.fill.alpha = clampValue(preset.depth.fill.alpha, 0, 1, 1);
            if (preset.depth.fill && preset.depth.fill.gradient) {
                s.depth.fill.gradient.active = Boolean(preset.depth.fill.gradient.active);
                if (preset.depth.fill.gradient.angle !== undefined) s.depth.fill.gradient.angle = clampValue(preset.depth.fill.gradient.angle, 0, 360, 0);
                if (preset.depth.fill.gradient.colors && preset.depth.fill.gradient.colors.length >= 2) {
                    s.depth.fill.gradient.colors = preset.depth.fill.gradient.colors;
                }
            }
            if (preset.depth.fill && preset.depth.fill.texture) {
                if (preset.depth.fill.texture.blendmode) s.depth.fill.texture.blendmode = preset.depth.fill.texture.blendmode;
            }
        } else {
            s.depth.active = false;
        }

        // Depth 2 with enhanced validation
        if (preset.depth2) {
            if (preset.depth2.active !== undefined) s.depth2.active = Boolean(preset.depth2.active);
            if (preset.depth2.length !== undefined) s.depth2.length = clampValue(preset.depth2.length, 0, 1, 0.2);
            if (preset.depth2.angle !== undefined) s.depth2.angle = clampValue(preset.depth2.angle, 0, 360, 135);
            if (preset.depth2.fill && preset.depth2.fill.color) s.depth2.fill.color = rgbToHex(preset.depth2.fill.color);
            if (preset.depth2.fill && preset.depth2.fill.alpha !== undefined) s.depth2.fill.alpha = clampValue(preset.depth2.fill.alpha, 0, 1, 1);
            if (preset.depth2.fill && preset.depth2.fill.gradient) {
                s.depth2.fill.gradient.active = Boolean(preset.depth2.fill.gradient.active);
                if (preset.depth2.fill.gradient.angle !== undefined) s.depth2.fill.gradient.angle = clampValue(preset.depth2.fill.gradient.angle, 0, 360, 0);
                if (preset.depth2.fill.gradient.colors && preset.depth2.fill.gradient.colors.length >= 2) {
                    s.depth2.fill.gradient.colors = preset.depth2.fill.gradient.colors;
                }
            }
        } else {
            s.depth2.active = false;
        }

        // Bevel Inner #1 (bevel.inner)
        if (preset.bevel && preset.bevel.inner) {
            if (preset.bevel.inner.active !== undefined) s.bevel.inner.active = Boolean(preset.bevel.inner.active);
            if (preset.bevel.inner.size !== undefined) s.bevel.inner.size = clampValue(preset.bevel.inner.size, 0, 1, 0.1);
            if (preset.bevel.inner.smoothing !== undefined) s.bevel.inner.smoothing = clampValue(preset.bevel.inner.smoothing, 0, 1, 0);
            if (preset.bevel.inner.soften !== undefined) s.bevel.inner.soften = clampValue(preset.bevel.inner.soften, 0, 1, 0.1);
            if (preset.bevel.inner.angle !== undefined) s.bevel.inner.angle = clampValue(preset.bevel.inner.angle, 0, 360, 135);
            if (preset.bevel.inner.altitude !== undefined) s.bevel.inner.altitude = clampValue(preset.bevel.inner.altitude, 0, 90, 0);
            if (preset.bevel.inner.highlight) {
                if (preset.bevel.inner.highlight.color) s.bevel.inner.highlight.color = colorToHex(preset.bevel.inner.highlight.color);
                if (preset.bevel.inner.highlight.alpha !== undefined) s.bevel.inner.highlight.alpha = clampValue(preset.bevel.inner.highlight.alpha, 0, 1, 1);
                if (preset.bevel.inner.highlight.blendmode) s.bevel.inner.highlight.blendmode = preset.bevel.inner.highlight.blendmode;
            }
            if (preset.bevel.inner.shadow) {
                if (preset.bevel.inner.shadow.color) s.bevel.inner.shadow.color = colorToHex(preset.bevel.inner.shadow.color);
                if (preset.bevel.inner.shadow.alpha !== undefined) s.bevel.inner.shadow.alpha = clampValue(preset.bevel.inner.shadow.alpha, 0, 1, 1);
                if (preset.bevel.inner.shadow.blendmode) s.bevel.inner.shadow.blendmode = preset.bevel.inner.shadow.blendmode;
            }
        }

        // Bevel Inner #2 (bevel.inner2)
        if (preset.bevel && preset.bevel.inner2) {
            if (preset.bevel.inner2.active !== undefined) s.bevel.inner2.active = Boolean(preset.bevel.inner2.active);
            if (preset.bevel.inner2.size !== undefined) s.bevel.inner2.size = clampValue(preset.bevel.inner2.size, 0, 1, 0.1);
            if (preset.bevel.inner2.smoothing !== undefined) s.bevel.inner2.smoothing = clampValue(preset.bevel.inner2.smoothing, 0, 1, 0);
            if (preset.bevel.inner2.soften !== undefined) s.bevel.inner2.soften = clampValue(preset.bevel.inner2.soften, 0, 1, 0.1);
            if (preset.bevel.inner2.angle !== undefined) s.bevel.inner2.angle = clampValue(preset.bevel.inner2.angle, 0, 360, 135);
            if (preset.bevel.inner2.altitude !== undefined) s.bevel.inner2.altitude = clampValue(preset.bevel.inner2.altitude, 0, 90, 0);
            if (preset.bevel.inner2.highlight) {
                if (preset.bevel.inner2.highlight.color) s.bevel.inner2.highlight.color = colorToHex(preset.bevel.inner2.highlight.color);
                if (preset.bevel.inner2.highlight.alpha !== undefined) s.bevel.inner2.highlight.alpha = clampValue(preset.bevel.inner2.highlight.alpha, 0, 1, 1);
                if (preset.bevel.inner2.highlight.blendmode) s.bevel.inner2.highlight.blendmode = preset.bevel.inner2.highlight.blendmode;
            }
            if (preset.bevel.inner2.shadow) {
                if (preset.bevel.inner2.shadow.color) s.bevel.inner2.shadow.color = colorToHex(preset.bevel.inner2.shadow.color);
                if (preset.bevel.inner2.shadow.alpha !== undefined) s.bevel.inner2.shadow.alpha = clampValue(preset.bevel.inner2.shadow.alpha, 0, 1, 1);
                if (preset.bevel.inner2.shadow.blendmode) s.bevel.inner2.shadow.blendmode = preset.bevel.inner2.shadow.blendmode;
            }
        }

        // Specular Inner (specular.inner)
        if (preset.specular && preset.specular.inner) {
            s.specular.inner = preset.specular.inner;
        }

        // Lettering with enhanced validation
        if (preset.lettering) {
            if (preset.lettering.active !== undefined) s.lettering.active = Boolean(preset.lettering.active);
            if (preset.lettering.blendmode) s.lettering.blendmode = preset.lettering.blendmode;
            if (preset.lettering.flag) {
                // Flag v2 keys (tilt/rise/waveWidth/waveShift/shape). Legacy
                // flag.angle/amplitude map onto tilt/rise with the same values.
                const pf = preset.lettering.flag;
                s.lettering.flag.active = Boolean(pf.active);
                if (pf.tilt !== undefined) s.lettering.flag.tilt = clampValue(Number(pf.tilt), -360, 360, 0);
                else if (pf.angle !== undefined) s.lettering.flag.tilt = clampValue(Number(pf.angle), -360, 360, 0);
                if (pf.rise !== undefined) s.lettering.flag.rise = clampValue(Number(pf.rise), -100, 100, 0);
                else if (pf.amplitude !== undefined) {
                    let flagRise = Number(pf.amplitude) || 0;
                    if (flagRise > -1 && flagRise < 1) flagRise = flagRise * 100; // legacy ratio -> percent
                    s.lettering.flag.rise = clampValue(flagRise, -100, 100, 0);
                }
                if (pf.waveWidth !== undefined) s.lettering.flag.waveWidth = clampValue(Number(pf.waveWidth), 1, 100, 100);
                if (pf.waveShift !== undefined) s.lettering.flag.waveShift = clampValue(Number(pf.waveShift), 0, 100, 0);
                if (pf.shape !== undefined) s.lettering.flag.shape = (pf.shape === 'linear') ? 'linear' : 'smooth';
                if (pf.tiltMode !== undefined) s.lettering.flag.tiltMode = (pf.tiltMode === 'position') ? 'position' : 'wave';
            }
            if (preset.lettering.boggle && !preset.lettering.flag) {
                // Legacy: old "boggle" field actually held the flag effect.
                s.lettering.flag.active = Boolean(preset.lettering.boggle.active);
                if (preset.lettering.boggle.angle !== undefined) s.lettering.flag.tilt = clampValue(Number(preset.lettering.boggle.angle), -360, 360, 0);
                if (preset.lettering.boggle.amplitude !== undefined) {
                    let flagAmp = Number(preset.lettering.boggle.amplitude) || 0;
                    if (flagAmp > -1 && flagAmp < 1) flagAmp = flagAmp * 100; // legacy ratio -> percent
                    s.lettering.flag.rise = clampValue(flagAmp, -100, 100, 0);
                }
            }
            if (preset.lettering.boggle && preset.lettering.flag) {
                // New format: boggle is the random scattered-letter effect.
                // Keys match its UI labels; legacy angle/amplitude are accepted.
                const pb = preset.lettering.boggle;
                s.lettering.boggle.active = Boolean(pb.active);
                if (pb.maxRotation !== undefined) s.lettering.boggle.maxRotation = clampValue(Number(pb.maxRotation), 0, 360, 40);
                else if (pb.angle !== undefined) s.lettering.boggle.maxRotation = clampValue(Number(pb.angle), 0, 360, 40);
                if (pb.scatterHeight !== undefined) s.lettering.boggle.scatterHeight = clampValue(Number(pb.scatterHeight), 0, 100, 50);
                else if (pb.amplitude !== undefined) s.lettering.boggle.scatterHeight = clampValue(Number(pb.amplitude), 0, 100, 50);
            }
            if (preset.lettering.reverseOverlap) {
                s.lettering.reverseOverlap.active = (preset.lettering.reverseOverlap.letters > 0 || preset.lettering.reverseOverlap.lines > 0);
                s.lettering.reverseOverlap.letters = clampValue(preset.lettering.reverseOverlap.letters || 0, 0, 1, 0);
                s.lettering.reverseOverlap.lines = clampValue(preset.lettering.reverseOverlap.lines || 0, 0, 1, 0);
            }
            if (preset.lettering.shadow) {
                s.lettering.shadow.active = Boolean(preset.lettering.shadow.active);
                if (preset.lettering.shadow.size !== undefined) s.lettering.shadow.size = clampValue(preset.lettering.shadow.size, 0, 1, 0.04);
                if (preset.lettering.shadow.distance !== undefined) s.lettering.shadow.distance = clampValue(preset.lettering.shadow.distance, 0, 1, 0.02);
                if (preset.lettering.shadow.angle !== undefined) s.lettering.shadow.angle = clampValue(preset.lettering.shadow.angle, 0, 360, 180);
                if (preset.lettering.shadow.fill && preset.lettering.shadow.fill.color) s.lettering.shadow.fill.color = rgbToHex(preset.lettering.shadow.fill.color);
                if (preset.lettering.shadow.fill && preset.lettering.shadow.fill.alpha !== undefined) s.lettering.shadow.fill.alpha = clampValue(preset.lettering.shadow.fill.alpha, 0, 1, 1);
            }
        }

        // Distort with enhanced validation
        if (preset.distort && preset.distort.arc) {
            if (preset.distort.arc.angle !== undefined) {
                s.distort.active = preset.distort.arc.angle !== 0;
                s.distort.arc.angle = clampValue(preset.distort.arc.angle, -360, 360, 0);
            }
        }

        // Processing (placeholder for custom effects)
        if (preset.processing && preset.processing.code) {
            s.processing.code = preset.processing.code;
            s.processing.active = Boolean(preset.processing.active);
        }

        // Icon with enhanced validation
        if (preset.icon) {
            if (preset.icon.active !== undefined) s.icon.active = Boolean(preset.icon.active);
            if (preset.icon.src) s.icon.src = preset.icon.src;
            if (preset.icon.position) s.icon.position = preset.icon.position;
            if (preset.icon.size !== undefined) s.icon.size = clampValue(preset.icon.size, 0.1, 5, 1);
            if (preset.icon.rotate !== undefined) s.icon.rotate = clampValue(preset.icon.rotate, -180, 180, 0);
            if (preset.icon.alpha !== undefined) s.icon.alpha = clampValue(preset.icon.alpha, 0, 1, 1);
            if (preset.icon.composite) s.icon.composite = preset.icon.composite;
            if (preset.icon.blendmode) s.icon.blendmode = preset.icon.blendmode;
            if (preset.icon.offset) {
                s.icon.offset.x = clampValue(preset.icon.offset.x || 0, -2, 2, 0);
                s.icon.offset.y = clampValue(preset.icon.offset.y || 0, -2, 2, 0);
            }
        }

        // Background with enhanced validation
        if (preset.background) {
            if (preset.background.active !== undefined) s.background.active = Boolean(preset.background.active);
            if (preset.background.composite) s.background.composite = preset.background.composite;
            if (preset.background.fill && preset.background.fill.color) s.background.fill.color = rgbToHex(preset.background.fill.color);
            if (preset.background.fill && preset.background.fill.alpha !== undefined) s.background.fill.alpha = clampValue(preset.background.fill.alpha, 0, 1, 1);
            if (preset.background.fill && preset.background.fill.image) {
                s.background.fill.image.active = Boolean(preset.background.fill.image.active);
                if (preset.background.fill.image.src) s.background.fill.image.src = preset.background.fill.image.src;
                if (preset.background.fill.image.size) s.background.fill.image.size = preset.background.fill.image.size;
                if (preset.background.fill.image.repeat) s.background.fill.image.repeat = preset.background.fill.image.repeat;
                if (preset.background.fill.image.alpha !== undefined) s.background.fill.image.alpha = clampValue(preset.background.fill.image.alpha, 0, 1, 1);
            }
            if (preset.background.fill && preset.background.fill.gradient) {
                s.background.fill.gradient.active = Boolean(preset.background.fill.gradient.active);
                if (preset.background.fill.gradient.angle !== undefined) s.background.fill.gradient.angle = clampValue(preset.background.fill.gradient.angle, 0, 360, 0);
                if (preset.background.fill.gradient.type) s.background.fill.gradient.type = preset.background.fill.gradient.type;
                if (preset.background.fill.gradient.colors && preset.background.fill.gradient.colors.length >= 2) {
                    s.background.fill.gradient.colors = preset.background.fill.gradient.colors;
                }
            }
        }

        // Animation (placeholder for future implementation)
        if (preset.animation) {
            s.animation.active = Boolean(preset.animation.active);
            if (preset.animation.id) s.animation.id = preset.animation.id;
            if (preset.animation.pause !== undefined) s.animation.pause = clampValue(preset.animation.pause, 0, 10000, 1000);
            if (preset.animation.duration !== undefined) s.animation.duration = clampValue(preset.animation.duration, 0, 10000, 1000);
        }

        if (!targetSettings) {
            // Update UI elements
            updateUIFromSettings();

            // Trigger font load and render
            if (window.FontLoader && FontLoader.isCustomFont(s.font.src || s.font)) {
                FontLoader.loadFont(s.font).then(function() {
                    render();
                });
            } else {
                render();
            }
        }
        return s;
    }

    // Update UI elements from settings
    function updateUIFromSettings() {
        const s = state.settings;

        function setInputValue(id, value) {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = Boolean(value);
                else el.value = value !== undefined && value !== null ? value : '';
            }
        }

        // TEXT section
        setInputValue('tt-text-textarea', s.text);
        setInputValue('tt-font-picker-input', s.font.src || s.font);
        setInputValue('tt-font-size-input', s.font.size || 64);
        setInputValue('tt-letter-spacing-input', s.letterSpacing || 0);
        setInputValue('tt-line-height-input', s.lineHeight !== undefined ? s.lineHeight : 1);
        setInputValue('tt-distort-arc-angle-input', s.distort && s.distort.arc ? s.distort.arc.angle : 0);
        setInputValue('tt-rotate-input', s.rotate || 0);
        setInputValue('tt-merge-gradients-input', s.mergeGradients || false);

        // Canvas controls
        if (s.canvas) {
            setInputValue('tt-canvas-zoom-input', s.canvas.zoom !== undefined ? s.canvas.zoom : 100);
            setInputValue('tt-canvas-width-input', s.canvas.width || 240);
            setInputValue('tt-canvas-height-input', s.canvas.height || 600);
            setInputValue('tt-canvas-ratio-input', s.canvas.ratio || 2.5);
            setInputValue('tt-canvas-max-font-size-input', s.canvas.maxFontSize || 100);
            setInputValue('tt-canvas-margin-input', Math.round((s.canvas.padding !== undefined ? s.canvas.padding : 0) * 100));
        }

        if (window.Controls && window.Controls.refreshUndoControls) {
            window.Controls.refreshUndoControls();
        }

        // Font weight
        const fontWeightInput = document.getElementById('tt-font-weight-input');
        const fontOptionsList = document.querySelector('.tt-font-options-list');
        if (fontWeightInput && fontOptionsList) {
            fontWeightInput.value = s.font.weight || 'normal';
            fontOptionsList.querySelectorAll('li').forEach(li => {
                li.classList.remove('selected');
                if ((s.font.weight || 'normal') === 'bold') li.classList.add('selected');
            });
        }

        // Align
        const alignInput = document.getElementById('tt-align-input');
        const alignList = document.querySelector('.tt-align-list');
        if (alignInput && alignList) {
            alignInput.value = s.align || 'center';
            alignList.querySelectorAll('li').forEach(li => {
                li.classList.remove('selected');
                if (li.dataset.id === (s.align || 'center')) li.classList.add('selected');
            });
        }

        // FILL
        setInputValue('tt-fill-active-input', s.fill.active);

        // LETTERING
        setInputValue('tt-lettering-active-input', s.lettering && s.lettering.active);
        setInputValue('tt-lettering-flag-active-input', s.lettering && s.lettering.flag && s.lettering.flag.active);
        setInputValue('tt-lettering-flag-tilt-input', s.lettering && s.lettering.flag && s.lettering.flag.tilt);
        setInputValue('tt-lettering-flag-tilt-mode-input', s.lettering && s.lettering.flag && s.lettering.flag.tiltMode);
        setInputValue('tt-lettering-flag-rise-input', s.lettering && s.lettering.flag && s.lettering.flag.rise);
        setInputValue('tt-lettering-flag-wave-width-input', s.lettering && s.lettering.flag && s.lettering.flag.waveWidth);
        setInputValue('tt-lettering-flag-wave-shift-input', s.lettering && s.lettering.flag && s.lettering.flag.waveShift);
        setInputValue('tt-lettering-flag-shape-input', s.lettering && s.lettering.flag && s.lettering.flag.shape);
        setInputValue('tt-lettering-boggle-active-input', s.lettering && s.lettering.boggle && s.lettering.boggle.active);
        setInputValue('tt-lettering-boggle-max-rotation-input', s.lettering && s.lettering.boggle && s.lettering.boggle.maxRotation);
        setInputValue('tt-lettering-boggle-scatter-height-input', s.lettering && s.lettering.boggle && s.lettering.boggle.scatterHeight);
        setInputValue('tt-lettering-shadow-active-input', s.lettering && s.lettering.shadow && s.lettering.shadow.active);
        setInputValue('tt-lettering-shadow-size-input', s.lettering && s.lettering.shadow && s.lettering.shadow.size);
        setInputValue('tt-lettering-shadow-fill-alpha-input', s.lettering && s.lettering.shadow && s.lettering.shadow.fill && s.lettering.shadow.fill.alpha);
        setInputValue('tt-lettering-shadow-distance-input', s.lettering && s.lettering.shadow && s.lettering.shadow.distance);
        setInputValue('tt-lettering-shadow-angle-input', s.lettering && s.lettering.shadow && s.lettering.shadow.angle);
        setInputValue('tt-lettering-shadow-fill-color-input', s.lettering && s.lettering.shadow && s.lettering.shadow.fill && s.lettering.shadow.fill.color);
        setInputValue('tt-lettering-reverse-overlap-letters-input', s.lettering && s.lettering.reverseOverlap && s.lettering.reverseOverlap.letters);
        setInputValue('tt-lettering-reverse-overlap-lines-input', s.lettering && s.lettering.reverseOverlap && s.lettering.reverseOverlap.lines);
        setInputValue('tt-lettering-blendmode-input', s.lettering && s.lettering.blendmode);

        // DEPTH
        setInputValue('tt-depth-active-input', s.depth.active);
        setInputValue('tt-depth-length-input', s.depth.length);
        setInputValue('tt-depth-angle-input', s.depth.angle);
        setInputValue('tt-depth-fill-color-input', s.depth.fill && s.depth.fill.color);
        setInputValue('tt-depth-fill-gradient-active-input', s.depth.fill && s.depth.fill.gradient && s.depth.fill.gradient.active);
        setInputValue('tt-depth-fill-merge-alpha-input', s.depth.fill && s.depth.fill.mergeAlpha);
        setInputValue('tt-depth-fill-alpha-input', s.depth.fill && s.depth.fill.alpha);
        setInputValue('tt-depth-fill-texture-active-input', s.depth.fill && s.depth.fill.texture && s.depth.fill.texture.active);
        setInputValue('tt-depth-fill-texture-alpha-input', s.depth.fill && s.depth.fill.texture && s.depth.fill.texture.alpha);

        // DEPTH 2
        setInputValue('tt-depth2-active-input', s.depth2.active);
        setInputValue('tt-depth2-length-input', s.depth2.length);
        setInputValue('tt-depth2-angle-input', s.depth2.angle);
        setInputValue('tt-depth2-fill-color-input', s.depth2.fill && s.depth2.fill.color);
        setInputValue('tt-depth2-fill-gradient-active-input', s.depth2.fill && s.depth2.fill.gradient && s.depth2.fill.gradient.active);
        setInputValue('tt-depth2-fill-merge-alpha-input', s.depth2.fill && s.depth2.fill.mergeAlpha);
        setInputValue('tt-depth2-fill-alpha-input', s.depth2.fill && s.depth2.fill.alpha);

        // OUTLINE #1
        setInputValue('tt-outline-first-active-input', s.outline && s.outline.first && s.outline.first.active);
        setInputValue('tt-outline-first-width-input', s.outline && s.outline.first && s.outline.first.width);
        setInputValue('tt-outline-first-position-input', s.outline && s.outline.first && s.outline.first.position || 'outside');
        setInputValue('tt-outline-first-fill-color-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.color);
        setInputValue('tt-outline-first-fill-gradient-active-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.gradient && s.outline.first.fill.gradient.active);
        setInputValue('tt-outline-first-fill-gradient-angle-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.gradient && s.outline.first.fill.gradient.angle);
        setInputValue('tt-outline-first-fill-palette-active-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.palette && s.outline.first.fill.palette.active);
        setInputValue('tt-outline-first-dash-input', s.outline && s.outline.first && s.outline.first.dash);
        setInputValue('tt-outline-first-fill-alpha-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.alpha);
        setInputValue('tt-outline-first-fill-texture-active-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.texture && s.outline.first.fill.texture.active);
        setInputValue('tt-outline-first-fill-texture-alpha-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.texture && s.outline.first.fill.texture.alpha);
        setInputValue('tt-outline-first-fill-texture-lettering-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.texture && s.outline.first.fill.texture.lettering);
        setInputValue('tt-outline-first-specular-active-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.active);
        setInputValue('tt-outline-first-specular-blur-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.blur);
        setInputValue('tt-outline-first-specular-scale-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.scale);
        setInputValue('tt-outline-first-specular-constant-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.constant);
        setInputValue('tt-outline-first-specular-exponent-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.exponent);
        setInputValue('tt-outline-first-specular-azimuth-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.azimuth);
        setInputValue('tt-outline-first-specular-elevation-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.elevation);
        setInputValue('tt-outline-first-specular-color-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.color);
        setInputValue('tt-outline-first-specular-blendmode-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.blendmode);
        setInputValue('tt-outline-first-specular-type-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.type);
        setInputValue('tt-outline-first-specular-point-x-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.point && s.outline.first.specular.point.x);
        setInputValue('tt-outline-first-specular-point-y-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.point && s.outline.first.specular.point.y);
        setInputValue('tt-outline-first-specular-point-z-input', s.outline && s.outline.first && s.outline.first.specular && s.outline.first.specular.point && s.outline.first.specular.point.z);

        // Outline #1 join
        const outlineFirstJoinInput = document.getElementById('tt-outline-first-join-input');
        const outlineFirstJoinList = document.querySelector('[data-input="tt-outline-first-join-input"]');
        if (outlineFirstJoinInput && outlineFirstJoinList) {
            const joinVal = s.outline && s.outline.first && s.outline.first.join || 'round';
            outlineFirstJoinInput.value = joinVal;
            outlineFirstJoinList.querySelectorAll('li').forEach(li => {
                li.classList.remove('selected');
                if (li.dataset.id === joinVal) li.classList.add('selected');
            });
        }

        // OUTLINE #2
        setInputValue('tt-outline-second-active-input', s.outline && s.outline.second && s.outline.second.active);
        setInputValue('tt-outline-second-width-input', s.outline && s.outline.second && s.outline.second.width);
        setInputValue('tt-outline-second-position-input', s.outline && s.outline.second && s.outline.second.position || 'outside');
        setInputValue('tt-outline-second-fill-color-input', s.outline && s.outline.second && s.outline.second.fill && s.outline.second.fill.color);
        setInputValue('tt-outline-second-fill-gradient-active-input', s.outline && s.outline.second && s.outline.second.fill && s.outline.second.fill.gradient && s.outline.second.fill.gradient.active);
        setInputValue('tt-outline-second-dash-input', s.outline && s.outline.second && s.outline.second.dash);
        setInputValue('tt-outline-second-fill-alpha-input', s.outline && s.outline.second && s.outline.second.fill && s.outline.second.fill.alpha);
        setInputValue('tt-outline-second-fill-texture-active-input', s.outline && s.outline.second && s.outline.second.fill && s.outline.second.fill.texture && s.outline.second.fill.texture.active);
        setInputValue('tt-outline-second-specular-active-input', s.outline && s.outline.second && s.outline.second.specular && s.outline.second.specular.active);
        setInputValue('tt-outline-second-specular-blur-input', s.outline && s.outline.second && s.outline.second.specular && s.outline.second.specular.blur);
        setInputValue('tt-outline-second-specular-scale-input', s.outline && s.outline.second && s.outline.second.specular && s.outline.second.specular.scale);
        setInputValue('tt-outline-second-specular-constant-input', s.outline && s.outline.second && s.outline.second.specular && s.outline.second.specular.constant);
        setInputValue('tt-outline-second-specular-exponent-input', s.outline && s.outline.second && s.outline.second.specular && s.outline.second.specular.exponent);
        setInputValue('tt-outline-second-specular-azimuth-input', s.outline && s.outline.second && s.outline.second.specular && s.outline.second.specular.azimuth);
        setInputValue('tt-outline-second-specular-elevation-input', s.outline && s.outline.second && s.outline.second.specular && s.outline.second.specular.elevation);
        setInputValue('tt-outline-second-specular-color-input', s.outline && s.outline.second && s.outline.second.specular && s.outline.second.specular.color);

        // Outline #2 join
        const outlineSecondJoinInput = document.getElementById('tt-outline-second-join-input');
        const outlineSecondJoinList = document.querySelector('[data-input="tt-outline-second-join-input"]');
        if (outlineSecondJoinInput && outlineSecondJoinList) {
            const joinVal2 = s.outline && s.outline.second && s.outline.second.join || 'round';
            outlineSecondJoinInput.value = joinVal2;
            outlineSecondJoinList.querySelectorAll('li').forEach(li => {
                li.classList.remove('selected');
                if (li.dataset.id === joinVal2) li.classList.add('selected');
            });
        }

        // OUTLINE GLOBAL
        setInputValue('tt-outline-global-active-input', s.outline && s.outline.global && s.outline.global.active);
        setInputValue('tt-outline-global-width-input', s.outline && s.outline.global && s.outline.global.width);
        setInputValue('tt-outline-global-fill-color-input', s.outline && s.outline.global && s.outline.global.fill && s.outline.global.fill.color);
        setInputValue('tt-outline-global-fill-gradient-active-input', s.outline && s.outline.global && s.outline.global.fill && s.outline.global.fill.gradient && s.outline.global.fill.gradient.active);
        setInputValue('tt-outline-global-fill-alpha-input', s.outline && s.outline.global && s.outline.global.fill && s.outline.global.fill.alpha);
        setInputValue('tt-outline-global-shadow-active-input', s.outline && s.outline.global && s.outline.global.shadow && s.outline.global.shadow.active);
        setInputValue('tt-outline-global-mask-input', s.outline && s.outline.global && s.outline.global.mask);
        setInputValue('tt-outline-global-projection-input', s.outline && s.outline.global && s.outline.global.projection);

        setInputValue('tt-outline-global2-active-input', s.outline && s.outline.global2 && s.outline.global2.active);
        setInputValue('tt-outline-global2-width-input', s.outline && s.outline.global2 && s.outline.global2.width);
        setInputValue('tt-outline-global2-fill-color-input', s.outline && s.outline.global2 && s.outline.global2.fill && s.outline.global2.fill.color);
        setInputValue('tt-outline-global2-fill-alpha-input', s.outline && s.outline.global2 && s.outline.global2.fill && s.outline.global2.fill.alpha);
        setInputValue('tt-outline-global2-shadow-active-input', s.outline && s.outline.global2 && s.outline.global2.shadow && s.outline.global2.shadow.active);
        setInputValue('tt-outline-global2-mask-input', s.outline && s.outline.global2 && s.outline.global2.mask);

        // BEVEL INNER
        setInputValue('tt-bevel-inner-active-input', s.bevel && s.bevel.inner && s.bevel.inner.active);
        setInputValue('tt-bevel-inner-size-input', s.bevel && s.bevel.inner && s.bevel.inner.size);
        setInputValue('tt-bevel-inner-soften-input', s.bevel && s.bevel.inner && s.bevel.inner.soften);
        setInputValue('tt-bevel-inner-angle-input', s.bevel && s.bevel.inner && s.bevel.inner.angle);
        setInputValue('tt-bevel-inner-altitude-input', s.bevel && s.bevel.inner && s.bevel.inner.altitude);
        setInputValue('tt-bevel-inner-highlight-color-input', s.bevel && s.bevel.inner && s.bevel.inner.highlight && s.bevel.inner.highlight.color);
        setInputValue('tt-bevel-inner-highlight-blendmode-input', s.bevel && s.bevel.inner && s.bevel.inner.highlight && s.bevel.inner.highlight.blendmode);
        setInputValue('tt-bevel-inner-highlight-alpha-input', s.bevel && s.bevel.inner && s.bevel.inner.highlight && s.bevel.inner.highlight.alpha);
        setInputValue('tt-bevel-inner-shadow-color-input', s.bevel && s.bevel.inner && s.bevel.inner.shadow && s.bevel.inner.shadow.color);
        setInputValue('tt-bevel-inner-shadow-blendmode-input', s.bevel && s.bevel.inner && s.bevel.inner.shadow && s.bevel.inner.shadow.blendmode);
        setInputValue('tt-bevel-inner-shadow-alpha-input', s.bevel && s.bevel.inner && s.bevel.inner.shadow && s.bevel.inner.shadow.alpha);

        // SPECULAR INNER
        setInputValue('tt-specular-inner-active-input', s.specular && s.specular.inner && s.specular.inner.active);
        setInputValue('tt-specular-inner-blur-input', s.specular && s.specular.inner && s.specular.inner.blur);
        setInputValue('tt-specular-inner-scale-input', s.specular && s.specular.inner && s.specular.inner.scale);
        setInputValue('tt-specular-inner-constant-input', s.specular && s.specular.inner && s.specular.inner.constant);
        setInputValue('tt-specular-inner-exponent-input', s.specular && s.specular.inner && s.specular.inner.exponent);
        setInputValue('tt-specular-inner-azimuth-input', s.specular && s.specular.inner && s.specular.inner.azimuth);
        setInputValue('tt-specular-inner-elevation-input', s.specular && s.specular.inner && s.specular.inner.elevation);
        setInputValue('tt-specular-inner-color-input', s.specular && s.specular.inner && s.specular.inner.color);

        // INNER SHADOW
        setInputValue('tt-shadow-inner-active-input', s.shadow && s.shadow.inner && s.shadow.inner.active);
        setInputValue('tt-shadow-inner-size-input', s.shadow && s.shadow.inner && s.shadow.inner.size);
        setInputValue('tt-shadow-inner-strength-input', s.shadow && s.shadow.inner && s.shadow.inner.strength);
        setInputValue('tt-shadow-inner-alpha-input', s.shadow && s.shadow.inner && s.shadow.inner.alpha);
        setInputValue('tt-shadow-inner-distance-input', s.shadow && s.shadow.inner && s.shadow.inner.distance);
        setInputValue('tt-shadow-inner-angle-input', s.shadow && s.shadow.inner && s.shadow.inner.angle);
        setInputValue('tt-shadow-inner-offset-input', s.shadow && s.shadow.inner && s.shadow.inner.offset);
        setInputValue('tt-shadow-inner-color-input', s.shadow && s.shadow.inner && s.shadow.inner.color);
        setInputValue('tt-shadow-inner-blendmode-input', s.shadow && s.shadow.inner && s.shadow.inner.blendmode);

        setInputValue('tt-shadow-inner2-active-input', s.shadow && s.shadow.inner2 && s.shadow.inner2.active);
        setInputValue('tt-shadow-inner2-size-input', s.shadow && s.shadow.inner2 && s.shadow.inner2.size);
        setInputValue('tt-shadow-inner2-strength-input', s.shadow && s.shadow.inner2 && s.shadow.inner2.strength);
        setInputValue('tt-shadow-inner2-alpha-input', s.shadow && s.shadow.inner2 && s.shadow.inner2.alpha);
        setInputValue('tt-shadow-inner2-distance-input', s.shadow && s.shadow.inner2 && s.shadow.inner2.distance);
        setInputValue('tt-shadow-inner2-angle-input', s.shadow && s.shadow.inner2 && s.shadow.inner2.angle);
        setInputValue('tt-shadow-inner2-offset-input', s.shadow && s.shadow.inner2 && s.shadow.inner2.offset);
        setInputValue('tt-shadow-inner2-color-input', s.shadow && s.shadow.inner2 && s.shadow.inner2.color);

        // OUTER SHADOW
        setInputValue('tt-shadow-outer-active-input', s.shadow && s.shadow.outer && s.shadow.outer.active);
        setInputValue('tt-shadow-outer-size-input', s.shadow && s.shadow.outer && s.shadow.outer.size);
        setInputValue('tt-shadow-outer-strength-input', s.shadow && s.shadow.outer && s.shadow.outer.strength);
        setInputValue('tt-shadow-outer-fill-alpha-input', s.shadow && s.shadow.outer && s.shadow.outer.fill && s.shadow.outer.fill.alpha);
        setInputValue('tt-shadow-outer-distance-input', s.shadow && s.shadow.outer && s.shadow.outer.distance);
        setInputValue('tt-shadow-outer-angle-input', s.shadow && s.shadow.outer && s.shadow.outer.angle);
        setInputValue('tt-shadow-outer-mask-input', s.shadow && s.shadow.outer && s.shadow.outer.mask);
        setInputValue('tt-shadow-outer-fill-color-input', s.shadow && s.shadow.outer && s.shadow.outer.fill && s.shadow.outer.fill.color);
        setInputValue('tt-shadow-outer-fill-gradient-active-input', s.shadow && s.shadow.outer && s.shadow.outer.fill && s.shadow.outer.fill.gradient && s.shadow.outer.fill.gradient.active);

        setInputValue('tt-shadow-outer2-active-input', s.shadow && s.shadow.outer2 && s.shadow.outer2.active);
        setInputValue('tt-shadow-outer2-size-input', s.shadow && s.shadow.outer2 && s.shadow.outer2.size);
        setInputValue('tt-shadow-outer2-strength-input', s.shadow && s.shadow.outer2 && s.shadow.outer2.strength);
        setInputValue('tt-shadow-outer2-fill-alpha-input', s.shadow && s.shadow.outer2 && s.shadow.outer2.fill && s.shadow.outer2.fill.alpha);
        setInputValue('tt-shadow-outer2-distance-input', s.shadow && s.shadow.outer2 && s.shadow.outer2.distance);
        setInputValue('tt-shadow-outer2-angle-input', s.shadow && s.shadow.outer2 && s.shadow.outer2.angle);
        setInputValue('tt-shadow-outer2-mask-input', s.shadow && s.shadow.outer2 && s.shadow.outer2.mask);
        setInputValue('tt-shadow-outer2-fill-color-input', s.shadow && s.shadow.outer2 && s.shadow.outer2.fill && s.shadow.outer2.fill.color);

        // ICON
        setInputValue('tt-icon-active-input', s.icon && s.icon.active);
        setInputValue('tt-icon-size-input', s.icon && s.icon.size);
        setInputValue('tt-icon-position-input', s.icon && s.icon.position);
        setInputValue('tt-icon-offset-x-input', s.icon && s.icon.offset && s.icon.offset.x);
        setInputValue('tt-icon-offset-y-input', s.icon && s.icon.offset && s.icon.offset.y);
        setInputValue('tt-icon-rotate-input', s.icon && s.icon.rotate);
        setInputValue('tt-icon-alpha-input', s.icon && s.icon.alpha);
        setInputValue('tt-icon-composite-input', s.icon && s.icon.composite);

        // BACKGROUND
        setInputValue('tt-background-active-input', s.background && s.background.active);
        setInputValue('tt-background-fill-color-input', s.background && s.background.fill && s.background.fill.color);
        setInputValue('tt-background-fill-gradient-active-input', s.background && s.background.fill && s.background.fill.gradient && s.background.fill.gradient.active);
        setInputValue('tt-background-fill-gradient-type-input', s.background && s.background.fill && s.background.fill.gradient && s.background.fill.gradient.type);
        setInputValue('tt-background-fill-gradient-angle-input', s.background && s.background.fill && s.background.fill.gradient && s.background.fill.gradient.angle);
        setInputValue('tt-background-fill-alpha-input', s.background && s.background.fill && s.background.fill.alpha);
        setInputValue('tt-background-fill-image-active-input', s.background && s.background.fill && s.background.fill.image && s.background.fill.image.active);
        setInputValue('tt-background-fill-image-repeat-input', s.background && s.background.fill && s.background.fill.image && s.background.fill.image.repeat);
        setInputValue('tt-background-fill-image-alpha-input', s.background && s.background.fill && s.background.fill.image && s.background.fill.image.alpha);
        setInputValue('tt-background-fill-image-size-custom-input', s.background && s.background.fill && s.background.fill.image && s.background.fill.image.size && s.background.fill.image.size.custom);
        setInputValue('tt-background-composite-input', s.background && s.background.composite);

        // Update range slider fills
        document.querySelectorAll('input[type="range"]').forEach(function(range) {
            updateRangeFill(range);
        });

        // Gradient pickers: mirror the settings colors into the hidden inputs
        // (string format) so the pickers rebuild with the loaded colors.
        const gradientColorTargets = [
            ['tt-depth-fill-gradient-colors-input', s.depth && s.depth.fill && s.depth.fill.gradient],
            ['tt-depth2-fill-gradient-colors-input', s.depth2 && s.depth2.fill && s.depth2.fill.gradient],
            ['tt-outline-first-fill-gradient-colors-input', s.outline && s.outline.first && s.outline.first.fill && s.outline.first.fill.gradient],
            ['tt-outline-second-fill-gradient-colors-input', s.outline && s.outline.second && s.outline.second.fill && s.outline.second.fill.gradient],
            ['tt-outline-global-fill-gradient-colors-input', s.outline && s.outline.global && s.outline.global.fill && s.outline.global.fill.gradient],
            ['tt-shadow-outer-fill-gradient-colors-input', s.shadow && s.shadow.outer && s.shadow.outer.fill && s.shadow.outer.fill.gradient],
            ['tt-background-fill-gradient-colors-input', s.background && s.background.fill && s.background.fill.gradient]
        ];
        gradientColorTargets.forEach(function(entry) {
            const el = document.getElementById(entry[0]);
            if (el) el.value = formatGradientColorsString(entry[1]);
        });

        // Notify other modules (e.g. palette styles editor) that the settings
        // were reloaded from a preset or undo/redo operation.
        document.dispatchEvent(new CustomEvent('textmuy:settings-updated'));
    }

    function updateRangeFill(el) {
        var min = parseFloat(el.min) || 0;
        var max = parseFloat(el.max) || 1;
        var val = parseFloat(el.value) || 0;
        var percent = ((val - min) / (max - min)) * 100;
        el.style.background = 'linear-gradient(90deg, #4a90d9 ' + percent + '%, #ddd ' + percent + '%)';
    }

    function getSettings() {
        return state.settings;
    }

    function getCanvas() {
        return state.canvas;
    }

    function getCtx() {
        return state.ctx;
    }

    function createDefaultSettings() {
        return JSON.parse(JSON.stringify(defaultSettings));
    }

    // Render to any canvas without mutating the editor UI.  This is shared by
    // PNG download and the public API, so both outputs have the requested size
    // and a genuinely transparent background.
    function renderToCanvas(canvas, settings, options) {
        const previous = {
            canvas: state.canvas, ctx: state.ctx, settings: state.settings,
            isRendering: state.isRendering,
            transparentOutput: state.transparentOutput
        };
        try {
            state.canvas = canvas;
            state.ctx = canvas.getContext('2d');
            state.settings = settings;
            state.isRendering = false;
            state.transparentOutput = Boolean(options && options.transparent);
            
            // For export, use 100% zoom (1x) — independent of the visual zoom
            // so the exported PNG always has the base resolution.
            const originalZoom = state.settings.canvas.zoom;
            state.settings.canvas.zoom = 100;
            
            render();
            
            // Restore original zoom
            state.settings.canvas.zoom = originalZoom;
        } finally {
            state.canvas = previous.canvas;
            state.ctx = previous.ctx;
            state.settings = previous.settings;
            state.isRendering = previous.isRendering;
            state.transparentOutput = previous.transparentOutput;
        }
        return canvas;
    }

    // Export the module
    window.TextEditor = {
        init: init,
        render: render,
        updateSettings: updateSettings,
        loadPreset: loadPreset,
        createDefaultSettings: createDefaultSettings,
        renderToCanvas: renderToCanvas,
        getSettings: getSettings,
        getCanvas: getCanvas,
        getCtx: getCtx,
        getFillLayers: getFillLayers,
        clearTextureCache: clearTextureCache,
        getTextBlockBox: getTextBlockBox,
        flagWaveAt: flagWaveAt,
        flagWaveSlopes: flagWaveSlopes
    };

})();
