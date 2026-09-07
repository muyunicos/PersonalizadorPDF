/* ===== TEXTSTUDIO CONTROLS - UI Event Handlers ===== */

(function() {
    'use strict';

    let editor = null;
    let currentPresetName = null;

    function init(editorInstance) {
        editor = editorInstance;
        bindControls();
        bindMenuTabs();
        bindCustomMenu();
        bindDownloadControls();
        bindPresets();
        bindImportControls();
        initShowBrotherTabs();
        initTextureUploads();
        initIconGallery();
        initBackgroundGallery();
        initRangeSliders();
        initPresetFilters();
        initFontFilters();
        initActiveFieldsets();
        initUndoRedo();
        initFillLayersUI();
        bindGradientColorInputs();
        initPresetGallery();
        initProjectManager();
    }

    // Helper: set nested setting and trigger render
    function setNestedSetting(path, value) {
        if (!editor) return;
        const settings = editor.getSettings();
        const keys = path.split('.');
        let obj = settings;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        editor.render();
    }

    // Bind canvas size inputs with bidirectional logic
    function bindCanvasSizeInputs() {
        const widthInput = document.getElementById('tt-canvas-width-input');
        const heightInput = document.getElementById('tt-canvas-height-input');
        const ratioInput = document.getElementById('tt-canvas-ratio-input');

        if (!widthInput || !heightInput || !ratioInput) return;

        // Width input change - updates ratio and height
        widthInput.addEventListener('input', function() {
            const width = parseInt(this.value) || 240;
            const height = parseInt(heightInput.value) || 600;
            const ratio = parseFloat((height / width).toFixed(2)) || 2.5;
            ratioInput.value = ratio;
            setNestedSetting('canvas.width', width);
            setNestedSetting('canvas.ratio', ratio);
        });

        // Height input change - updates ratio and width
        heightInput.addEventListener('input', function() {
            const height = parseInt(this.value) || 600;
            const width = parseInt(widthInput.value) || 240;
            const ratio = parseFloat((height / width).toFixed(2)) || 2.5;
            ratioInput.value = ratio;
            setNestedSetting('canvas.height', height);
            setNestedSetting('canvas.ratio', ratio);
        });

        // Ratio input change - updates height
        ratioInput.addEventListener('input', function() {
            const ratio = parseFloat(this.value) || 2.5;
            const width = parseInt(widthInput.value) || 240;
            const height = Math.round(width * ratio);
            heightInput.value = height;
            setNestedSetting('canvas.ratio', ratio);
            setNestedSetting('canvas.height', height);
        });

        // Initialize from settings
        const settings = editor.getSettings();
        if (settings.canvas) {
            if (settings.canvas.width) widthInput.value = settings.canvas.width;
            if (settings.canvas.height) heightInput.value = settings.canvas.height;
            if (settings.canvas.ratio) ratioInput.value = settings.canvas.ratio;
        }
    }

    // Helper: get nested setting
    function getNestedSetting(path) {
        if (!editor) return undefined;
        const settings = editor.getSettings();
        const keys = path.split('.');
        let obj = settings;
        for (const key of keys) {
            if (obj === undefined || obj === null) return undefined;
            obj = obj[key];
        }
        return obj;
    }

    // Bind a range input
    function bindRange(id, settingPath, transformFn) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function() {
            const val = transformFn ? transformFn(this.value) : this.value;
            setNestedSetting(settingPath, val);
        });
    }

    // Bind a checkbox
    function bindCheckbox(id, settingPath) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function() {
            setNestedSetting(settingPath, this.checked);
        });
    }

    // Bind a color input
    function bindColor(id, settingPath) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function() {
            setNestedSetting(settingPath, this.value);
        });
    }

    // Bind a select
    function bindSelect(id, settingPath) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function() {
            setNestedSetting(settingPath, this.value);
        });
    }

    // Fonts can arrive after the select event (notably uploaded fonts). Render
    // once immediately, then again only when the currently selected face is
    // ready.  The request id prevents a slow older selection from winning.
    let fontLoadRequestId = 0;
    function bindFontSelect(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function() {
            const fontKey = this.value;
            const requestId = ++fontLoadRequestId;
            setNestedSetting('font.src', fontKey);

            const settings = editor.getSettings();
            const weight = settings.font && settings.font.weight ? settings.font.weight : 'normal';
            const getName = function() {
                return window.FontLoader ? FontLoader.getFontName(fontKey) : fontKey;
            };
            const needsLoader = window.FontLoader &&
                (FontLoader.isCustomFont(fontKey) || Boolean(FontLoader.registry && FontLoader.registry[fontKey]));
            const load = needsLoader ? FontLoader.loadFont(fontKey) : Promise.resolve(getName());

            Promise.resolve(load)
                .then(function(loadedName) {
                    const name = loadedName || getName();
                    if (!document.fonts || !document.fonts.load) return name;
                    return document.fonts.load(`${weight} 64px "${name}"`).then(function() { return name; });
                })
                .catch(function() {
                    // The initial render already used the browser fallback.
                    return null;
                })
                .then(function() {
                    const current = editor.getSettings().font;
                    if (requestId === fontLoadRequestId && current && current.src === fontKey) {
                        editor.render();
                    }
                });
        });
    }

    // Update range fill (bubble)
    function updateRangeFill(input) {
        const bubble = input.parentElement?.querySelector('output');
        if (bubble && input.dataset.bubble) {
            try {
                const val = eval(input.dataset.bubble.replace(/V/g, input.value));
                bubble.textContent = val;
                const pct = (input.value - input.min) / (input.max - input.min) * 100;
                bubble.style.left = `calc(${pct}% + ${0.5 - pct * 0.01}px)`;
            } catch(e) {}
        }
    }

    // Bind all form controls to editor settings
    function bindControls() {
        // TEXT
        bindCanvasSizeInputs();
        bindRange('tt-canvas-zoom-input', 'canvas.zoom', parseInt);
        bindRange('tt-canvas-max-font-size-input', 'canvas.maxFontSize', parseInt);
        bindRange('tt-canvas-margin-input', 'canvas.padding', function(v) { return parseFloat(v) / 100; });
        bindTextarea('tt-text-textarea', 'text');
        bindAlignList('tt-align-input', 'align');
        bindFontWeight('tt-font-weight-input');
        bindCheckbox('tt-merge-gradients-input', 'mergeGradients');
        bindFontSelect('tt-font-picker-input');
        bindRangeWithRender('tt-font-size-input', 'font.size', parseInt);
        bindRange('tt-letter-spacing-input', 'letterSpacing', parseFloat);
        bindRange('tt-line-height-input', 'lineHeight', parseFloat);
        bindRange('tt-rotate-input', 'rotate', parseFloat);
        bindRange('tt-distort-arc-angle-input', 'distort.arc.angle', parseFloat);

        // Initialize canvas controls from settings
        const settings = editor.getSettings();
        if (settings.canvas) {
            const maxFontSizeInput = document.getElementById('tt-canvas-max-font-size-input');
            if (maxFontSizeInput && settings.canvas.maxFontSize) {
                maxFontSizeInput.value = settings.canvas.maxFontSize;
            }
            const marginInput = document.getElementById('tt-canvas-margin-input');
            if (marginInput && settings.canvas.padding !== undefined) {
                marginInput.value = Math.round(settings.canvas.padding * 100);
            }
        }

        // FILL
        bindCheckbox('tt-fill-active-input', 'fill.active');

        // LETTERING
        bindCheckbox('tt-lettering-active-input', 'lettering.active');
        bindCheckbox('tt-lettering-flag-active-input', 'lettering.flag.active');
        bindRangeWithRender('tt-lettering-flag-tilt-input', 'lettering.flag.tilt', parseFloat);
        bindSelect('tt-lettering-flag-tilt-mode-input', 'lettering.flag.tiltMode');
        bindRangeWithRender('tt-lettering-flag-rise-input', 'lettering.flag.rise', parseFloat);
        bindRangeWithRender('tt-lettering-flag-wave-width-input', 'lettering.flag.waveWidth', parseFloat);
        bindRangeWithRender('tt-lettering-flag-wave-shift-input', 'lettering.flag.waveShift', parseFloat);
        bindSelect('tt-lettering-flag-shape-input', 'lettering.flag.shape');
        bindCheckbox('tt-lettering-boggle-active-input', 'lettering.boggle.active');
        bindRange('tt-lettering-boggle-max-rotation-input', 'lettering.boggle.maxRotation', parseFloat);
        bindRange('tt-lettering-boggle-scatter-height-input', 'lettering.boggle.scatterHeight', parseFloat);
        bindCheckbox('tt-lettering-shadow-active-input', 'lettering.shadow.active');
        bindRange('tt-lettering-shadow-size-input', 'lettering.shadow.size', parseFloat);
        bindRange('tt-lettering-shadow-fill-alpha-input', 'lettering.shadow.fill.alpha', parseFloat);
        bindRange('tt-lettering-shadow-distance-input', 'lettering.shadow.distance', parseFloat);
        bindRange('tt-lettering-shadow-angle-input', 'lettering.shadow.angle', parseFloat);
        bindColor('tt-lettering-shadow-fill-color-input', 'lettering.shadow.fill.color');
        bindCheckbox('tt-lettering-reverse-overlap-letters-input', 'lettering.reverseOverlap.letters');
        bindCheckbox('tt-lettering-reverse-overlap-lines-input', 'lettering.reverseOverlap.lines');
        bindSelect('tt-lettering-blendmode-input', 'lettering.blendmode');

        // DEPTH #1
        bindCheckbox('tt-depth-active-input', 'depth.active');
        bindRange('tt-depth-length-input', 'depth.length', parseFloat);
        bindRange('tt-depth-angle-input', 'depth.angle', parseFloat);
        bindColor('tt-depth-fill-color-input', 'depth.fill.color');
        bindCheckbox('tt-depth-fill-gradient-active-input', 'depth.fill.gradient.active');
        bindRange('tt-depth-fill-merge-alpha-input', 'depth.fill.mergeAlpha', parseFloat);
        bindRange('tt-depth-fill-alpha-input', 'depth.fill.alpha', parseFloat);
        bindCheckbox('tt-depth-fill-texture-active-input', 'depth.fill.texture.active');
        bindSelect('tt-depth-fill-texture-blendmode-input', 'depth.fill.texture.blendmode');
        bindSelect('tt-depth-fill-texture-repeat-input', 'depth.fill.texture.repeat');
        bindSelect('tt-depth-fill-texture-position-input', 'depth.fill.texture.position');
        bindSelect('tt-depth-fill-texture-size-input', 'depth.fill.texture.size');
        bindRange('tt-depth-fill-texture-alpha-input', 'depth.fill.texture.alpha', parseFloat);
        bindCheckbox('tt-depth2-active-input', 'depth2.active');
        bindRange('tt-depth2-length-input', 'depth2.length', parseFloat);
        bindRange('tt-depth2-angle-input', 'depth2.angle', parseFloat);
        bindColor('tt-depth2-fill-color-input', 'depth2.fill.color');
        bindCheckbox('tt-depth2-fill-gradient-active-input', 'depth2.fill.gradient.active');
        bindRange('tt-depth2-fill-merge-alpha-input', 'depth2.fill.mergeAlpha', parseFloat);
        bindRange('tt-depth2-fill-alpha-input', 'depth2.fill.alpha', parseFloat);

        // OUTLINE #1
        bindCheckbox('tt-outline-first-active-input', 'outline.first.active');
        bindRange('tt-outline-first-width-input', 'outline.first.width', parseFloat);
        bindColor('tt-outline-first-fill-color-input', 'outline.first.fill.color');
        bindCheckbox('tt-outline-first-fill-gradient-active-input', 'outline.first.fill.gradient.active');
        bindRange('tt-outline-first-fill-gradient-angle-input', 'outline.first.fill.gradient.angle', parseFloat);
        bindCheckbox('tt-outline-first-fill-palette-active-input', 'outline.first.fill.palette.active');
        bindSelect('tt-outline-first-fill-palette-lettering-method-input', 'outline.first.fill.palette.lettering.method');
        bindSelect('tt-outline-first-position-input', 'outline.first.position');
        bindRange('tt-outline-first-dash-input', 'outline.first.dash', parseFloat);
        bindRange('tt-outline-first-fill-alpha-input', 'outline.first.fill.alpha', parseFloat);
        bindCheckbox('tt-outline-first-fill-texture-active-input', 'outline.first.fill.texture.active');
        bindSelect('tt-outline-first-fill-texture-blendmode-input', 'outline.first.fill.texture.blendmode');
        bindSelect('tt-outline-first-fill-texture-repeat-input', 'outline.first.fill.texture.repeat');
        bindSelect('tt-outline-first-fill-texture-position-input', 'outline.first.fill.texture.position');
        bindSelect('tt-outline-first-fill-texture-size-input', 'outline.first.fill.texture.size');
        bindRange('tt-outline-first-fill-texture-alpha-input', 'outline.first.fill.texture.alpha', parseFloat);
        bindCheckbox('tt-outline-first-fill-texture-lettering-input', 'outline.first.fill.texture.lettering');
        bindCheckbox('tt-outline-first-specular-active-input', 'outline.first.specular.active');
        bindRange('tt-outline-first-specular-blur-input', 'outline.first.specular.blur', parseFloat);
        bindRange('tt-outline-first-specular-scale-input', 'outline.first.specular.scale', parseFloat);
        bindRange('tt-outline-first-specular-constant-input', 'outline.first.specular.constant', parseFloat);
        bindRange('tt-outline-first-specular-exponent-input', 'outline.first.specular.exponent', parseFloat);
        bindRange('tt-outline-first-specular-azimuth-input', 'outline.first.specular.azimuth', parseFloat);
        bindRange('tt-outline-first-specular-elevation-input', 'outline.first.specular.elevation', parseFloat);
        bindColor('tt-outline-first-specular-color-input', 'outline.first.specular.color');
        bindSelect('tt-outline-first-specular-blendmode-input', 'outline.first.specular.blendmode');
        bindCheckbox('tt-outline-first-specular-type-input', 'outline.first.specular.type');
        bindRange('tt-outline-first-specular-point-x-input', 'outline.first.specular.point.x', parseFloat);
        bindRange('tt-outline-first-specular-point-y-input', 'outline.first.specular.point.y', parseFloat);
        bindRange('tt-outline-first-specular-point-z-input', 'outline.first.specular.point.z', parseFloat);
        bindJoinRadio('tt-outline-first-join-input', 'outline.first.join');

        // OUTLINE #2
        bindCheckbox('tt-outline-second-active-input', 'outline.second.active');
        bindRange('tt-outline-second-width-input', 'outline.second.width', parseFloat);
        bindSelect('tt-outline-second-position-input', 'outline.second.position');
        bindColor('tt-outline-second-fill-color-input', 'outline.second.fill.color');
        bindCheckbox('tt-outline-second-fill-gradient-active-input', 'outline.second.fill.gradient.active');
        bindRange('tt-outline-second-dash-input', 'outline.second.dash', parseFloat);
        bindRange('tt-outline-second-fill-alpha-input', 'outline.second.fill.alpha', parseFloat);
        bindCheckbox('tt-outline-second-fill-texture-active-input', 'outline.second.fill.texture.active');
        bindCheckbox('tt-outline-second-specular-active-input', 'outline.second.specular.active');
        bindRange('tt-outline-second-specular-blur-input', 'outline.second.specular.blur', parseFloat);
        bindRange('tt-outline-second-specular-scale-input', 'outline.second.specular.scale', parseFloat);
        bindRange('tt-outline-second-specular-constant-input', 'outline.second.specular.constant', parseFloat);
        bindRange('tt-outline-second-specular-exponent-input', 'outline.second.specular.exponent', parseFloat);
        bindRange('tt-outline-second-specular-azimuth-input', 'outline.second.specular.azimuth', parseFloat);
        bindRange('tt-outline-second-specular-elevation-input', 'outline.second.specular.elevation', parseFloat);
        bindColor('tt-outline-second-specular-color-input', 'outline.second.specular.color');
        bindJoinRadio('tt-outline-second-join-input', 'outline.second.join');

        // CONTOUR 3D
        bindCheckbox('tt-outline-global-active-input', 'outline.global.active');
        bindRange('tt-outline-global-width-input', 'outline.global.width', parseFloat);
        bindColor('tt-outline-global-fill-color-input', 'outline.global.fill.color');
        bindCheckbox('tt-outline-global-fill-gradient-active-input', 'outline.global.fill.gradient.active');
        bindRange('tt-outline-global-fill-alpha-input', 'outline.global.fill.alpha', parseFloat);
        bindCheckbox('tt-outline-global-shadow-active-input', 'outline.global.shadow.active');
        bindCheckbox('tt-outline-global-mask-input', 'outline.global.mask');
        bindCheckbox('tt-outline-global-projection-input', 'outline.global.projection');
        bindCheckbox('tt-outline-global2-active-input', 'outline.global2.active');
        bindRange('tt-outline-global2-width-input', 'outline.global2.width', parseFloat);
        bindColor('tt-outline-global2-fill-color-input', 'outline.global2.fill.color');
        bindRange('tt-outline-global2-fill-alpha-input', 'outline.global2.fill.alpha', parseFloat);
        bindCheckbox('tt-outline-global2-shadow-active-input', 'outline.global2.shadow.active');
        bindCheckbox('tt-outline-global2-mask-input', 'outline.global2.mask');

        // BEVEL INNER
        bindCheckbox('tt-bevel-inner-active-input', 'bevel.inner.active');
        bindRange('tt-bevel-inner-size-input', 'bevel.inner.size', parseFloat);
        bindRange('tt-bevel-inner-soften-input', 'bevel.inner.soften', parseFloat);
        bindRange('tt-bevel-inner-angle-input', 'bevel.inner.angle', parseFloat);
        bindRange('tt-bevel-inner-altitude-input', 'bevel.inner.altitude', parseFloat);
        bindColor('tt-bevel-inner-highlight-color-input', 'bevel.inner.highlight.color');
        bindSelect('tt-bevel-inner-highlight-blendmode-input', 'bevel.inner.highlight.blendmode');
        bindRange('tt-bevel-inner-highlight-alpha-input', 'bevel.inner.highlight.alpha', parseFloat);
        bindColor('tt-bevel-inner-shadow-color-input', 'bevel.inner.shadow.color');
        bindSelect('tt-bevel-inner-shadow-blendmode-input', 'bevel.inner.shadow.blendmode');
        bindRange('tt-bevel-inner-shadow-alpha-input', 'bevel.inner.shadow.alpha', parseFloat);

        // SPECULAR
        bindCheckbox('tt-specular-inner-active-input', 'specular.inner.active');
        bindRange('tt-specular-inner-blur-input', 'specular.inner.blur', parseFloat);
        bindRange('tt-specular-inner-scale-input', 'specular.inner.scale', parseFloat);
        bindRange('tt-specular-inner-constant-input', 'specular.inner.constant', parseFloat);
        bindRange('tt-specular-inner-exponent-input', 'specular.inner.exponent', parseFloat);
        bindRange('tt-specular-inner-azimuth-input', 'specular.inner.azimuth', parseFloat);
        bindRange('tt-specular-inner-elevation-input', 'specular.inner.elevation', parseFloat);
        bindColor('tt-specular-inner-color-input', 'specular.inner.color');

        // INNER SHADOW #1
        bindCheckbox('tt-shadow-inner-active-input', 'shadow.inner.active');
        bindRange('tt-shadow-inner-size-input', 'shadow.inner.size', parseFloat);
        bindRange('tt-shadow-inner-strength-input', 'shadow.inner.strength', parseFloat);
        bindRange('tt-shadow-inner-alpha-input', 'shadow.inner.alpha', parseFloat);
        bindRange('tt-shadow-inner-distance-input', 'shadow.inner.distance', parseFloat);
        bindRange('tt-shadow-inner-angle-input', 'shadow.inner.angle', parseFloat);
        bindRange('tt-shadow-inner-offset-input', 'shadow.inner.offset', parseFloat);
        bindColor('tt-shadow-inner-color-input', 'shadow.inner.color');
        bindSelect('tt-shadow-inner-blendmode-input', 'shadow.inner.blendmode');

        // INNER SHADOW #2
        bindCheckbox('tt-shadow-inner2-active-input', 'shadow.inner2.active');
        bindRange('tt-shadow-inner2-size-input', 'shadow.inner2.size', parseFloat);
        bindRange('tt-shadow-inner2-strength-input', 'shadow.inner2.strength', parseFloat);
        bindRange('tt-shadow-inner2-alpha-input', 'shadow.inner2.alpha', parseFloat);
        bindRange('tt-shadow-inner2-distance-input', 'shadow.inner2.distance', parseFloat);
        bindRange('tt-shadow-inner2-angle-input', 'shadow.inner2.angle', parseFloat);
        bindRange('tt-shadow-inner2-offset-input', 'shadow.inner2.offset', parseFloat);
        bindColor('tt-shadow-inner2-color-input', 'shadow.inner2.color');

        // OUTER SHADOW #1
        bindCheckbox('tt-shadow-outer-active-input', 'shadow.outer.active');
        bindRange('tt-shadow-outer-size-input', 'shadow.outer.size', parseFloat);
        bindRange('tt-shadow-outer-strength-input', 'shadow.outer.strength', parseFloat);
        bindRange('tt-shadow-outer-fill-alpha-input', 'shadow.outer.fill.alpha', parseFloat);
        bindRange('tt-shadow-outer-distance-input', 'shadow.outer.distance', parseFloat);
        bindRange('tt-shadow-outer-angle-input', 'shadow.outer.angle', parseFloat);
        bindCheckbox('tt-shadow-outer-mask-input', 'shadow.outer.mask');
        bindColor('tt-shadow-outer-fill-color-input', 'shadow.outer.fill.color');
        bindCheckbox('tt-shadow-outer-fill-gradient-active-input', 'shadow.outer.fill.gradient.active');

        // OUTER SHADOW #2
        bindCheckbox('tt-shadow-outer2-active-input', 'shadow.outer2.active');
        bindRange('tt-shadow-outer2-size-input', 'shadow.outer2.size', parseFloat);
        bindRange('tt-shadow-outer2-strength-input', 'shadow.outer2.strength', parseFloat);
        bindRange('tt-shadow-outer2-fill-alpha-input', 'shadow.outer2.fill.alpha', parseFloat);
        bindRange('tt-shadow-outer2-distance-input', 'shadow.outer2.distance', parseFloat);
        bindRange('tt-shadow-outer2-angle-input', 'shadow.outer2.angle', parseFloat);
        bindCheckbox('tt-shadow-outer2-mask-input', 'shadow.outer2.mask');
        bindColor('tt-shadow-outer2-fill-color-input', 'shadow.outer2.fill.color');

        // ICON
        bindCheckbox('tt-icon-active-input', 'icon.active');
        bindRange('tt-icon-size-input', 'icon.size', parseFloat);
        bindSelect('tt-icon-position-input', 'icon.position');
        bindRange('tt-icon-offset-x-input', 'icon.offset.x', parseFloat);
        bindRange('tt-icon-offset-y-input', 'icon.offset.y', parseFloat);
        bindRange('tt-icon-rotate-input', 'icon.rotate', parseFloat);
        bindRange('tt-icon-alpha-input', 'icon.alpha', parseFloat);
        bindSelect('tt-icon-composite-input', 'icon.composite');

        // BACKGROUND
        bindCheckbox('tt-background-active-input', 'background.active');
        bindColor('tt-background-fill-color-input', 'background.fill.color');
        bindCheckbox('tt-background-fill-gradient-active-input', 'background.fill.gradient.active');
        bindSelect('tt-background-fill-gradient-type-input', 'background.fill.gradient.type');
        bindRange('tt-background-fill-gradient-angle-input', 'background.fill.gradient.angle', parseFloat);
        bindRange('tt-background-fill-alpha-input', 'background.fill.alpha', parseFloat);
        bindCheckbox('tt-background-fill-image-active-input', 'background.fill.image.active');
        bindSelect('tt-background-fill-image-repeat-input', 'background.fill.image.repeat');
        bindRange('tt-background-fill-image-alpha-input', 'background.fill.image.alpha', parseFloat);
        bindRange('tt-background-fill-image-size-custom-input', 'background.fill.image.size.custom', parseFloat);
        bindSelect('tt-background-composite-input', 'background.composite');

        // Background image size type controls visibility of custom size option
        const bgSizeType = document.getElementById('tt-background-fill-image-size-type-input');
        const bgSizeCustom = document.getElementById('tt-background-fill-image-size-custom-option');
        if (bgSizeType && bgSizeCustom) {
            bgSizeType.addEventListener('change', function() {
                setNestedSetting('background.fill.image.size', this.value);
                bgSizeCustom.style.display = this.value === 'custom' ? 'block' : 'none';
            });
        }
    }

    // Helper: bind textarea
    function bindTextarea(id, settingPath) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function() {
            setNestedSetting(settingPath, this.value);
        });
    }

    // Helper: bind align list (icon-based selection)
    function bindAlignList(inputId, settingPath) {
        const input = document.getElementById(inputId);
        const list = input?.parentElement?.querySelector('.tt-align-list');
        if (!list || !input) return;
        list.addEventListener('click', function(e) {
            const li = e.target.closest('li');
            if (!li || !li.dataset.id) return;
            input.value = li.dataset.id;
            this.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
            li.classList.add('selected');
            setNestedSetting(settingPath, li.dataset.id);
        });
    }

    // Helper: bind font weight toggle
    function bindFontWeight(inputId) {
        const input = document.getElementById(inputId);
        const list = document.querySelector('.tt-font-options-list');
        if (!input || !list) return;
        list.addEventListener('click', function(e) {
            const li = e.target.closest('li');
            if (!li) return;
            const newValue = input.value === 'normal' ? 'bold' : 'normal';
            input.value = newValue;
            this.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
            if (newValue === 'bold') li.classList.add('selected');
            setNestedSetting('font.weight', newValue);
        });
    }

    // Helper: bind range input with render trigger
    function bindRangeWithRender(id, settingPath, transformFn) {
        const el = document.getElementById(id);
        if (!el) return;
        updateRangeFill(el);
        el.addEventListener('input', function() {
            updateRangeFill(this);
            const val = transformFn ? transformFn(this.value) : this.value;
            setNestedSetting(settingPath, val);
        });
    }

    // Helper: bind join/vertices radio-style list
    function bindJoinRadio(inputId, settingPath) {
        const input = document.getElementById(inputId);
        const list = input?.parentElement?.querySelector('.tt-outline-join-list');
        if (!list || !input) return;
        list.addEventListener('click', function(e) {
            const li = e.target.closest('li');
            if (!li || !li.dataset.id) return;
            input.value = li.dataset.id;
            this.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
            li.classList.add('selected');
            setNestedSetting(settingPath, li.dataset.id);
        });
    }

    // ===== TT-SHOW-BROTHER TABS =====
    function initShowBrotherTabs() {
        document.querySelectorAll('.tt-show-brother').forEach(function(tabList) {
            tabList.addEventListener('click', function(e) {
                const li = e.target.closest('li');
                if (!li || !li.dataset.show) return;
                this.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
                li.classList.add('selected');
                const parent = this.closest('.tt-column-inner');
                if (parent) {
                    parent.querySelectorAll('fieldset').forEach(fs => {
                        fs.style.display = fs.id === li.dataset.show ? 'block' : 'none';
                    });
                }
            });
        });
    }

    // ===== TEXTURE UPLOADS =====
    function initTextureUploads() {
        document.querySelectorAll('input[type="file"][accept="image/*"]').forEach(function(input) {
            input.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(ev) {
                    const dataUrl = ev.target.result;
                    const settingPath = input.dataset.ttOption;
                    if (settingPath) setNestedSetting(settingPath, dataUrl);
                    const preview = input.parentElement.nextElementSibling;
                    if (preview && preview.classList.contains('tt-texture-preview')) {
                        preview.style.display = 'block';
                        const img = preview.querySelector('.tt-texture-preview-image');
                        if (img) img.src = dataUrl;
                    }
                    const previewContainer = input.closest('.tt-option')?.querySelector('[id$="preview-container"]');
                    if (previewContainer) {
                        previewContainer.style.display = 'block';
                        const img = previewContainer.querySelector('img');
                        if (img) img.src = dataUrl;
                    }
                };
                reader.readAsDataURL(file);
            });
        });

        // Delete texture buttons
        document.querySelectorAll('.tt-texture-delete-icon, [id$="preview-delete-icon"]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const preview = this.closest('.tt-texture-preview, [id$="preview-container"]');
                if (preview) preview.style.display = 'none';
                const option = this.closest('.tt-option, fieldset');
                if (option) {
                    const fileInput = option.querySelector('input[type="file"]');
                    if (fileInput) {
                        fileInput.value = '';
                        const settingPath = fileInput.dataset.ttOption;
                        if (settingPath) setNestedSetting(settingPath, null);
                    }
                }
            });
        });
    }

    // ===== ICON GALLERY =====
    function initIconGallery() {
        const gallery = document.getElementById('tt-icon-gallery');
        const searchInput = document.getElementById('tt-icon-search-input');
        if (!gallery) return;

        function loadIcons() {
            return [
                {id:'96', file:'https://cdn.textstudio.com/output/clipart/0/0/6/9/96_c0d92.svg', title:'Fire'},
                {id:'352', file:'https://cdn.textstudio.com/output/clipart/0/2/5/3/352_36130.svg', title:'Youtube Logo'},
                {id:'376', file:'https://cdn.textstudio.com/output/clipart/0/6/7/3/376_6456f.svg', title:'Instagram Logo'},
                {id:'528', file:'https://cdn.textstudio.com/output/clipart/0/8/2/5/528_5ff44.svg', title:'Heart'},
                {id:'1320', file:'https://cdn.textstudio.com/output/clipart/0/2/3/1/1320_65c7f.svg', title:'Discord Logo'},
                {id:'1541', file:'https://cdn.textstudio.com/output/clipart/1/4/5/1/1541_4cdae.svg', title:'Whatsapp Logo'},
                {id:'2636', file:'https://cdn.textstudio.com/output/clipart/6/3/6/2/2636_7808e.svg', title:'Tiktok Logo'},
                {id:'2853', file:'https://cdn.textstudio.com/output/clipart/3/5/8/2/2853_f15fb.svg', title:'Rating Star'},
                {id:'4433', file:'https://cdn.textstudio.com/output/clipart/3/3/4/4/4433_e32f1.svg', title:'Stars'},
                {id:'5159', file:'https://cdn.textstudio.com/output/clipart/9/5/1/5/5159_4f0f9.svg', title:'Black Roblox Logo'},
                {id:'6470', file:'https://cdn.textstudio.com/output/clipart/0/7/4/6/6470_efb84.svg', title:'Instagram'},
                {id:'6706', file:'https://cdn.textstudio.com/output/clipart/6/0/7/6/6706_2c9d7.svg', title:'Youtube Logo'},
                {id:'8238', file:'https://cdn.textstudio.com/output/clipart/8/3/2/8/8238_e8654.svg', title:'Onlyfans Logo'},
                {id:'8449', file:'https://cdn.textstudio.com/output/clipart/9/4/4/8/8449_3847a.svg', title:'Butterflies'},
                {id:'9472', file:'https://cdn.textstudio.com/output/clipart/2/7/4/9/9472_4bfce.svg', title:'Cartoon Eyes Wink'},
                {id:'12049', file:'https://cdn.textstudio.com/output/clipart/9/4/0/2/12049_d3ab6.svg', title:'Red Hearts'},
                {id:'18208', file:'https://cdn.textstudio.com/output/clipart/8/0/2/8/18208_93c82.svg', title:'Minecraft'},
                {id:'18209', file:'https://cdn.textstudio.com/output/clipart/9/0/2/8/18209_38953.svg', title:'Nike'},
                {id:'18214', file:'https://cdn.textstudio.com/output/clipart/4/1/2/8/18214_dfb84.svg', title:'Mushroom'},
                {id:'18375', file:'https://cdn.textstudio.com/output/clipart/5/7/3/8/18375_8082d.svg', title:'Pokemon'},
                {id:'18675', file:'https://cdn.textstudio.com/output/clipart/5/7/6/8/18675_917d9.svg', title:'4k'},
                {id:'20690', file:'https://cdn.textstudio.com/output/clipart/0/9/6/0/20690_77547.svg', title:'GTA'},
                {id:'20734', file:'https://cdn.textstudio.com/output/clipart/4/3/7/0/20734_dc266.svg', title:'Spiderman'},
                {id:'20938', file:'https://cdn.textstudio.com/output/clipart/8/3/9/0/20938_5a2f8.svg', title:'Minecraft'},
                {id:'20939', file:'https://cdn.textstudio.com/output/clipart/9/3/9/0/20939_96b92.svg', title:'Fortnite'},
                {id:'20940', file:'https://cdn.textstudio.com/output/clipart/0/4/9/0/20940_eb462.svg', title:'YouTube'},
                {id:'20948', file:'https://cdn.textstudio.com/output/clipart/8/4/9/0/20948_5633f.svg', title:'Dragon Ball Z'},
                {id:'20963', file:'https://cdn.textstudio.com/output/clipart/3/6/9/0/20963_141b4.svg', title:'Minecraft Creeper'},
                {id:'21022', file:'https://cdn.textstudio.com/output/clipart/2/2/0/1/21022_6da28.svg', title:'Naruto'},
                {id:'21025', file:'https://cdn.textstudio.com/output/clipart/5/2/0/1/21025_30681.svg', title:'One Piece'},
                {id:'21045', file:'https://cdn.textstudio.com/output/clipart/5/4/0/1/21045_233af.svg', title:'Barbie'},
                {id:'21047', file:'https://cdn.textstudio.com/output/clipart/7/4/0/1/21047_15219.svg', title:'Super Mario'},
                {id:'21049', file:'https://cdn.textstudio.com/output/clipart/9/4/0/1/21049_86905.svg', title:'Dragon Ball Goku'},
                {id:'22151', file:'https://cdn.textstudio.com/output/clipart/1/5/1/2/22151_f2404.svg', title:'Hello Kitty'},
                {id:'25347', file:'https://cdn.textstudio.com/output/clipart/7/4/3/5/25347_ba990.svg', title:'X Twitter'},
                {id:'25541', file:'https://cdn.textstudio.com/output/clipart/1/4/5/5/25541_1fb8e.svg', title:'Golden Crown'},
                {id:'25855', file:'https://cdn.textstudio.com/output/clipart/5/5/8/5/25855_915ab.svg', title:'Skull'},
                {id:'25968', file:'https://cdn.textstudio.com/output/clipart/8/6/9/5/25968_b7c9b.svg', title:'Heart creature'},
                {id:'26186', file:'https://cdn.textstudio.com/output/clipart/6/8/1/6/26186_e7180.svg', title:'Adidas'},
                {id:'26224', file:'https://cdn.textstudio.com/output/clipart/4/2/2/6/26224_d5d8f.svg', title:'KFC'},
                {id:'26249', file:'https://cdn.textstudio.com/output/clipart/9/4/2/6/26249_af59b.svg', title:'Playstation'},
                {id:'26252', file:'https://cdn.textstudio.com/output/clipart/2/5/2/6/26252_0667a.svg', title:'Eagle'},
                {id:'26264', file:'https://cdn.textstudio.com/output/clipart/4/6/2/6/26264_d5ea7.svg', title:'Bluey'},
                {id:'26887', file:'https://cdn.textstudio.com/output/clipart/7/8/8/6/26887_3dd80.svg', title:'Sparkling Star'},
                {id:'27250', file:'https://cdn.textstudio.com/output/clipart/0/5/2/7/27250_378f8.svg', title:'Red Dripping Paint'},
            ];
        }

        function renderIcons(icons) {
            gallery.innerHTML = '';
            icons.forEach(function(icon) {
                const li = document.createElement('li');
                li.dataset.id = icon.id;
                li.dataset.file = icon.file;
                li.title = icon.title;
                const img = document.createElement('img');
                img.src = icon.file.replace('.svg', '.webp').replace('/clipart/', '/clipart/preview/small/');
                img.alt = icon.title;
                img.loading = 'lazy';
                li.appendChild(img);
                li.addEventListener('click', function() {
                    setNestedSetting('icon.src', icon.file);
                    const preview = document.getElementById('tt-icon-preview-container');
                    if (preview) {
                        preview.style.display = 'block';
                        const pimg = preview.querySelector('img');
                        if (pimg) pimg.src = icon.file;
                    }
                    gallery.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
                    this.classList.add('selected');
                });
                gallery.appendChild(li);
            });
        }

        const allIcons = loadIcons();
        renderIcons(allIcons);

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const q = this.value.toLowerCase();
                const filtered = allIcons.filter(function(icon) {
                    return icon.title.toLowerCase().includes(q);
                });
                renderIcons(filtered);
                const noResult = document.getElementById('tt-icon-list-no-result');
                if (noResult) noResult.style.display = filtered.length === 0 ? 'block' : 'none';
            });
        }
    }

    // ===== BACKGROUND GALLERY =====
    function initBackgroundGallery() {
        const gallery = document.getElementById('tt-background-gallery');
        const searchInput = document.getElementById('tt-background-search-input');
        if (!gallery) return;

        const backgrounds = [
            {id:'391', title:'Transparent', preset:'https://cdn.textstudio.com/output/background/0/1/9/3/391_84432.json'},
            {id:'385', title:'White', preset:'https://cdn.textstudio.com/output/background/0/5/8/3/385_23afc.json'},
            {id:'386', title:'Black', preset:'https://cdn.textstudio.com/output/background/0/6/8/3/386_0fae0.json'},
            {id:'70', title:'Kimoby Blue', preset:'https://cdn.textstudio.com/output/background/0/0/0/7/70_eb29a.json'},
            {id:'356', title:'Blood splash', preset:'https://cdn.textstudio.com/output/background/0/6/5/3/356_90e90.json'},
            {id:'376', title:'Blurred circles', preset:'https://cdn.textstudio.com/output/background/0/6/7/3/376_15b81.json'},
            {id:'380', title:'Hearts', preset:'https://cdn.textstudio.com/output/background/0/0/8/3/380_ff91f.json'},
            {id:'384', title:'Sky', preset:'https://cdn.textstudio.com/output/background/0/4/8/3/384_89785.json'},
            {id:'389', title:'Golden', preset:'https://cdn.textstudio.com/output/background/0/9/8/3/389_36ff1.json'},
            {id:'421', title:'Space Earth', preset:'https://cdn.textstudio.com/output/background/0/1/2/4/421_cb4b9.json'},
            {id:'427', title:'Rainbow swirl', preset:'https://cdn.textstudio.com/output/background/0/7/2/4/427_58338.json'},
            {id:'447', title:'Smoke', preset:'https://cdn.textstudio.com/output/background/0/7/4/4/447_be2e2.json'},
            {id:'452', title:'Thunder', preset:'https://cdn.textstudio.com/output/background/0/2/5/4/452_c75f0.json'},
            {id:'858', title:'Circular', preset:'https://cdn.textstudio.com/output/background/0/8/5/8/858_ab743.json'},
            {id:'941', title:'Pop Art', preset:'https://cdn.textstudio.com/output/background/0/1/4/9/941_25235.json'},
            {id:'964', title:'Minecraft', preset:'https://cdn.textstudio.com/output/background/0/4/6/9/964_eb3a3.json'},
            {id:'981', title:'Comic bubbles', preset:'https://cdn.textstudio.com/output/background/0/1/8/9/981_f147d.json'},
            {id:'999', title:'Retro 80s', preset:'https://cdn.textstudio.com/output/background/0/9/9/9/999_65d81.json'},
            {id:'1040', title:'Green screen', preset:'https://cdn.textstudio.com/output/background/0/4/0/1/1040_81bc8.json'},
            {id:'1086', title:'Brick', preset:'https://cdn.textstudio.com/output/background/6/8/0/1/1086_435a6.json'},
            {id:'1114', title:'Purple splash', preset:'https://cdn.textstudio.com/output/background/4/1/1/1/1114_bb229.json'},
            {id:'1115', title:'Blue splash', preset:'https://cdn.textstudio.com/output/background/5/1/1/1/1115_32f55.json'},
            {id:'1117', title:'Green splash', preset:'https://cdn.textstudio.com/output/background/7/1/1/1/1117_ef1cc.json'},
            {id:'1156', title:'Sun Vintage', preset:'https://cdn.textstudio.com/output/background/6/5/1/1/1156_b0b9e.json'},
            {id:'1182', title:'Neon Square', preset:'https://cdn.textstudio.com/output/background/2/8/1/1/1182_321b3.json'},
            {id:'1186', title:'Fantasy', preset:'https://cdn.textstudio.com/output/background/6/8/1/1/1186_bf78a.json'},
            {id:'1197', title:'Dragon Ball Z', preset:'https://cdn.textstudio.com/output/background/7/9/1/1/1197_577a0.json'},
            {id:'1211', title:'Blue gradient', preset:'https://cdn.textstudio.com/output/background/1/1/2/1/1211_e4fc1.json'},
            {id:'1222', title:'Fortnite gradient', preset:'https://cdn.textstudio.com/output/background/2/2/2/1/1222_a13ce.json'},
            {id:'1223', title:'Orange sunburst', preset:'https://cdn.textstudio.com/output/background/3/2/2/1/1223_c4c60.json'},
            {id:'1225', title:'Black Wall', preset:'https://cdn.textstudio.com/output/background/5/2/2/1/1225_382c9.json'},
            {id:'1231', title:'Sunburst Turquoise', preset:'https://cdn.textstudio.com/output/background/1/3/2/1/1231_294a7.json'},
            {id:'1236', title:'Pink', preset:'https://cdn.textstudio.com/output/background/6/3/2/1/1236_5c21a.json'},
            {id:'1237', title:'Love', preset:'https://cdn.textstudio.com/output/background/7/3/2/1/1237_16afd.json'},
            {id:'1238', title:'Yellow sunburst', preset:'https://cdn.textstudio.com/output/background/8/3/2/1/1238_9a094.json'},
            {id:'1240', title:'Red Gold', preset:'https://cdn.textstudio.com/output/background/0/4/2/1/1240_f0c17.json'},
            {id:'1242', title:'Happy New Year', preset:'https://cdn.textstudio.com/output/background/2/4/2/1/1242_0d65e.json'},
            {id:'1251', title:'Galaxy', preset:'https://cdn.textstudio.com/output/background/1/5/2/1/1251_21994.json'},
            {id:'1252', title:'Cloud', preset:'https://cdn.textstudio.com/output/background/2/5/2/1/1252_a329e.json'},
            {id:'1256', title:'Retro', preset:'https://cdn.textstudio.com/output/background/6/5/2/1/1256_21482.json'},
            {id:'1265', title:'Retro', preset:'https://cdn.textstudio.com/output/background/5/6/2/1/1265_c9a29.json'},
            {id:'1270', title:'Retro', preset:'https://cdn.textstudio.com/output/background/0/7/2/1/1270_c45bb.json'},
            {id:'1303', title:'Retro', preset:'https://cdn.textstudio.com/output/background/3/0/3/1/1303_255a4.json'},
            {id:'1316', title:'Synthwave 80s', preset:'https://cdn.textstudio.com/output/background/6/1/3/1/1316_d847f.json'},
            {id:'1322', title:'Futuristic digital', preset:'https://cdn.textstudio.com/output/background/2/2/3/1/1322_f096b.json'},
            {id:'1323', title:'Warning stripes', preset:'https://cdn.textstudio.com/output/background/3/2/3/1/1323_410d1.json'},
            {id:'1326', title:'Tech wave', preset:'https://cdn.textstudio.com/output/background/6/2/3/1/1326_f3698.json'},
            {id:'1331', title:'Pink stripes', preset:'https://cdn.textstudio.com/output/background/1/3/3/1/1331_eaa54.json'},
            {id:'1332', title:'Pink hearts', preset:'https://cdn.textstudio.com/output/background/2/3/3/1/1332_bf831.json'},
            {id:'1338', title:'Halftone comic', preset:'https://cdn.textstudio.com/output/background/8/3/3/1/1338_684fc.json'},
            {id:'1343', title:'Spongebob', preset:'https://cdn.textstudio.com/output/background/3/4/3/1/1343_ffa8f.json'},
            {id:'1365', title:'Sun burst', preset:'https://cdn.textstudio.com/output/background/5/6/3/1/1365_79f41.json'},
            {id:'1371', title:'Spider', preset:'https://cdn.textstudio.com/output/background/1/7/3/1/1371_6f2e5.json'},
            {id:'1372', title:'Red Comic', preset:'https://cdn.textstudio.com/output/background/2/7/3/1/1372_15e6a.json'},
            {id:'1373', title:'Golden crown', preset:'https://cdn.textstudio.com/output/background/3/7/3/1/1373_d354c.json'},
            {id:'1380', title:'Soft gradient', preset:'https://cdn.textstudio.com/output/background/0/8/3/1/1380_4ca61.json'},
            {id:'1382', title:'Optical illusion', preset:'https://cdn.textstudio.com/output/background/2/8/3/1/1382_90001.json'},
            {id:'1391', title:'Pastel sky glitter', preset:'https://cdn.textstudio.com/output/background/1/9/3/1/1391_84a46.json'},
            {id:'1403', title:'Minnie Mouse', preset:'https://cdn.textstudio.com/output/background/3/0/4/1/1403_0d828.json'},
            {id:'1414', title:'Rainbow stripes', preset:'https://cdn.textstudio.com/output/background/4/1/4/1/1414_5248f.json'},
            {id:'1436', title:'Holi color', preset:'https://cdn.textstudio.com/output/background/6/3/4/1/1436_903ec.json'},
            {id:'1469', title:'Blue Light', preset:'https://cdn.textstudio.com/output/background/9/6/4/1/1469_30763.json'},
            {id:'1470', title:'Blue pink rays', preset:'https://cdn.textstudio.com/output/background/0/7/4/1/1470_ca194.json'},
            {id:'1489', title:'Comic pink', preset:'https://cdn.textstudio.com/output/background/9/8/4/1/1489_7dd48.json'},
            {id:'1493', title:'Dark Black', preset:'https://cdn.textstudio.com/output/background/3/9/4/1/1493_f05cb.json'},
            {id:'1494', title:'Abstract dark', preset:'https://cdn.textstudio.com/output/background/4/9/4/1/1494_0b373.json'},
            {id:'1496', title:'Blue portal', preset:'https://cdn.textstudio.com/output/background/6/9/4/1/1496_7b16b.json'},
            {id:'1502', title:'Cyberpunk', preset:'https://cdn.textstudio.com/output/background/2/0/5/1/1502_69a6d.json'},
            {id:'1505', title:'Comic blue', preset:'https://cdn.textstudio.com/output/background/5/0/5/1/1505_86195.json'},
            {id:'1537', title:'Retro psychedelic', preset:'https://cdn.textstudio.com/output/background/7/3/5/1/1537_75ff0.json'},
            {id:'1545', title:'70s funky', preset:'https://cdn.textstudio.com/output/background/5/4/5/1/1545_d60d0.json'},
            {id:'1551', title:'Palm Silhouettes', preset:'https://cdn.textstudio.com/output/background/1/5/5/1/1551_bac18.json'},
            {id:'1559', title:'Yellow Splash', preset:'https://cdn.textstudio.com/output/background/9/5/5/1/1559_fca1b.json'},
            {id:'1586', title:'Purple circle', preset:'https://cdn.textstudio.com/output/background/6/8/5/1/1586_2093b.json'},
            {id:'1593', title:'Minecraft Dungeons', preset:'https://cdn.textstudio.com/output/background/3/9/5/1/1593_6b0d8.json'},
            {id:'1597', title:'GTA', preset:'https://cdn.textstudio.com/output/background/7/9/5/1/1597_be070.json'},
            {id:'1599', title:'Dark Blue Brick', preset:'https://cdn.textstudio.com/output/background/9/9/5/1/1599_96efb.json'},
            {id:'1606', title:'Space', preset:'https://cdn.textstudio.com/output/background/6/0/6/1/1606_37998.json'},
            {id:'1618', title:'Purple Sunburst', preset:'https://cdn.textstudio.com/output/background/8/1/6/1/1618_862a7.json'},
            {id:'1620', title:'Cloudy sky', preset:'https://cdn.textstudio.com/output/background/0/2/6/1/1620_5049f.json'},
            {id:'1628', title:'Ronaldo', preset:'https://cdn.textstudio.com/output/background/8/2/6/1/1628_a5db2.json'},
            {id:'1638', title:'Flash Sale', preset:'https://cdn.textstudio.com/output/background/8/3/6/1/1638_f5234.json'},
            {id:'1644', title:'Brick Wall', preset:'https://cdn.textstudio.com/output/background/4/4/6/1/1644_e2cee.json'},
            {id:'1656', title:'Comic Pop Art Pink', preset:'https://cdn.textstudio.com/output/background/6/5/6/1/1656_021bf.json'},
            {id:'1664', title:'Purple pink clouds', preset:'https://cdn.textstudio.com/output/background/4/6/6/1/1664_fe70f.json'},
            {id:'1690', title:'Pennant flags', preset:'https://cdn.textstudio.com/output/background/0/9/6/1/1690_125ed.json'},
            {id:'1693', title:'Speech bubble pink', preset:'https://cdn.textstudio.com/output/background/3/9/6/1/1693_a2d13.json'},
            {id:'1703', title:'Neon Heart', preset:'https://cdn.textstudio.com/output/background/3/0/7/1/1703_8ceb8.json'},
            {id:'1721', title:'Christmas Red', preset:'https://cdn.textstudio.com/output/background/1/2/7/1/1721_505e8.json'},
            {id:'2025', title:'Silhouette Drip', preset:'https://cdn.textstudio.com/output/background/5/2/0/2/2025_2d91a.json'},
        ];

        function renderBackgrounds(bgs) {
            gallery.innerHTML = '';
            bgs.forEach(function(bg) {
                const li = document.createElement('li');
                li.title = bg.title;
                li.dataset.id = bg.id;
                li.dataset.preset = bg.preset;
                const div = document.createElement('div');
                div.style.backgroundImage = 'url(https://cdn.textstudio.com/output/background/preview/small/' + bg.id + '_' + bg.preset.split('/').pop().split('_')[1].replace('.json', '') + '.webp)';
                div.style.backgroundSize = 'cover';
                div.style.width = '100%';
                div.style.height = '100%';
                li.appendChild(div);
                li.addEventListener('click', function() {
                    fetch(bg.preset)
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (data && data.background) {
                                const bgSettings = data.background;
                                if (bgSettings.fill) {
                                    if (bgSettings.fill.color) setNestedSetting('background.fill.color', bgSettings.fill.color);
                                    if (bgSettings.fill.alpha !== undefined) setNestedSetting('background.fill.alpha', bgSettings.fill.alpha);
                                }
                                if (bgSettings.fill && bgSettings.fill.gradient) {
                                    setNestedSetting('background.fill.gradient.active', true);
                                    if (bgSettings.fill.gradient.colors) setNestedSetting('background.fill.gradient.colors', bgSettings.fill.gradient.colors);
                                    if (bgSettings.fill.gradient.type) setNestedSetting('background.fill.gradient.type', bgSettings.fill.gradient.type);
                                }
                                if (bgSettings.fill && bgSettings.fill.image && bgSettings.fill.image.src) {
                                    setNestedSetting('background.fill.image.active', true);
                                    setNestedSetting('background.fill.image.src', bgSettings.fill.image.src);
                                }
                                setNestedSetting('background.active', true);
                            }
                        })
                        .catch(function() {
                            setNestedSetting('background.active', true);
                        });
                    gallery.querySelectorAll('li').forEach(function(item) { item.classList.remove('selected'); });
                    this.classList.add('selected');
                });
                gallery.appendChild(li);
            });
        }

        renderBackgrounds(backgrounds);

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const q = this.value.toLowerCase();
                const filtered = backgrounds.filter(function(bg) {
                    return bg.title.toLowerCase().includes(q);
                });
                renderBackgrounds(filtered);
                const noResult = document.getElementById('tt-background-list-no-result');
                if (noResult) noResult.style.display = filtered.length === 0 ? 'block' : 'none';
            });
        }
    }

    // ===== MENU TABS =====
    function bindMenuTabs() {
        const menu = document.getElementById('tt-options-menu');
        const options = document.getElementById('tt-options');
        if (!menu || !options) return;

        menu.addEventListener('click', function(e) {
            const li = e.target.closest('li');
            if (!li || !li.dataset.name) return;
            menu.querySelectorAll('li').forEach(function(item) { item.classList.remove('selected'); });
            li.classList.add('selected');
            const sectionName = li.dataset.name;
            options.querySelectorAll('section').forEach(function(section) {
                section.style.display = section.dataset.name === sectionName ? 'flex' : 'none';
            });
        });
    }

    // ===== CUSTOM MENU (STYLES sub-tabs) =====
    function bindCustomMenu() {
        const customMenu = document.getElementById('tt-custom-menu');
        if (!customMenu) return;

        customMenu.addEventListener('click', function(e) {
            const li = e.target.closest('li');
            if (!li || !li.dataset.filter) return;
            customMenu.querySelectorAll('li').forEach(function(item) { item.classList.remove('selected'); });
            li.classList.add('selected');
            const filter = li.dataset.filter;
            const columns = this.closest('section').querySelector('.tt-columns');
            if (columns) {
                columns.querySelectorAll('.tt-column').forEach(function(col) {
                    const custom = col.dataset.custom;
                    if (custom && custom.startsWith(filter)) {
                        col.style.display = 'flex';
                    } else {
                        col.style.display = 'none';
                    }
                });
            }
        });
    }

    // ===== GRADIENT COLOR INPUTS =====
    // The visual gradient pickers write "#rrggbbaa pos%, ..." strings into
    // hidden inputs and dispatch an 'input' event, but nothing listened to
    // those inputs, so the gradient colors never reached the settings and the
    // renderer fell back to its white->black default gradient.
    const GRADIENT_PICKER_DEFAULT = '#ff0000ff 0%, #00ff00ff 100%';

    function parseGradientColorsString(value) {
        const stops = [];
        String(value || '').split(',').forEach(function(part) {
            const match = part.trim().match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?\s+(\d+(?:\.\d+)?)\s*%$/i);
            if (match) {
                stops.push({
                    color: '#' + match[1],
                    pos: Math.max(0, Math.min(1, parseFloat(match[2]) / 100))
                });
            }
        });
        return stops;
    }

    function bindGradientColorInputs() {
        document.querySelectorAll('input[type="hidden"][data-tt-option*="gradient.colors"]').forEach(function(input) {
            const path = input.getAttribute('data-tt-option');

            // Seed the picker default when the setting has no colors yet, so
            // enabling the gradient shows colors instead of white/black.
            const current = getNestedSetting(path);
            if (!Array.isArray(current) || current.length < 2) {
                input.value = GRADIENT_PICKER_DEFAULT;
                input.dispatchEvent(new Event('input'));
            }

            input.addEventListener('input', function() {
                setNestedSetting(path, parseGradientColorsString(this.value));
            });
        });

        // Rebuild the pickers when settings are reloaded from a preset or
        // undo/redo, so they display the loaded gradient colors.
        document.addEventListener('textmuy:settings-updated', function() {
            if (window.GradientPicker && window.GradientPicker.init) {
                window.GradientPicker.init();
            }
        });
    }

    // ===== FILL LAYERS UI =====
    const MAX_FILL_LAYERS = 4;
    const FILL_BLEND_MODES = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
    const FILL_REPEATS = [['none', 'no repeat'], ['letter', '1 style / letter'], ['word', '1 style / word'], ['line', '1 style / line']];
    const FILL_STYLE_RAMP = ['#ff3b3b', '#ffb400', '#ffe600', '#2ecc40', '#00a8ff', '#8e44ad'];

    function getFillLayers() {
        let layers = getNestedSetting('fill.layers');
        if ((!Array.isArray(layers) || !layers.length) && editor) {
            // The renderer migrates legacy fill.* fields on the fly, but that
            // array is never stored in settings — so the panel used to edit a
            // different (or empty) layer list and its changes (fit, scale,
            // colors...) never reached the canvas. Seed settings.fill.layers
            // with the migrated layers once so both sides share one array.
            const migrated = window.TextEditor && window.TextEditor.getFillLayers
                ? window.TextEditor.getFillLayers(editor.getSettings())
                : null;
            if (Array.isArray(migrated) && migrated.length) {
                setNestedSetting('fill.layers', migrated);
                layers = getNestedSetting('fill.layers');
            }
        }
        return Array.isArray(layers) ? layers : [];
    }

    function setFillLayers(layers) {
        setNestedSetting('fill.layers', layers);
        renderFillLayersUI();
    }

    function fillStylePreview(style) {
        if (!style) return '#ffffff';
        if (style.type === 'gradient' && style.gradient && Array.isArray(style.gradient.colors) && style.gradient.colors.length) {
            const stops = style.gradient.colors.map(function(s) {
                const color = typeof s === 'string' ? s : (s && s.color) || '#ffffff';
                const pos = s && s.pos !== undefined ? Math.round(s.pos * 100) : null;
                return pos !== null ? color + ' ' + pos + '%' : color;
            }).join(', ');
            return 'linear-gradient(90deg, ' + stops + ')';
        }
        if (style.type === 'texture' && style.texture && style.texture.src) {
            return 'url(' + style.texture.src + ') center/cover';
        }
        return (style.color && typeof style.color === 'string') ? style.color : '#ffffff';
    }

    function renderFillLayersUI() {
        const container = document.getElementById('tt-fill-layers');
        if (!container) return;
        const layers = getFillLayers();
        container.innerHTML = '';
        layers.forEach(function(layer, li) {
            container.appendChild(buildFillLayerRow(layer, li, layers.length));
        });
        const addBtn = document.getElementById('tt-fill-add-layer-btn');
        if (addBtn) addBtn.style.display = layers.length >= MAX_FILL_LAYERS ? 'none' : 'block';
    }


    function buildFillLayerRow(layer, li, total) {
        const wrap = document.createElement('div');
        wrap.className = 'tt-fill-layer';

        const head = document.createElement('div');
        head.className = 'tt-fill-layer-head';

        const num = document.createElement('span');
        num.className = 'tt-fill-layer-num';
        num.textContent = '#' + (li + 1);
        head.appendChild(num);

        const repeat = document.createElement('select');
        repeat.className = 'tt-fill-layer-repeat';
        repeat.title = 'How the styles repeat';
        FILL_REPEATS.forEach(function(r) {
            const opt = document.createElement('option');
            opt.value = r[0];
            opt.textContent = r[1];
            repeat.appendChild(opt);
        });
        repeat.value = layer.repeat || 'none';
        repeat.addEventListener('change', function() {
            const layers = getFillLayers();
            layers[li].repeat = this.value;
            setFillLayers(layers);
        });
        head.appendChild(repeat);

        const alpha = document.createElement('input');
        alpha.type = 'range';
        alpha.min = '0'; alpha.max = '1'; alpha.step = '0.01';
        alpha.value = layer.alpha !== undefined ? layer.alpha : 1;
        alpha.title = 'Opacity';
        alpha.addEventListener('input', function() {
            const layers = getFillLayers();
            layers[li].alpha = parseFloat(this.value);
            setNestedSetting('fill.layers', layers);
        });
        head.appendChild(alpha);

        const blend = document.createElement('select');
        blend.className = 'tt-fill-layer-blend';
        blend.title = 'Blend mode';
        FILL_BLEND_MODES.forEach(function(m) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            blend.appendChild(opt);
        });
        blend.value = layer.blendmode || 'source-over';
        blend.addEventListener('change', function() {
            const layers = getFillLayers();
            layers[li].blendmode = this.value;
            setFillLayers(layers);
        });
        head.appendChild(blend);

        if (total > 1) {
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = '✕';
            rm.title = 'Remove layer';
            rm.className = 'tt-fill-layer-remove';
            rm.addEventListener('click', function() {
                const layers = getFillLayers();
                layers.splice(li, 1);
                setFillLayers(layers);
            });
            head.appendChild(rm);
        }
        wrap.appendChild(head);

        const stylesList = document.createElement('ul');
        stylesList.className = 'tt-fill-styles';
        (layer.styles || []).forEach(function(style, si) {
            stylesList.appendChild(buildFillStyleRow(layer, li, si));
        });
        wrap.appendChild(stylesList);

        const addStyle = document.createElement('button');
        addStyle.type = 'button';
        addStyle.className = 'tt-fill-add-style-btn';
        addStyle.textContent = '+ Add style';
        addStyle.addEventListener('click', function() {
            const layers = getFillLayers();
            layers[li].styles.push({ type: 'color', color: FILL_STYLE_RAMP[layers[li].styles.length % FILL_STYLE_RAMP.length] });
            setFillLayers(layers);
        });
        wrap.appendChild(addStyle);

        return wrap;
    }

    function buildFillStyleRow(layer, li, si) {
        const style = layer.styles[si];
        const row = document.createElement('li');
        row.className = 'tt-fill-style';

        const preview = document.createElement('button');
        preview.type = 'button';
        preview.className = 'tt-fill-style-preview';
        preview.title = 'Edit style';
        preview.style.background = fillStylePreview(style);
        preview.addEventListener('click', function(e) {
            e.stopPropagation();
            openFillStyleEditor(li, si, preview);
        });
        row.appendChild(preview);

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = '✎';
        edit.title = 'Edit style';
        edit.className = 'tt-fill-style-edit';
        edit.addEventListener('click', function(e) {
            e.stopPropagation();
            openFillStyleEditor(li, si, preview);
        });
        row.appendChild(edit);

        if (layer.styles.length > 1) {
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = '✕';
            rm.title = 'Remove style';
            rm.className = 'tt-fill-style-remove';
            rm.addEventListener('click', function() {
                const layers = getFillLayers();
                layers[li].styles.splice(si, 1);
                setFillLayers(layers);
            });
            row.appendChild(rm);
        }
        return row;
    }


    // Floating style editor: Color / Gradient / Pattern
    let fillStyleEditorEl = null;

    function closeFillStyleEditor() {
        if (fillStyleEditorEl) {
            fillStyleEditorEl.remove();
            fillStyleEditorEl = null;
        }
        document.removeEventListener('click', fillStyleDocClick, true);
    }

    // Close only when the click lands OUTSIDE the panel. Capture-phase
    // document listeners run before the panel's own stopPropagation, so the
    // old "close on any click" approach killed every interaction inside it
    // (gradient handles, sliders, buttons).
    function fillStyleDocClick(e) {
        if (fillStyleEditorEl && !fillStyleEditorEl.contains(e.target)) {
            closeFillStyleEditor();
        }
    }

    function openFillStyleEditor(layerIdx, styleIdx, anchor) {
        closeFillStyleEditor();
        const layer = getFillLayers()[layerIdx];
        if (!layer || !layer.styles[styleIdx]) return;
        let style = layer.styles[styleIdx];

        const panel = document.createElement('div');
        panel.id = 'tt-fill-style-editor';
        panel.className = 'tt-fill-style-editor';
        const rect = anchor.getBoundingClientRect();
        panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 250)) + 'px';
        panel.style.top = Math.min(rect.bottom + 6, window.innerHeight - 280) + 'px';
        panel.addEventListener('click', function(e) { e.stopPropagation(); });

        const tabs = document.createElement('div');
        tabs.className = 'tt-fill-style-tabs';
        const TABS = [['color', 'Color'], ['gradient', 'Gradient'], ['texture', 'Pattern']];
        const body = document.createElement('div');
        body.className = 'tt-fill-style-body';

        // Rebuilds body + tab selection in-place (panel keeps its position)
        function refreshEditorBody() {
            const layers = getFillLayers();
            if (!layers[layerIdx] || !layers[layerIdx].styles[styleIdx]) return;
            style = layers[layerIdx].styles[styleIdx];
            tabs.querySelectorAll('.tt-fill-style-tab').forEach(function(tab, i) {
                tab.classList.toggle('selected', TABS[i][0] === style.type);
            });
            body.innerHTML = '';
            buildFillStyleEditorBody(body, style, layerIdx, styleIdx, refreshEditorBody);
        }

        TABS.forEach(function(t) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = t[1];
            b.className = 'tt-fill-style-tab' + (style.type === t[0] ? ' selected' : '');
            b.addEventListener('click', function() {
                const layers = getFillLayers();
                const st = layers[layerIdx].styles[styleIdx];
                if (!st) return;
                if (t[0] === 'color' && !st.color) st.color = '#ffffff';
                if (t[0] === 'gradient' && !st.gradient) {
                    st.gradient = { angle: 0, colors: [{ color: '#ff0000', pos: 0 }, { color: '#00ff00', pos: 1 }] };
                }
                if (t[0] === 'texture' && !st.texture) {
                    st.texture = { src: null, repeat: 'repeat', position: 'center', fit: 'fill', scale: 1 };
                }
                st.type = t[0];
                // setFillLayers renders the canvas + rebuilds the layer rows
                // (chip previews update) but the floating panel is a separate
                // element, so it keeps its position. The body is refreshed
                // in-place instead of re-opening with a detached anchor
                // (whose getBoundingClientRect returns zeros -> position bug).
                setFillLayers(layers);
                refreshEditorBody();
            });
            tabs.appendChild(b);
        });
        // The initial body must be built AFTER the panel is attached to the
        // document: the gradient tab locates its picker with
        // document.querySelectorAll('.tt-gradient-picker'), which cannot see
        // elements inside a detached subtree (this is why the picker only
        // appeared after clicking the Gradient tab).
        panel.appendChild(tabs);
        panel.appendChild(body);
        document.body.appendChild(panel);
        buildFillStyleEditorBody(body, style, layerIdx, styleIdx, refreshEditorBody);
        fillStyleEditorEl = panel;
        setTimeout(function() {
            document.addEventListener('click', fillStyleDocClick, true);
        }, 0);
    }

    function buildFillStyleEditorBody(body, style, layerIdx, styleIdx, refreshEditorBody) {
        if (style.type === 'color') {
            const input = document.createElement('input');
            input.type = 'color';
            input.value = /^#[0-9a-fA-F]{6}$/.test(style.color || '') ? style.color : '#ffffff';
            input.addEventListener('input', function() {
                const layers = getFillLayers();
                layers[layerIdx].styles[styleIdx].color = this.value;
                setNestedSetting('fill.layers', layers);
                renderFillLayersUI();
            });
            body.appendChild(input);
            return;
        }

        if (style.type === 'gradient') {
            const colorsInput = document.createElement('input');
            colorsInput.type = 'hidden';
            colorsInput.id = 'tt-fill-style-gradient-colors-' + layerIdx + '-' + styleIdx;
            colorsInput.value = gradientColorsToPickerString(style.gradient);
            colorsInput.addEventListener('input', function() {
                const layers = getFillLayers();
                layers[layerIdx].styles[styleIdx].gradient.colors = parseGradientColorsString(this.value);
                setNestedSetting('fill.layers', layers);
                renderFillLayersUI();
            });
            body.appendChild(colorsInput);

            const pickerDiv = document.createElement('div');
            pickerDiv.className = 'tt-gradient-picker';
            pickerDiv.setAttribute('data-update-input', colorsInput.id);
            body.appendChild(pickerDiv);

            const angleRow = document.createElement('div');
            angleRow.className = 'tt-fill-style-angle';
            const angleLabel = document.createElement('span');
            angleLabel.className = 'tt-label';
            angleLabel.textContent = 'Direction:';
            const angle = document.createElement('input');
            angle.type = 'range';
            angle.min = '-180'; angle.max = '180'; angle.step = '2.5';
            angle.value = (style.gradient && style.gradient.angle) || 0;
            angle.addEventListener('input', function() {
                const layers = getFillLayers();
                layers[layerIdx].styles[styleIdx].gradient.angle = parseFloat(this.value);
                setNestedSetting('fill.layers', layers);
            });
            angleRow.appendChild(angleLabel);
            angleRow.appendChild(angle);
            body.appendChild(angleRow);

            // Initialize ONLY this panel's picker. The global init() rebuilds
            // every picker on the page; the targeted create() keeps the
            // static pickers (and their state) untouched.
            if (window.GradientPicker && window.GradientPicker.create) {
                window.GradientPicker.create(pickerDiv, colorsInput);
            } else if (window.GradientPicker && window.GradientPicker.init) {
                window.GradientPicker.init();
            }
            return;
        }

        // ===== PATTERN (texture) =====
        const tex = style.texture || {};

        const hint = document.createElement('div');
        hint.className = 'tt-label';
        hint.textContent = 'Pattern image:';
        body.appendChild(hint);

        const file = document.createElement('input');
        file.type = 'file';
        file.accept = 'image/*';
        file.addEventListener('change', function(e) {
            const f = e.target.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                const layers = getFillLayers();
                layers[layerIdx].styles[styleIdx].texture.src = ev.target.result;
                setFillLayers(layers);
                if (refreshEditorBody) refreshEditorBody();
            };
            reader.readAsDataURL(f);
        });
        body.appendChild(file);

        // --- Fit: stretch / fit / fill ---
        const fitRow = document.createElement('div');
        fitRow.className = 'tt-fill-style-angle';
        const fitLabel = document.createElement('span');
        fitLabel.className = 'tt-label';
        fitLabel.textContent = 'Fit:';
        const fit = document.createElement('select');
        [['stretch', 'stretch'], ['fit', 'fit'], ['fill', 'fill']].forEach(function(f) {
            const opt = document.createElement('option');
            opt.value = f[0];
            opt.textContent = f[1];
            fit.appendChild(opt);
        });
        fit.value = tex.fit || 'fill';
        fit.addEventListener('change', function() {
            const layers = getFillLayers();
            layers[layerIdx].styles[styleIdx].texture.fit = this.value;
            setNestedSetting('fill.layers', layers);
        });
        fitRow.appendChild(fitLabel);
        fitRow.appendChild(fit);
        body.appendChild(fitRow);

        // --- Scale: 10% to 100% ---
        const scaleRow = document.createElement('div');
        scaleRow.className = 'tt-fill-style-angle';
        const scaleLabel = document.createElement('span');
        scaleLabel.className = 'tt-label';
        scaleLabel.textContent = 'Scale:';
        const scale = document.createElement('input');
        scale.type = 'range';
        scale.min = '10'; scale.max = '100'; scale.step = '5';
        scale.value = Math.round((tex.scale !== undefined ? tex.scale : 1) * 100);
        const scaleBubble = document.createElement('span');
        scaleBubble.className = 'tt-label';
        scaleBubble.textContent = scale.value + '%';
        scale.addEventListener('input', function() {
            scaleBubble.textContent = this.value + '%';
            const layers = getFillLayers();
            layers[layerIdx].styles[styleIdx].texture.scale = parseFloat(this.value) / 100;
            setNestedSetting('fill.layers', layers);
        });
        scaleRow.appendChild(scaleLabel);
        scaleRow.appendChild(scale);
        scaleRow.appendChild(scaleBubble);
        body.appendChild(scaleRow);

        // --- Repeat ---
        const repeat = document.createElement('select');
        [['repeat', 'repeat'], ['no-repeat', 'no-repeat']].forEach(function(r) {
            const opt = document.createElement('option');
            opt.value = r[0];
            opt.textContent = r[1];
            repeat.appendChild(opt);
        });
        repeat.value = tex.repeat || 'repeat';
        repeat.addEventListener('change', function() {
            const layers = getFillLayers();
            layers[layerIdx].styles[styleIdx].texture.repeat = this.value;
            setNestedSetting('fill.layers', layers);
        });
        body.appendChild(repeat);

        // --- Position: 3x3 origin grid ---
        const POSITIONS = [
            ['left top', 'center top', 'right top'],
            ['left center', 'center', 'right center'],
            ['left bottom', 'center bottom', 'right bottom']
        ];
        const gridLabel = document.createElement('div');
        gridLabel.className = 'tt-label';
        gridLabel.textContent = 'Origin:';
        body.appendChild(gridLabel);
        const grid = document.createElement('div');
        grid.className = 'tt-fill-position-grid';
        POSITIONS.forEach(function(rowOpts) {
            const rowEl = document.createElement('div');
            rowEl.className = 'tt-fill-position-grid-row';
            rowOpts.forEach(function(pos) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'tt-fill-position-cell' + ((tex.position || 'center') === pos ? ' selected' : '');
                cell.title = pos;
                cell.addEventListener('click', function() {
                    grid.querySelectorAll('.tt-fill-position-cell').forEach(function(c2) { c2.classList.remove('selected'); });
                    cell.classList.add('selected');
                    const layers = getFillLayers();
                    layers[layerIdx].styles[styleIdx].texture.position = pos;
                    setNestedSetting('fill.layers', layers);
                });
                rowEl.appendChild(cell);
            });
            grid.appendChild(rowEl);
        });
        body.appendChild(grid);
    }
    function gradientColorsToPickerString(gradient) {
        const colors = gradient && gradient.colors;
        if (!Array.isArray(colors)) return '';
        return colors.map(function(stop) {
            let hex;
            if (typeof stop === 'string') hex = stop.replace('#', '');
            else if (stop && stop.color) hex = String(stop.color).replace('#', '');
            else return null;
            if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            hex = hex.slice(0, 6);
            const pos = Math.round((stop && stop.pos !== undefined ? Number(stop.pos) : 0) * 100);
            return '#' + hex + 'ff ' + pos + '%';
        }).filter(Boolean).join(', ');
    }

    function initFillLayersUI() {
        const addBtn = document.getElementById('tt-fill-add-layer-btn');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                const layers = getFillLayers();
                if (layers.length >= MAX_FILL_LAYERS) return;
                layers.push({ active: true, alpha: 1, blendmode: 'source-over', repeat: 'none', styles: [{ type: 'color', color: '#ffffff' }] });
                setFillLayers(layers);
            });
        }
        document.addEventListener('textmuy:settings-updated', renderFillLayersUI);
        renderFillLayersUI();
    }

    // ===== DOWNLOAD CONTROLS =====
    // The download size must match the canvas size the user configured in the
    // TEXT section, so both inputs stay synced with settings.canvas.
    function syncDownloadSizeInputs() {
        if (!editor) return;
        const settings = editor.getSettings();
        if (!settings.canvas) return;
        const wInput = document.getElementById('tt-download-width-input');
        const hInput = document.getElementById('tt-download-height-input');
        if (wInput && settings.canvas.width) wInput.value = settings.canvas.width;
        if (hInput && settings.canvas.height) hInput.value = settings.canvas.height;
    }

    function bindDownloadControls() {
        const downloadBtn = document.getElementById('tt-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function() {
                if (window.TextMuyAPI && editor) {
                    const settings = editor.getSettings();
                    const width = parseInt(document.getElementById('tt-download-width-input')?.value) ||
                        (settings.canvas && settings.canvas.width) || 240;
                    const height = parseInt(document.getElementById('tt-download-height-input')?.value) ||
                        (settings.canvas && settings.canvas.height) || 600;
                    const scale = parseFloat(document.getElementById('tt-download-scale-input')?.value || 1);
                    // Render from the current editor state (settings) so the
                    // downloaded PNG matches what the user sees.
                    TextMuyAPI.downloadPNG({
                        settings: settings,
                        text: settings.text,
                        width: Math.round(width * scale),
                        height: Math.round(height * scale)
                    });
                }
            });
        }

        // Editing the download size also resizes the canvas (single source of
        // truth: settings.canvas.width/height).
        const dlWidthInput = document.getElementById('tt-download-width-input');
        const dlHeightInput = document.getElementById('tt-download-height-input');
        if (dlWidthInput) {
            dlWidthInput.addEventListener('input', function() {
                const w = parseInt(this.value);
                if (w > 0) setNestedSetting('canvas.width', w);
            });
        }
        if (dlHeightInput) {
            dlHeightInput.addEventListener('input', function() {
                const h = parseInt(this.value);
                if (h > 0) setNestedSetting('canvas.height', h);
            });
        }
        // Keep the download inputs aligned with the canvas when a preset is
        // loaded, undo/redo runs, or the canvas inputs change.
        document.addEventListener('textmuy:settings-updated', syncDownloadSizeInputs);
        syncDownloadSizeInputs();

        const copyBtn = document.getElementById('tt-copy-image-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                if (window.TextMuyAPI && editor) {
                    TextMuyAPI.copyImageToClipboard({
                        settings: editor.getSettings(),
                        text: editor.getSettings().text
                    });
                }
            });
        }

        const savePresetBtn = document.getElementById('tt-save-preset-btn');
        if (savePresetBtn) {
            savePresetBtn.addEventListener('click', function() {
                if (window.PresetManager && editor) {
                    const name = prompt('Preset name:');
                    if (name) {
                        try {
                            PresetManager.createPreset(name, editor.getSettings());
                            alert('Preset "' + name + '" saved successfully.');
                            bindPresets();
                        } catch (e) {
                            alert('Error saving preset: ' + e.message);
                        }
                    }
                }
            });
        }

        const ratioInput = document.getElementById('tt-download-ratio-input');
        if (ratioInput) {
            ratioInput.addEventListener('change', function() {
                const ratio = this.value;
                if (ratio !== 'fit' && editor) {
                    const parts = ratio.split(':').map(Number);
                    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
                        const wInput = document.getElementById('tt-download-width-input');
                        const hInput = document.getElementById('tt-download-height-input');
                        if (wInput && hInput) {
                            const w = parseInt(wInput.value) || 240;
                            hInput.value = Math.round(w * parts[1] / parts[0]);
                        }
                    }
                }
            });
        }

        const spacingInput = document.getElementById('tt-download-spacing-input');
        if (spacingInput) {
            spacingInput.addEventListener('change', function() {
                if (editor) {
                    editor.getSettings().download = editor.getSettings().download || {};
                    editor.getSettings().download.spacing = parseFloat(this.value);
                }
            });
        }
    }

    // ===== PRESETS =====
    function bindPresets() {
        const presetList = document.getElementById('tt-preset-list');
        if (!presetList) return;

        function loadPresets() {
            // Do NOT clear the HTML list — it already contains the built-in
            // presets (fire-free, nintendo, looney-tunes, simple-gradient, etc).
            // Only append presets from localStorage that are not already present.

            // Attach click handlers to any static <li> that lack them
            presetList.querySelectorAll('li[data-preset]').forEach(function(li) {
                if (!li.dataset.bound) {
                    li.dataset.bound = '1';
                    li.addEventListener('click', function() {
                        if (window.PresetManager) PresetManager.loadPreset(li.dataset.preset);
                    });
                }
            });

            try {
                const saved = JSON.parse(localStorage.getItem('textmuy_presets') || '{}');
                Object.keys(saved).forEach(function(name) {
                    if (!presetList.querySelector('[data-preset="' + name + '"]')) {
                        const li = document.createElement('li');
                        li.dataset.preset = name;
                        li.title = name;
                        li.innerHTML = '<span>' + name + '</span>';
                        li.addEventListener('click', function() {
                            if (window.PresetManager) PresetManager.loadPreset(name);
                        });
                        presetList.appendChild(li);
                    }
                });
            } catch(e) {}
        }

        loadPresets();
    }

    // ===== IMPORT CONTROLS =====
    function bindImportControls() {
        const importBtn = document.getElementById('tt-import-btn');
        const importUrl = document.getElementById('tt-import-url-input');
        if (!importBtn || !importUrl) return;

        importBtn.addEventListener('click', function() {
            const url = importUrl.value.trim();
            if (!url) return;
            importBtn.textContent = 'Importing...';
            importBtn.disabled = true;

            const proxyUrls = [
                'https://api.allorigins.win/raw?url=',
                'https://corsproxy.io/?',
                'https://api.codetabs.com/v1/proxy?quest='
            ];

            function tryProxy(index) {
                if (index >= proxyUrls.length) {
                    importBtn.textContent = 'Import';
                    importBtn.disabled = false;
                    alert('Could not import preset. Try pasting the JSON manually.');
                    return;
                }

                fetch(proxyUrls[index] + encodeURIComponent(url))
                    .then(function(r) { return r.text(); })
                    .then(function(html) {
                        const match = html.match(/window\.__PRESET__\s*=\s*({[^;]+})/);
                        if (match) {
                            try {
                                const preset = JSON.parse(match[1]);
                                if (window.PresetManager) {
                                    const name = 'imported-' + Date.now();
                                    PresetManager.createPreset(name, preset);
                                    alert('Preset imported successfully as "' + name + '"');
                                    bindPresets();
                                }
                                importBtn.textContent = 'Import';
                                importBtn.disabled = false;
                                return;
                            } catch(e) {}
                        }

                        const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([^<]+)<\/script>/);
                        if (jsonLdMatch) {
                            try {
                                const data = JSON.parse(jsonLdMatch[1]);
                                if (data && data.text) {
                                    if (window.PresetManager) {
                                        const name = 'imported-' + Date.now();
                                        PresetManager.createPreset(name, data);
                                        alert('Preset imported successfully as "' + name + '"');
                                        bindPresets();
                                    }
                                    importBtn.textContent = 'Import';
                                    importBtn.disabled = false;
                                    return;
                                }
                            } catch(e) {}
                        }

                        tryProxy(index + 1);
                    })
                    .catch(function() {
                        tryProxy(index + 1);
                    });
            }

            tryProxy(0);
        });
    }

    // ===== FIELDSET AUTO-MINIMIZE =====
    function initActiveFieldsets() {
        // Find all checkboxes inside <legend> inside <fieldset>
        document.querySelectorAll('fieldset legend input[type="checkbox"]').forEach(function(checkbox) {
            const fieldset = checkbox.closest('fieldset');
            if (!fieldset) return;

            // Get setting path
            const settingPath = checkbox.getAttribute('data-tt-option');
            if (!settingPath) return;

            // Only handle checkboxes that control the fieldset visibility (end with .active)
            const parts = settingPath.split('.');
            const isActiveToggle = parts[parts.length - 1] === 'active';

            if (!isActiveToggle) return;

            // Initial state
            toggleFieldset(fieldset, checkbox.checked);

            // Update on change
            checkbox.addEventListener('change', function() {
                toggleFieldset(fieldset, checkbox.checked);
            });
        });

        function toggleFieldset(fieldset, isActive) {
            if (isActive) {
                fieldset.classList.remove('tt-col-disabled');
                if (fieldset.hasAttribute('data-autominimize')) {
                    fieldset.classList.remove('tt-minimized');
                }
            } else {
                fieldset.classList.add('tt-col-disabled');
                if (fieldset.hasAttribute('data-autominimize')) {
                    fieldset.classList.add('tt-minimized');
                }
            }
        }
    }

    // ===== RANGE DEFAULTS =====
    function getValueAtPath(source, path) {
        return path.split('.').reduce(function(value, key) {
            return value === undefined || value === null ? undefined : value[key];
        }, source);
    }

    function getDefaultRangeValue(control, defaults) {
        const settingPath = control.getAttribute('data-tt-option');
        const settingDefault = settingPath && defaults ? getValueAtPath(defaults, settingPath) : undefined;
        if (typeof settingDefault === 'boolean') return settingDefault ? '1' : '0';
        return settingDefault !== undefined && settingDefault !== null ? String(settingDefault) : control.defaultValue;
    }

    function getUndoLabel(control) {
        const labels = document.querySelectorAll('label[for]');
        for (let i = 0; i < labels.length; i++) {
            if (labels[i].htmlFor === control.id) return labels[i];
        }
        return control.closest('.tt-option');
    }

    function initUndoRedo() {
        const defaults = editor && editor.createDefaultSettings ? editor.createDefaultSettings() : null;

        document.querySelectorAll('input[type="range"]').forEach(function(control) {
            let undoSpan = document.querySelector('[data-undo-control="' + control.id + '"]');
            if (!undoSpan) {
                const label = getUndoLabel(control);
                if (!label) return;
                undoSpan = document.createElement('span');
                undoSpan.className = 'tt-undo';
                undoSpan.setAttribute('data-undo-control', control.id);
                label.appendChild(undoSpan);
            }

            const defaultValue = getDefaultRangeValue(control, defaults);
            control.value = defaultValue;
            undoSpan.title = 'Restore default value';
            undoSpan.setAttribute('role', 'button');
            undoSpan.setAttribute('tabindex', '0');

            function updateVisibility() {
                undoSpan.style.display = control.value === defaultValue ? 'none' : 'inline-flex';
            }

            function restoreDefault(event) {
                if (event) event.preventDefault();
                if (control.value === defaultValue) return;
                control.value = defaultValue;
                control.dispatchEvent(new Event('input', { bubbles: true }));
                updateRangeFill(control);
                updateVisibility();
            }

            control.addEventListener('input', updateVisibility);
            control.addEventListener('change', updateVisibility);
            undoSpan.addEventListener('click', restoreDefault);
            undoSpan.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') restoreDefault(event);
            });
            undoSpan._updateDefaultVisibility = updateVisibility;
            updateVisibility();
        });
    }

    function refreshUndoControls() {
        document.querySelectorAll('[data-undo-control]').forEach(function(undoSpan) {
            if (undoSpan._updateDefaultVisibility) undoSpan._updateDefaultVisibility();
        });
    }

    // ===== RANGE SLIDERS =====
    function initRangeSliders() {
        document.querySelectorAll('input[type="range"]').forEach(function(range) {
            updateRangeFill(range);
            range.addEventListener('input', function() {
                updateRangeFill(this);
            });
        });
    }

    // ===== PRESET SEARCH AND FILTER =====
    function initPresetFilters() {
        const searchInput = document.getElementById('tt-preset-search-input');
        const categoryFilter = document.getElementById('tt-preset-category-filter');
        const presetList = document.getElementById('tt-preset-list');

        if (!searchInput || !categoryFilter || !presetList) return;

        function filterPresets() {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedCategory = categoryFilter.value;
            const presetItems = presetList.querySelectorAll('li');

            presetItems.forEach(function(item) {
                const presetName = item.getAttribute('data-preset') || '';
                const presetCategory = item.getAttribute('data-category') || 'custom';
                const title = item.getAttribute('title') || '';

                const matchesSearch = presetName.toLowerCase().includes(searchTerm) ||
                                     title.toLowerCase().includes(searchTerm);
                const matchesCategory = selectedCategory === 'all' || presetCategory === selectedCategory;

                item.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
            });
        }

        searchInput.addEventListener('input', filterPresets);
        categoryFilter.addEventListener('change', filterPresets);
    }

    // ===== FONT SEARCH AND FILTER =====
    function initFontFilters() {
        const searchInput = document.getElementById('tt-font-search-input');
        const categoryFilter = document.getElementById('tt-font-category-filter');
        const fontSelect = document.getElementById('tt-font-picker-input');
        const fontUpload = document.getElementById('tt-font-upload-input');

        if (!searchInput || !categoryFilter || !fontSelect) return;

        function filterFonts() {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedCategory = categoryFilter.value;
            const options = fontSelect.querySelectorAll('option, optgroup');

            options.forEach(function(option) {
                if (option.tagName === 'OPTGROUP') {
                    const hasMatchingChild = Array.from(option.querySelectorAll('option')).some(function(child) {
                        const fontName = child.textContent.toLowerCase();
                        const matchesSearch = fontName.includes(searchTerm);
                        const matchesCategory = selectedCategory === 'all' ||
                                                   option.label.toLowerCase() === selectedCategory ||
                                                   (selectedCategory === 'custom' && option.label === 'Custom');
                        return matchesSearch && matchesCategory;
                    });
                    option.style.display = hasMatchingChild ? '' : 'none';
                } else {
                    const fontName = option.textContent.toLowerCase();
                    const parentGroup = option.parentElement;
                    const categoryLabel = parentGroup.tagName === 'OPTGROUP' ? parentGroup.label.toLowerCase() : '';

                    const matchesSearch = fontName.includes(searchTerm);
                    const matchesCategory = selectedCategory === 'all' ||
                                               categoryLabel === selectedCategory ||
                                               (selectedCategory === 'custom' && categoryLabel === 'custom');

                    option.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
                }
            });
        }

        searchInput.addEventListener('input', filterFonts);
        categoryFilter.addEventListener('change', filterFonts);

        if (fontUpload) {
            fontUpload.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(event) {
                    const dataUrl = event.target.result;
                    const fontName = file.name.replace(/\.[^/.]+$/, '');
                    if (window.FontLoader) {
                        const fontKey = window.FontLoader.registerCustomFont(fontName, dataUrl);
                        const customGroup = fontSelect.querySelector('optgroup[label="Custom"]');
                        if (customGroup) {
                            const option = document.createElement('option');
                            option.value = fontKey;
                            option.textContent = fontName;
                            customGroup.appendChild(option);
                            fontSelect.value = fontKey;
                            fontSelect.dispatchEvent(new Event('change'));
                        }
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    }

    // ===== PRESET GALLERY (expandable bottom panel with thumbnails) =====
    function initPresetGallery() {
        const gallery = document.getElementById('tt-preset-gallery');
        const toggle = document.getElementById('tt-preset-gallery-toggle');
        const grid = document.getElementById('tt-gallery-grid');
        const search = document.getElementById('tt-gallery-search');
        if (!gallery || !toggle || !grid) return;

        let loaded = false;

        toggle.addEventListener('click', function() {
            const open = gallery.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open && !loaded) { loaded = true; populate(); }
        });

        if (search) search.addEventListener('input', filterTiles);

        function presetNames() {
            const names = [];
            const seen = new Set();
            const list = document.getElementById('tt-preset-list');
            if (list) {
                list.querySelectorAll('li[data-preset]').forEach(function(li) {
                    const n = li.getAttribute('data-preset');
                    if (n && !seen.has(n)) {
                        seen.add(n);
                        names.push({ name: n, category: li.getAttribute('data-category') || 'custom' });
                    }
                });
            }
            if (window.PresetManager) {
                try {
                    const all = PresetManager.getAllPresets();
                    Object.keys(all).forEach(function(n) {
                        if (!seen.has(n)) {
                            seen.add(n);
                            names.push({ name: n, category: all[n].category || 'custom' });
                        }
                    });
                } catch (e) {}
            }
            return names;
        }

        function populate() {
            grid.innerHTML = '';
            presetNames().forEach(function(entry) {
                const tile = document.createElement('button');
                tile.type = 'button';
                tile.className = 'tt-gallery-tile';
                tile.dataset.preset = entry.name;
                tile.dataset.category = entry.category;
                tile.setAttribute('aria-label', entry.name);

                const img = document.createElement('img');
                img.alt = entry.name;
                img.loading = 'lazy';
                tile.appendChild(img);

                const label = document.createElement('span');
                label.className = 'tt-gallery-tile-label';
                label.textContent = entry.name;
                tile.appendChild(label);

                tile.addEventListener('click', function() {
                    if (window.PresetManager && PresetManager.loadPreset) {
                        PresetManager.loadPreset(entry.name);
                        currentPresetName = entry.name;
                        markSelected();
                    }
                });

                grid.appendChild(tile);

                if (window.PresetManager && PresetManager.ensureThumbnail) {
                    PresetManager.ensureThumbnail(entry.name).then(function(url) {
                        if (url) img.src = url;
                    });
                }
            });
            markSelected();
        }

        function markSelected() {
            grid.querySelectorAll('.tt-gallery-tile').forEach(function(t) {
                t.classList.toggle('selected', t.dataset.preset === currentPresetName);
            });
        }

        function filterTiles() {
            const q = (search.value || '').toLowerCase();
            grid.querySelectorAll('.tt-gallery-tile').forEach(function(t) {
                const name = (t.dataset.preset || '').toLowerCase();
                const cat = (t.dataset.category || '').toLowerCase();
                t.style.display = (name.indexOf(q) !== -1 || cat.indexOf(q) !== -1) ? '' : 'none';
            });
        }
    }

    // ===== LOCAL PROJECT MANAGEMENT (.txm + .webp) =====
    function initProjectManager() {
        const pickBtn = document.getElementById('tt-project-pick-btn');
        const saveBtn = document.getElementById('tt-project-save-btn');
        const status = document.getElementById('tt-project-status');
        const list = document.getElementById('tt-projects-list');
        if (!pickBtn || !saveBtn || !list) return;

        function setStatus(msg) {
            if (status) status.textContent = msg || '';
        }

        function refreshProjects() {
            if (!window.PresetManager || !PresetManager.hasProjectDirectory()) return;
            list.innerHTML = '';
            PresetManager.listProjects().then(function(names) {
                if (!names.length) { setStatus('No projects in folder.'); return; }
                setStatus(names.length + ' project(s) in "' + PresetManager.getProjectDirectoryName() + '"');
                names.forEach(function(name) {
                    const li = document.createElement('li');
                    li.className = 'tt-project-item';
                    li.dataset.project = name;

                    const thumb = document.createElement('img');
                    thumb.alt = name;
                    PresetManager.readProjectThumbnailUrl(name).then(function(u) { if (u) thumb.src = u; });

                    const span = document.createElement('span');
                    span.textContent = name;

                    const openBtn = document.createElement('button');
                    openBtn.textContent = 'Open';
                    openBtn.addEventListener('click', function() { openProject(name); });

                    const delBtn = document.createElement('button');
                    delBtn.textContent = 'Delete';
                    delBtn.className = 'tt-project-delete';
                    delBtn.addEventListener('click', function() { deleteProject(name); });

                    li.appendChild(thumb);
                    li.appendChild(span);
                    li.appendChild(openBtn);
                    li.appendChild(delBtn);
                    list.appendChild(li);
                });
            }).catch(function(e) {
                setStatus('Error listing projects: ' + e.message);
            });
        }

        function pickDirectory() {
            return window.PresetManager.pickProjectDirectory().then(function() {
                setStatus('Folder: "' + PresetManager.getProjectDirectoryName() + '"');
                refreshProjects();
            }).catch(function(e) {
                if (e && e.name !== 'AbortError') setStatus(e.message || 'Could not open folder');
            });
        }

        function ensureDir() {
            if (window.PresetManager && PresetManager.hasProjectDirectory()) return Promise.resolve();
            return pickDirectory();
        }

        function openProject(name) {
            window.PresetManager.openProject(name).then(function() {
                currentPresetName = null;
                setStatus('Opened "' + name + '"');
            }).catch(function(e) { setStatus('Error opening project: ' + e.message); });
        }

        function deleteProject(name) {
            if (!confirm('Delete project "' + name + '" (.txm and .webp)?')) return;
            window.PresetManager.deleteProject(name).then(function() {
                setStatus('Deleted "' + name + '"');
                refreshProjects();
            }).catch(function(e) { setStatus('Error deleting project: ' + e.message); });
        }

        pickBtn.addEventListener('click', pickDirectory);

        saveBtn.addEventListener('click', function() {
            if (!editor) return;
            ensureDir().then(function() {
                return window.PresetManager.saveProject(editor.getSettings().text, editor.getSettings());
            }).then(function(res) {
                setStatus('Saved "' + res.name + '" (.txm + .webp)');
                refreshProjects();
            }).catch(function(e) {
                if (e && e.name !== 'AbortError') setStatus('Error saving project: ' + e.message);
            });
        });

        if (window.PresetManager && PresetManager.hasProjectDirectory()) refreshProjects();
    }

    // Expose init
    window.Controls = {
        init: init,
        refreshUndoControls: refreshUndoControls
    };
})();
