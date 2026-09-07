/* ===== BEVEL WEBGL ENGINE =====
 * WebGL-based bevel effect for text rendering
 * Creates realistic 3D bevel with highlight and shadow
 */

(function() {
    'use strict';

    // Vertex shader - simple pass-through
    const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `;

    // Fragment shader - bevel effect with normal-based lighting
    const fragmentShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_image;
        uniform sampler2D u_normalMap;
        uniform vec2 u_texelSize;
        uniform float u_bevelSize;
        uniform float u_bevelAngle;
        uniform vec3 u_lightColor;
        uniform vec3 u_shadowColor;
        uniform float u_highlightIntensity;
        uniform float u_shadowIntensity;
        uniform float u_softness;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Skip transparent pixels
            if (color.a < 0.01) {
                gl_FragColor = color;
                return;
            }
            
            // Get normal from normal map (or compute from alpha)
            vec3 normal = texture2D(u_normalMap, v_texCoord).rgb;
            if (normal == vec3(0.0)) {
                // Compute normal from alpha gradient if no normal map
                float alphaL = texture2D(u_image, v_texCoord - vec2(u_texelSize.x, 0.0)).a;
                float alphaR = texture2D(u_image, v_texCoord + vec2(u_texelSize.x, 0.0)).a;
                float alphaT = texture2D(u_image, v_texCoord - vec2(0.0, u_texelSize.y)).a;
                float alphaB = texture2D(u_image, v_texCoord + vec2(0.0, u_texelSize.y)).a;
                
                vec3 dx = vec3(2.0 * u_texelSize.x, alphaR - alphaL, 0.0);
                vec3 dy = vec3(0.0, alphaB - alphaT, 2.0 * u_texelSize.y);
                normal = normalize(cross(dx, dy));
            }
            
            // Light direction based on bevel angle
            float angleRad = radians(u_bevelAngle);
            vec3 lightDir = normalize(vec3(cos(angleRad), sin(angleRad), 1.0));
            
            // Calculate lighting
            float diffuse = max(dot(normal, lightDir), 0.0);
            float specular = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);
            
            // Apply highlight and shadow
            vec3 highlight = u_lightColor * diffuse * u_highlightIntensity;
            vec3 shadow = u_shadowColor * (1.0 - diffuse) * u_shadowIntensity;
            
            // Soft edge based on alpha
            float edge = smoothstep(0.0, u_softness, color.a);
            
            // Combine
            vec3 finalColor = color.rgb + highlight * edge - shadow * edge;
            
            gl_FragColor = vec4(finalColor, color.a);
        }
    `;

    class BevelWebGLEngine {
        constructor() {
            this.gl = null;
            this.program = null;
            this.vertexShader = null;
            this.fragmentShader = null;
            this.initialized = false;
        }

        init(canvas) {
            try {
                this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!this.gl) {
                    console.warn('WebGL not supported, falling back to canvas bevel');
                    return false;
                }

                // Create shaders
                const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
                const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
                this.vertexShader = vertexShader;
                this.fragmentShader = fragmentShader;

                // Create program
                this.program = this.gl.createProgram();
                this.gl.attachShader(this.program, vertexShader);
                this.gl.attachShader(this.program, fragmentShader);
                this.gl.linkProgram(this.program);

                if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
                    console.error('Shader program link error:', this.gl.getProgramInfoLog(this.program));
                    return false;
                }

                this.initialized = true;
                return true;
            } catch (e) {
                console.error('WebGL initialization error:', e);
                return false;
            }
        }

        createShader(type, source) {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);

            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
                this.gl.deleteShader(shader);
                return null;
            }

            return shader;
        }

        apply(sourceCanvas, options = {}) {
            if (!this.initialized) {
                return null;
            }

            const {
                bevelSize = 0.1,
                bevelAngle = 135,
                lightColor = [1.0, 1.0, 1.0],
                shadowColor = [0.0, 0.0, 0.0],
                highlightIntensity = 0.5,
                shadowIntensity = 0.5,
                softness = 0.1
            } = options;

            const gl = this.gl;
            const width = sourceCanvas.width;
            const height = sourceCanvas.height;

            // Create output canvas
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = width;
            outputCanvas.height = height;
            const outputCtx = outputCanvas.getContext('2d');

            // Setup viewport
            gl.viewport(0, 0, width, height);

            // Create textures
            const imageTexture = this.createTexture(sourceCanvas);
            const normalMapTexture = this.createNormalMap(sourceCanvas);

            // Create framebuffer
            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

            // Create renderbuffer for color attachment
            const renderbuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, width, height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, renderbuffer);

            // Use program
            gl.useProgram(this.program);

            // Setup geometry (full quad)
            const positions = new Float32Array([
                -1, -1,  1, -1,  -1, 1,
                -1,  1,  1, -1,   1, 1
            ]);
            const texCoords = new Float32Array([
                0, 1,  1, 1,  0, 0,
                0, 0,  1, 1,  1, 0
            ]);

            // Position buffer
            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            const positionLoc = gl.getAttribLocation(this.program, 'a_position');
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

            // TexCoord buffer
            const texCoordBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
            const texCoordLoc = gl.getAttribLocation(this.program, 'a_texCoord');
            gl.enableVertexAttribArray(texCoordLoc);
            gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

            // Set uniforms
            gl.uniform1i(gl.getUniformLocation(this.program, 'u_image'), 0);
            gl.uniform1i(gl.getUniformLocation(this.program, 'u_normalMap'), 1);
            gl.uniform2f(gl.getUniformLocation(this.program, 'u_texelSize'), 1.0/width, 1.0/height);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_bevelSize'), bevelSize);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_bevelAngle'), bevelAngle);
            gl.uniform3fv(gl.getUniformLocation(this.program, 'u_lightColor'), lightColor);
            gl.uniform3fv(gl.getUniformLocation(this.program, 'u_shadowColor'), shadowColor);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_highlightIntensity'), highlightIntensity);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_shadowIntensity'), shadowIntensity);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_softness'), softness);

            // Bind textures
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, imageTexture);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, normalMapTexture);

            // Draw
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // Read back to canvas
            const pixels = new Uint8Array(width * height * 4);
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            const imageData = outputCtx.createImageData(width, height);
            imageData.data.set(pixels);
            outputCtx.putImageData(imageData, 0, 0);

            // Cleanup
            gl.deleteTexture(imageTexture);
            gl.deleteTexture(normalMapTexture);
            gl.deleteFramebuffer(framebuffer);
            gl.deleteRenderbuffer(renderbuffer);
            gl.deleteBuffer(positionBuffer);
            gl.deleteBuffer(texCoordBuffer);

            return outputCanvas;
        }

        createTexture(canvas) {
            const gl = this.gl;
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            return texture;
        }

        createNormalMap(canvas) {
            // Create a simple normal map from the alpha channel
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            
            const normalCanvas = document.createElement('canvas');
            normalCanvas.width = width;
            normalCanvas.height = height;
            const normalCtx = normalCanvas.getContext('2d');
            
            const imageData = ctx.getImageData(0, 0, width, height);
            const normalData = normalCtx.createImageData(width, height);
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // Sample neighbors
                    const left = x > 0 ? imageData.data[((y * width) + (x - 1)) * 4 + 3] : 0;
                    const right = x < width - 1 ? imageData.data[((y * width) + (x + 1)) * 4 + 3] : 0;
                    const top = y > 0 ? imageData.data[((y - 1) * width + x) * 4 + 3] : 0;
                    const bottom = y < height - 1 ? imageData.data[((y + 1) * width + x) * 4 + 3] : 0;
                    
                    // Compute normal
                    const dx = (right - left) / 255.0;
                    const dy = (bottom - top) / 255.0;
                    
                    // Store normal (x, y, z) in RGB
                    normalData.data[idx] = Math.floor((dx + 1) * 127.5);     // R
                    normalData.data[idx + 1] = Math.floor((dy + 1) * 127.5);   // G
                    normalData.data[idx + 2] = 255;                            // B (z = 1)
                    normalData.data[idx + 3] = 255;                            // A
                }
            }
            
            normalCtx.putImageData(normalData, 0, 0);
            return this.createTexture(normalCanvas);
        }

        destroy() {
            const gl = this.gl;
            if (gl) {
                if (this.program) gl.deleteProgram(this.program);
                if (this.vertexShader) gl.deleteShader(this.vertexShader);
                if (this.fragmentShader) gl.deleteShader(this.fragmentShader);
                const lose = gl.getExtension('WEBGL_lose_context');
                if (lose) lose.loseContext();
            }
            this.gl = null;
            this.program = null;
            this.vertexShader = null;
            this.fragmentShader = null;
            this.initialized = false;
        }
    }

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BevelWebGLEngine;
    } else {
        window.BevelWebGLEngine = BevelWebGLEngine;
    }
})();
