/* ===== SPECULAR LIGHTING WEBGL ENGINE =====
 * WebGL-based specular lighting effect for text rendering
 * Creates realistic specular highlights with customizable light source
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

    // Fragment shader - specular lighting with normal-based calculation
    const fragmentShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_image;
        uniform sampler2D u_normalMap;
        uniform sampler2D u_heightMap;
        uniform vec2 u_texelSize;
        uniform float u_surfaceScale;
        uniform float u_specularConstant;
        uniform float u_specularExponent;
        uniform vec3 u_lightColor;
        uniform vec3 u_lightDirection;
        uniform float u_ambientIntensity;
        uniform float u_diffuseIntensity;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Skip transparent pixels
            if (color.a < 0.01) {
                gl_FragColor = color;
                return;
            }
            
            // Get normal from normal map
            vec3 normal = texture2D(u_normalMap, v_texCoord).rgb;
            if (normal == vec3(0.0)) {
                // Compute normal from height map gradient
                float heightL = texture2D(u_heightMap, v_texCoord - vec2(u_texelSize.x, 0.0)).r;
                float heightR = texture2D(u_heightMap, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
                float heightT = texture2D(u_heightMap, v_texCoord - vec2(0.0, u_texelSize.y)).r;
                float heightB = texture2D(u_heightMap, v_texCoord + vec2(0.0, u_texelSize.y)).r;
                
                vec3 dx = vec3(2.0 * u_texelSize.x, (heightR - heightL) * u_surfaceScale, 0.0);
                vec3 dy = vec3(0.0, (heightB - heightT) * u_surfaceScale, 2.0 * u_texelSize.y);
                normal = normalize(cross(dx, dy));
            }
            
            // Normalize normal from [0,1] to [-1,1]
            normal = normal * 2.0 - 1.0;
            
            // Normalize light direction
            vec3 L = normalize(u_lightDirection);
            
            // View direction (assumed to be straight on)
            vec3 V = vec3(0.0, 0.0, 1.0);
            
            // Halfway vector for Blinn-Phong
            vec3 H = normalize(L + V);
            
            // Calculate lighting components
            float NdotL = max(dot(normal, L), 0.0); // Diffuse
            float NdotH = max(dot(normal, H), 0.0); // Specular
            
            // Diffuse term
            float diffuse = NdotL * u_diffuseIntensity;
            
            // Specular term (Blinn-Phong)
            float specular = pow(NdotH, u_specularExponent) * u_specularConstant;
            
            // Ambient term
            float ambient = u_ambientIntensity;
            
            // Combine lighting
            vec3 lighting = u_lightColor * (ambient + diffuse + specular);
            
            // Apply lighting to color
            vec3 finalColor = color.rgb * lighting;
            
            // Add specular highlight on top
            finalColor += u_lightColor * specular * 0.5;
            
            gl_FragColor = vec4(finalColor, color.a);
        }
    `;

    class SpecularWebGLEngine {
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
                    console.warn('WebGL not supported, falling back to canvas specular');
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
                surfaceScale = 1.0,
                specularConstant = 0.5,
                specularExponent = 32.0,
                lightColor = [1.0, 1.0, 1.0],
                lightDirection = [0.5, 0.5, 1.0],
                ambientIntensity = 0.3,
                diffuseIntensity = 0.5
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
            const heightMapTexture = this.createHeightMap(sourceCanvas);

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
            gl.uniform1i(gl.getUniformLocation(this.program, 'u_heightMap'), 5);
            gl.uniform2f(gl.getUniformLocation(this.program, 'u_texelSize'), 1.0/width, 1.0/height);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_surfaceScale'), surfaceScale);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_specularConstant'), specularConstant);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_specularExponent'), specularExponent);
            gl.uniform3fv(gl.getUniformLocation(this.program, 'u_lightColor'), lightColor);
            gl.uniform3fv(gl.getUniformLocation(this.program, 'u_lightDirection'), lightDirection);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_ambientIntensity'), ambientIntensity);
            gl.uniform1f(gl.getUniformLocation(this.program, 'u_diffuseIntensity'), diffuseIntensity);

            // Bind textures
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, imageTexture);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, normalMapTexture);
            
            gl.activeTexture(gl.TEXTURE5);
            gl.bindTexture(gl.TEXTURE_2D, heightMapTexture);

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
            gl.deleteTexture(heightMapTexture);
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
            // Create normal map from alpha channel
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
                    
                    // Sample neighbors with larger kernel for smoother normals
                    const left = x > 1 ? imageData.data[((y * width) + (x - 2)) * 4 + 3] : 0;
                    const right = x < width - 2 ? imageData.data[((y * width) + (x + 2)) * 4 + 3] : 0;
                    const top = y > 1 ? imageData.data[((y - 2) * width + x) * 4 + 3] : 0;
                    const bottom = y < height - 2 ? imageData.data[((y + 2) * width + x) * 4 + 3] : 0;
                    
                    // Compute normal with larger kernel
                    const dx = (right - left) / 510.0;
                    const dy = (bottom - top) / 510.0;
                    
                    // Store normal (x, y, z) in RGB, normalized to [0,1]
                    normalData.data[idx] = Math.floor((dx + 1) * 127.5);     // R
                    normalData.data[idx + 1] = Math.floor((dy + 1) * 127.5);   // G
                    normalData.data[idx + 2] = 255;                            // B (z = 1)
                    normalData.data[idx + 3] = 255;                            // A
                }
            }
            
            normalCtx.putImageData(normalData, 0, 0);
            return this.createTexture(normalCanvas);
        }

        createHeightMap(canvas) {
            // Create height map from alpha channel
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            
            const heightCanvas = document.createElement('canvas');
            heightCanvas.width = width;
            heightCanvas.height = height;
            const heightCtx = heightCanvas.getContext('2d');
            
            const imageData = ctx.getImageData(0, 0, width, height);
            const heightData = heightCtx.createImageData(width, height);
            
            for (let i = 0; i < imageData.data.length; i += 4) {
                // Use alpha as height
                heightData.data[i] = imageData.data[i + 3];     // R = alpha
                heightData.data[i + 1] = imageData.data[i + 3]; // G = alpha
                heightData.data[i + 2] = imageData.data[i + 3]; // B = alpha
                heightData.data[i + 3] = 255;                    // A
            }
            
            heightCtx.putImageData(heightData, 0, 0);
            return this.createTexture(heightCanvas);
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
        module.exports = SpecularWebGLEngine;
    } else {
        window.SpecularWebGLEngine = SpecularWebGLEngine;
    }
})();
