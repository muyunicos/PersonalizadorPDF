/* ===== ARC DISTORT ENGINE =====
 * Curves a finished transparent text layer.  Keeping this operation at the
 * bitmap level means fills, outlines, shadows and icons remain registered.
 */

(function() {
    'use strict';

    const TAU = Math.PI * 2;
    const HALF_PI = Math.PI / 2;
    const DEG_TO_RAD = Math.PI / 180;

    function normalizeAngle(angle) {
        let value = angle;
        while (value <= -Math.PI) value += TAU;
        while (value > Math.PI) value -= TAU;
        return value;
    }

    function anglesInSweep(start, end) {
        const values = [start, end];
        const firstQuarter = Math.ceil(start / HALF_PI);
        const lastQuarter = Math.floor(end / HALF_PI);
        for (let step = firstQuarter; step <= lastQuarter; step++) {
            values.push(step * HALF_PI);
        }
        return values;
    }

    /**
     * Geometry for a raster arc.  The source image is laid on the outside of
     * the circle, which preserves the TextStudio-style positive/negative arc
     * direction without treating glyphs as independent objects.
     */
    function getArcGeometry(width, height, angle) {
        const sourceWidth = Math.max(1, Number(width) || 1);
        const sourceHeight = Math.max(1, Number(height) || 1);
        const degrees = Number(angle) || 0;
        const sweep = Math.abs(degrees) * DEG_TO_RAD;

        if (sweep < 0.001) {
            return {
                curved: false,
                width: Math.ceil(sourceWidth),
                height: Math.ceil(sourceHeight),
                minX: 0,
                minY: 0,
                radius: 0,
                sweep: 0,
                centerAngle: 0,
                sourceWidth: sourceWidth,
                sourceHeight: sourceHeight
            };
        }

        const direction = degrees >= 0 ? 1 : -1;
        // Keep the source's vertical midpoint on the requested circle in both
        // directions. This makes positive and negative arcs true mirrors.
        const radius = Math.max(0, sourceWidth / sweep + direction * (sourceHeight - 1) / 2);
        const centerAngle = degrees > 0 ? -HALF_PI : HALF_PI;
        const start = centerAngle - sweep / 2;
        const end = centerAngle + sweep / 2;
        // A negative arc reverses both axes around the lower half of the
        // circle.  This keeps text upright and in reading order instead of
        // rotating the raster 180 degrees.
        const sourceEdgeRadius = direction > 0
            ? Math.max(0, radius - (sourceHeight - 1))
            : radius + (sourceHeight - 1);
        const radii = [radius, sourceEdgeRadius];
        const angles = anglesInSweep(start, end);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        radii.forEach(function(currentRadius) {
            angles.forEach(function(currentAngle) {
                const x = currentRadius * Math.cos(currentAngle);
                const y = currentRadius * Math.sin(currentAngle);
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            });
        });

        return {
            curved: true,
            width: Math.max(1, Math.ceil(maxX - minX + 2)),
            height: Math.max(1, Math.ceil(maxY - minY + 2)),
            minX: Math.floor(minX) - 1,
            minY: Math.floor(minY) - 1,
            radius: radius,
            direction: direction,
            sweep: sweep,
            centerAngle: centerAngle,
            sourceWidth: sourceWidth,
            sourceHeight: sourceHeight
        };
    }

    class DistortEngine {
        getArcGeometry(width, height, angle) {
            return getArcGeometry(width, height, angle);
        }

        /** Return the non-transparent area while retaining a small antialiasing gutter. */
        trimTransparent(canvas, padding) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            let image;
            try {
                image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            } catch (_) {
                // A cross-origin image without CORS cannot be read.  Skipping
                // the effect is safer than breaking the editor or export path.
                return null;
            }
            const data = image.data;
            let left = canvas.width;
            let top = canvas.height;
            let right = -1;
            let bottom = -1;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    if (data[(y * canvas.width + x) * 4 + 3] !== 0) {
                        left = Math.min(left, x);
                        top = Math.min(top, y);
                        right = Math.max(right, x);
                        bottom = Math.max(bottom, y);
                    }
                }
            }

            if (right < left || bottom < top) return null;
            const gutter = padding === undefined ? 2 : Math.max(0, padding);
            left = Math.max(0, left - gutter);
            top = Math.max(0, top - gutter);
            right = Math.min(canvas.width - 1, right + gutter);
            bottom = Math.min(canvas.height - 1, bottom + gutter);

            const result = document.createElement('canvas');
            result.width = right - left + 1;
            result.height = bottom - top + 1;
            result.getContext('2d').drawImage(canvas, left, top, result.width, result.height, 0, 0, result.width, result.height);
            return result;
        }

        curve(canvas, angle) {
            const geometry = getArcGeometry(canvas.width, canvas.height, angle);
            if (!geometry.curved) return canvas;
            return this.curveWebGL(canvas, geometry) || this.curveCanvas(canvas, geometry);
        }

        curveWebGL(source, geometry) {
            let output;
            let gl;
            try {
                output = document.createElement('canvas');
                output.width = geometry.width;
                output.height = geometry.height;
                gl = output.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true });
                if (!gl || source.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) || source.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return null;

                const vertexSource = `#version 300 es
                    in vec2 a_position;
                    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
                const fragmentSource = `#version 300 es
                    precision highp float;
                    out vec4 outColor;
                    uniform sampler2D u_source;
                    uniform vec2 u_outputSize;
                    uniform vec2 u_sourceSize;
                    uniform vec2 u_min;
                    uniform float u_radius;
                    uniform float u_sweep;
                    uniform float u_center;
                    uniform float u_direction;
                    const float TAU = 6.283185307179586;
                    void main() {
                        vec2 point = vec2(gl_FragCoord.x - 0.5, u_outputSize.y - gl_FragCoord.y + 0.5) + u_min;
                        float radial = length(point);
                        float polar = atan(point.y, point.x);
                        float delta = polar - u_center;
                        delta = mod(delta + 3.141592653589793, TAU) - 3.141592653589793;
                        float minRadius = u_direction > 0.0 ? u_radius - (u_sourceSize.y - 1.0) : u_radius;
                        float maxRadius = u_direction > 0.0 ? u_radius : u_radius + (u_sourceSize.y - 1.0);
                        if (abs(delta) > u_sweep * 0.5 || radial > maxRadius || radial < minRadius) {
                            outColor = vec4(0.0);
                            return;
                        }
                        float sourceProgress = u_direction > 0.0 ? delta / u_sweep + 0.5 : 0.5 - delta / u_sweep;
                        float sx = sourceProgress * (u_sourceSize.x - 1.0);
                        float sy = (u_direction > 0.0 ? u_radius - radial : radial - u_radius) * u_sourceSize.y / max(1.0, u_sourceSize.y - 1.0);
                        vec2 uv = vec2((sx + 0.5) / u_sourceSize.x, 1.0 - (sy + 0.5) / u_sourceSize.y);
                        outColor = texture(u_source, uv);
                    }`;
                const compile = function(type, sourceCode) {
                    const shader = gl.createShader(type);
                    gl.shaderSource(shader, sourceCode);
                    gl.compileShader(shader);
                    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
                    return shader;
                };
                const program = gl.createProgram();
                gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
                gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
                gl.bindAttribLocation(program, 0, 'a_position');
                gl.linkProgram(program);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));

                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

                gl.useProgram(program);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                gl.uniform1i(gl.getUniformLocation(program, 'u_source'), 0);
                gl.uniform2f(gl.getUniformLocation(program, 'u_outputSize'), geometry.width, geometry.height);
                gl.uniform2f(gl.getUniformLocation(program, 'u_sourceSize'), source.width, source.height);
                gl.uniform2f(gl.getUniformLocation(program, 'u_min'), geometry.minX, geometry.minY);
                gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), geometry.radius);
                gl.uniform1f(gl.getUniformLocation(program, 'u_sweep'), geometry.sweep);
                gl.uniform1f(gl.getUniformLocation(program, 'u_center'), geometry.centerAngle);
                gl.uniform1f(gl.getUniformLocation(program, 'u_direction'), geometry.direction);
                gl.viewport(0, 0, geometry.width, geometry.height);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                const loseCtx = gl.getExtension('WEBGL_lose_context');
                if (loseCtx) loseCtx.loseContext();
                return output;
            } catch (_) {
                return null;
            }
        }

        // Canvas2D fallback: draw narrow, tangent-aligned source strips.  It is
        // intentionally dependency-free and retains alpha when WebGL is absent.
        curveCanvas(source, geometry) {
            const output = document.createElement('canvas');
            output.width = geometry.width;
            output.height = geometry.height;
            const ctx = output.getContext('2d');
            const width = source.width;
            const denominator = Math.max(1, width - 1);

            for (let x = 0; x < width; x++) {
                const progress = geometry.direction > 0 ? x / denominator : 1 - x / denominator;
                const arcAngle = geometry.centerAngle - geometry.sweep / 2 + geometry.sweep * progress;
                const outerX = geometry.radius * Math.cos(arcAngle) - geometry.minX;
                const outerY = geometry.radius * Math.sin(arcAngle) - geometry.minY;
                const tangentX = -Math.sin(arcAngle);
                const tangentY = Math.cos(arcAngle);
                const inwardX = -Math.cos(arcAngle);
                const inwardY = -Math.sin(arcAngle);
                ctx.setTransform(
                    tangentX * geometry.direction,
                    tangentY * geometry.direction,
                    inwardX * geometry.direction,
                    inwardY * geometry.direction,
                    outerX,
                    outerY
                );
                ctx.drawImage(source, x, 0, 1, source.height, -0.5, 0, 1.25, source.height);
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            return output;
        }
    }

    DistortEngine.getArcGeometry = getArcGeometry;
    if (typeof module !== 'undefined' && module.exports) module.exports = DistortEngine;
    else window.DistortEngine = DistortEngine;
})();
