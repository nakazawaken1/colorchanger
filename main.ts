(() => {
    const view = { name: "T2202-03", x: 0, y: 0 };
    function render(image: HTMLImageElement) {
        const canvas = document.querySelector("canvas");
        if (!canvas) throw "canvasが見つかりません";
        const range = document.querySelector("input");
        const value = document.querySelector("span");
        const gl = canvas.getContext('webgl');
        if (!gl) throw "WebGLが使えないため処理ができませんでした";

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vertexShader) throw "バーテックスシェーダが作成できませんでした";
        gl.shaderSource(vertexShader, `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
varying vec2 vTextureCoord;
uniform vec2 uResolution;
void main() {
vec2 zeroToOne = aVertexPosition / uResolution;
vec2 zeroToTwo = zeroToOne * 2.0;
vec2 clipSpace = zeroToTwo - 1.0;
gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
vTextureCoord = aTextureCoord;
}
`);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(vertexShader);
            gl.deleteShader(vertexShader);
            throw 'vertexShaderにコンパイルエラーがあります：' + error;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (!fragmentShader) throw "フラグメントシェーダが作成できませんでした";
        gl.shaderSource(fragmentShader, `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uHue;

vec3 rgb2hsv(vec3 c)
{
vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

float d = q.x - min(q.w, q.y);
float e = 1.0e-10;
return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c)
{
vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main(void) {
vec4 color = texture2D(uTexture, vTextureCoord);
vec3 hsv = rgb2hsv(color.rgb);
hsv.x = mod(hsv.x + uHue, 1.0);
gl_FragColor = vec4(hsv2rgb(hsv), 1.0);
}
`);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(fragmentShader);
            gl.deleteShader(fragmentShader);
            throw 'fragmentShaderにコンパイルエラーがあります：' + error;
        }

        const program = gl.createProgram();
        if (!program) throw "プログラムが作成できませんでした";
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw 'プログラムを初期化できませんでした：' + gl.getProgramInfoLog(program);
        }

        const vertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
        const textureCoord = gl.getAttribLocation(program, 'aTextureCoord');
        const resolution = gl.getUniformLocation(program, "uResolution");
        const hue = gl.getUniformLocation(program, "uHue");

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0,
            image.width, 0.0,
            0.0, image.height,
            0.0, image.height,
            image.width, 0.0,
            image.width, image.height]), gl.STATIC_DRAW);

        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0]), gl.STATIC_DRAW);

        // 「テクスチャー」を生成する
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // どんなサイズの画像でもレンダリングできるようにパラメータを設定する
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // テクスチャーに画像のデータをアップロードする
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        const draw = () => {
            gl.canvas.width = canvas.clientWidth;
            gl.canvas.height = canvas.clientHeight;
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);

            gl.enableVertexAttribArray(vertexPosition);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);

            gl.enableVertexAttribArray(textureCoord);
            gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
            gl.vertexAttribPointer(textureCoord, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(resolution, image.width, image.height);
            if (range) gl.uniform1f(hue, Number(range.value));

            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        function onchange() {
            const hsv = rgb2hsv(255, 0, 0);
            const changedHsv = { h: Math.floor(hsv.h + Number(range!.value) * 360) % 360, s: hsv.s, v: hsv.v };
            const rgb = hsv2rgb(changedHsv.h, changedHsv.s, changedHsv.v);
            if (value && range) value.textContent = `H(${Number(range.value).toFixed(2)}) RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            draw();
        }
        if (range) range.onchange = onchange;
        onchange();
    }
    function rgb2hsv(r: number, g: number, b: number) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const hsv = { 'h': 0, 's': 0, 'v': max };

        if (max != min) {
            if (max == r) hsv.h = 60 * (g - b) / (max - min);
            if (max == g) hsv.h = 60 * (b - r) / (max - min) + 120;
            if (max == b) hsv.h = 60 * (r - g) / (max - min) + 240;
            hsv.s = (max - min) / max;
        }

        if (hsv.h < 0) {
            hsv.h = hsv.h + 360;
        }

        hsv.h = Math.round(hsv.h);
        hsv.s = Math.round(hsv.s * 100);
        hsv.v = Math.round((hsv.v / 255) * 100);
        return hsv;
    }
    function hsv2rgb(h: number, s: number, v: number) {
        const max = v;
        const min = max - ((s / 255) * max);
        const rgb = { 'r': 0, 'g': 0, 'b': 0 };

        if (h == 360) {
            h = 0;
        }

        s = s / 100;
        v = v / 100;

        if (s == 0) {
            rgb.r = v * 255;
            rgb.g = v * 255;
            rgb.b = v * 255;
            return rgb;
        }

        const dh = Math.floor(h / 60);
        const p = v * (1 - s);
        const q = v * (1 - s * (h / 60 - dh));
        const t = v * (1 - s * (1 - (h / 60 - dh)));

        switch (dh) {
            case 0: rgb.r = v; rgb.g = t; rgb.b = p; break;
            case 1: rgb.r = q; rgb.g = v; rgb.b = p; break;
            case 2: rgb.r = p; rgb.g = v; rgb.b = t; break;
            case 3: rgb.r = p; rgb.g = q; rgb.b = v; break;
            case 4: rgb.r = t; rgb.g = p; rgb.b = v; break;
            case 5: rgb.r = v; rgb.g = p; rgb.b = q; break
        }

        rgb.r = Math.round(rgb.r * 255);
        rgb.g = Math.round(rgb.g * 255);
        rgb.b = Math.round(rgb.b * 255);
        return rgb;
    }

    window.onerror = (e) => document.querySelector("body")!.textContent = e.toString();
    window.onload = () => {
        const image = new Image();
        image.src = `${view.name}/x-${view.x % 7}_${view.name}_1.${view.y % 17 + 1}.png`;
        image.onload = () => render(image);
    }
})();