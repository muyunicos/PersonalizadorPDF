/* ===== TEXTSTUDIO FONTS - TTF Font Loading ===== */

(function() {
    'use strict';

    var fontRegistry = {
        '28days-later': { name: '28 Days Later Cyr Regular', path: 'fonts/28days-later.ttf' },
        'nintender': { name: 'Nintender Regular', path: 'fonts/nintender.ttf' },
        'lemon-milk': { name: 'LEMON MILK Pro UltraBold', path: 'fonts/lemon-milk.ttf' }
    };

    // TextStudio font ID → local registry key
    var textStudioFontMap = {
        '832.ttf': '28days-later',
        '4322.ttf': 'nintender',
        '11768.ttf': 'lemon-milk'
    };

    // TextStudio font name → local registry key
    var nameToKeyMap = {
        '28 Days Later Cyr Regular': '28days-later',
        '28 Days Later': '28days-later',
        'Nintender Regular': 'nintender',
        'Nintender': 'nintender',
        'LEMON MILK Pro UltraBold': 'lemon-milk',
        'LEMON MILK': 'lemon-milk'
    };

    // Google Fonts fallback mapping
    var googleFontFallbacks = {
        '28days-later': 'Creepster',
        'nintender': 'Press Start 2P',
        'lemon-milk': 'Kanit',
        'Bangers': 'Bangers',
        'Permanent Marker': 'Permanent Marker',
        'Rock Salt': 'Rock Salt',
        'Anton': 'Anton',
        'Oswald': 'Oswald',
        'Montserrat': 'Montserrat',
        'Pacifico': 'Pacifico',
        'Press Start 2P': 'Press Start 2P',
        'Creepster': 'Creepster',
        'Share Tech Mono': 'Share Tech Mono',
        'Rubik Wet Paint': 'Rubik Wet Paint',
        'Carter One': 'Carter One',
        'Fascinate': 'Fascinate',
        'Kanit': 'Kanit',
        'Bebas Neue': 'Bebas Neue',
        'Freckle Dragon': 'Freckle Dragon',
        'Lobster': 'Lobster',
        'Raleway': 'Raleway',
        'Open Sans': 'Open Sans',
        'Lato': 'Lato',
        'Playfair Display': 'Playfair Display',
        'Merriweather': 'Merriweather',
        'Source Sans Pro': 'Source Sans Pro',
        'Nunito': 'Nunito',
        'Poppins': 'Poppins',
        'Ubuntu': 'Ubuntu',
        'Righteous': 'Righteous',
        'Abril Fatface': 'Abril Fatface',
        'Satisfy': 'Satisfy',
        'Dancing Script': 'Dancing Script',
        'Indie Flower': 'Indie Flower',
        'Shadows Into Light': 'Shadows Into Light',
        'Architects Daughter': 'Architects Daughter',
        'Patrick Hand': 'Patrick Hand',
        'Kalam': 'Kalam',
        'Amatic SC': 'Amatic SC',
        'Caveat': 'Caveat',
        'Zeyada': 'Zeyada',
        'Great Vibes': 'Great Vibes',
        'Alex Brush': 'Alex Brush',
        'Allura': 'Allura',
        'Sacramento': 'Sacramento',
        'Tangerine': 'Tangerine',
        'Quicksand': 'Quicksand',
        'Work Sans': 'Work Sans',
        'Josefin Sans': 'Josefin Sans',
        'Quattrocento Sans': 'Quattrocento Sans',
        'Crimson Text': 'Crimson Text',
        'Libre Baskerville': 'Libre Baskerville',
        'PT Sans': 'PT Sans',
        'Source Serif Pro': 'Source Serif Pro',
        'Slabo 27px': 'Slabo 27px',
        'Arimo': 'Arimo',
        'Arvo': 'Arvo',
        'Lora': 'Lora',
        'Vollkorn': 'Vollkorn'
    };

    // Font categories
    var fontCategories = {
        'display': ['Bangers', 'Anton', 'Bebas Neue', 'Righteous', 'Abril Fatface', 'Fascinate', 'Creepster', 'Freckle Dragon'],
        'handwriting': ['Permanent Marker', 'Rock Salt', 'Pacifico', 'Satisfy', 'Dancing Script', 'Indie Flower', 'Shadows Into Light', 'Architects Daughter', 'Patrick Hand', 'Kalam', 'Amatic SC', 'Caveat', 'Zeyada', 'Great Vibes', 'Alex Brush', 'Allura', 'Sacramento', 'Tangerine'],
        'sans-serif': ['Oswald', 'Montserrat', 'Open Sans', 'Lato', 'Source Sans Pro', 'Nunito', 'Poppins', 'Ubuntu', 'Quicksand', 'Work Sans', 'Josefin Sans', 'Quattrocento Sans', 'PT Sans', 'Arimo', 'Roboto', 'Kanit'],
        'serif': ['Playfair Display', 'Merriweather', 'Crimson Text', 'Libre Baskerville', 'Source Serif Pro', 'Slabo 27px', 'Arvo', 'Lora', 'Vollkorn'],
        'monospace': ['Press Start 2P', 'Share Tech Mono'],
        'gaming': ['Press Start 2P', 'Creepster', 'Rubik Wet Paint']
    };

    var loadedFonts = {};
    var loadingPromises = {};
    var customFonts = {}; // Store user-uploaded fonts

    function registerTextStudioFont(src, name) {
        if (!src || !/\.ttf$/i.test(src)) return null;
        var key = 'ts-' + src.replace(/\.ttf$/i, '');
        if (!fontRegistry[key]) {
            fontRegistry[key] = {
                name: name || ('TextStudio Font ' + src),
                path: 'https://textstudio.com/fonts/' + src
            };
        }
        return key;
    }

    function registerCustomFont(name, dataUrl) {
        var key = 'custom-' + Date.now();
        fontRegistry[key] = {
            name: name,
            path: dataUrl,
            isCustom: true
        };
        customFonts[key] = { name: name, dataUrl: dataUrl };
        saveCustomFonts();
        return key;
    }

    function saveCustomFonts() {
        try {
            localStorage.setItem('textmuy_custom_fonts', JSON.stringify(customFonts));
        } catch (e) {
            console.warn('Failed to save custom fonts:', e);
        }
    }

    function loadCustomFonts() {
        try {
            var saved = localStorage.getItem('textmuy_custom_fonts');
            if (saved) {
                customFonts = JSON.parse(saved);
                Object.keys(customFonts).forEach(function(key) {
                    fontRegistry[key] = {
                        name: customFonts[key].name,
                        path: customFonts[key].dataUrl,
                        isCustom: true
                    };
                });
            }
        } catch (e) {
            console.warn('Failed to load custom fonts:', e);
        }
    }

    function resolveFontFromPreset(font) {
        if (!font) return 'Bangers';
        if (typeof font === 'string') {
            if (fontRegistry[font]) return font;
            if (textStudioFontMap[font]) return textStudioFontMap[font];
            if (/^\d+\.ttf$/i.test(font)) return registerTextStudioFont(font) || font;
            return font;
        }
        if (font.src) {
            if (textStudioFontMap[font.src]) return textStudioFontMap[font.src];
            if (fontRegistry[font.src]) return font.src;
            var tsKey = registerTextStudioFont(font.src, font.name);
            if (tsKey) return tsKey;
        }
        if (font.name) {
            if (nameToKeyMap[font.name]) return nameToKeyMap[font.name];
            return font.name;
        }
        return 'Bangers';
    }

    function loadFont(fontKey) {
        if (loadedFonts[fontKey]) {
            return Promise.resolve(loadedFonts[fontKey]);
        }
        if (loadingPromises[fontKey]) {
            return loadingPromises[fontKey];
        }

        var fontInfo = fontRegistry[fontKey];
        if (!fontInfo) {
            // Try to use Google Fonts fallback
            var fallback = googleFontFallbacks[fontKey] || 'Bangers';
            console.warn('Font not found in registry, using fallback:', fontKey, '->', fallback);
            return Promise.resolve(fallback);
        }

        var font = new FontFace(fontInfo.name, 'url(' + fontInfo.path + ')');
        loadingPromises[fontKey] = font.load().then(function(loaded) {
            document.fonts.add(loaded);
            loadedFonts[fontKey] = fontInfo.name;
            return fontInfo.name;
        }).catch(function(err) {
            console.warn('Failed to load font ' + fontKey + ':', err);
            delete loadingPromises[fontKey];
            // Fallback to Google Fonts
            var fallback = googleFontFallbacks[fontKey] || 'Bangers';
            console.warn('Using fallback font:', fallback);
            return fallback;
        });

        return loadingPromises[fontKey];
    }

    function getFontName(fontKey) {
        if (fontRegistry[fontKey]) {
            return fontRegistry[fontKey].name;
        }
        return fontKey;
    }

    function isCustomFont(fontKey) {
        return fontKey in fontRegistry && fontRegistry[fontKey].isCustom;
    }

    function preloadAll() {
        var promises = [];
        for (var key in fontRegistry) {
            if (!key.startsWith('ts-')) {
                promises.push(loadFont(key));
            }
        }
        return Promise.all(promises);
    }

    function getAvailableFonts() {
        var fonts = [];
        for (var key in fontRegistry) {
            fonts.push({
                key: key,
                name: fontRegistry[key].name,
                isCustom: fontRegistry[key].isCustom || false
            });
        }
        return fonts.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });
    }

    function deleteCustomFont(key) {
        if (customFonts[key]) {
            delete customFonts[key];
            delete fontRegistry[key];
            delete loadedFonts[key];
            saveCustomFonts();
            return true;
        }
        return false;
    }

    // Load custom fonts from localStorage on initialization
    loadCustomFonts();

    window.FontLoader = {
        loadFont: loadFont,
        getFontName: getFontName,
        isCustomFont: isCustomFont,
        preloadAll: preloadAll,
        resolveFontFromPreset: resolveFontFromPreset,
        registerTextStudioFont: registerTextStudioFont,
        registerCustomFont: registerCustomFont,
        deleteCustomFont: deleteCustomFont,
        getAvailableFonts: getAvailableFonts,
        getFontCategories: function() { return fontCategories; },
        registry: fontRegistry,
        googleFontFallbacks: googleFontFallbacks
    };

})();
