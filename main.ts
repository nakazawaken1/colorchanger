(() => {
    const view = { h: 0, name: "T2202-03", x: 0, y: 0, z: 0, dragging: false };
    const W = 512;
    const H = 512;
    const X = 17;
    const Y = 7;
    const SX = 0.1;
    const SY = 0.2;
    const load = async (url: string): Promise<HTMLImageElement> => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.src = url;
    });
    async function render() {
        const canvas = document.querySelector("canvas");
        if (!canvas) throw "canvasが見つかりません";
        const range = document.querySelector("input");
        const value = document.querySelector("span");
        const gl = canvas.getContext('webgl2', { antialias: false });
        if (!gl) throw "WebGLが使えないため処理ができませんでした";

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vertexShader) throw "バーテックスシェーダが作成できませんでした";
        gl.shaderSource(vertexShader, `#version 300 es
in vec2 aVertexPosition;
in vec2 aTextureCoord;
out vec2 vTextureCoord;
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
        gl.shaderSource(fragmentShader, `#version 300 es
precision mediump float;
precision mediump sampler2DArray;

in vec2 vTextureCoord;
out vec4 oFragColor;
uniform sampler2DArray uTexture;
uniform float uHue;
uniform float uIndex;

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
    vec4 color = texture(uTexture, vec3(vTextureCoord, uIndex));
    vec3 hsv = rgb2hsv(color.rgb);
    hsv.x = mod(hsv.x + uHue, 1.0);
    oFragColor = vec4(hsv2rgb(hsv), 1.0);
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

        const aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
        const aTextureCoord = gl.getAttribLocation(program, 'aTextureCoord');
        const uResolution = gl.getUniformLocation(program, "uResolution");
        const uHue = gl.getUniformLocation(program, "uHue");
        const uIndex = gl.getUniformLocation(program, "uIndex");
        const uTexture = gl.getUniformLocation(program, "uTexture");

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0,
            W, 0.0,
            0.0, H,
            0.0, H,
            W, 0.0,
            W, H]), gl.STATIC_DRAW);

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
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
        gl.texStorage3D(
            gl.TEXTURE_2D_ARRAY,
            Math.floor(Math.log(W) / Math.log(2)) + 1,
            gl.RGBA8,
            W,
            H,
            X * Y
        );
        // どんなサイズの画像でもレンダリングできるようにパラメータを設定する
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        //画像を読み込む
        const temporaryCanvas = document.createElement('canvas');
        temporaryCanvas.width = W;
        temporaryCanvas.height = H;
        const context = temporaryCanvas.getContext('2d');
        if (!context) throw "2Dコンテクストが取得できません";
        for (let x = 0; x < X; x++) {
            for (let y = 0; y < Y; y++) {
                const image = await load(`${view.name}/x-${Math.floor(y) % Y}_${view.name}_1.${X - Math.floor(x) % X}.png`);
                context.drawImage(image, 0, 0);
                gl.texSubImage3D(
                    gl.TEXTURE_2D_ARRAY,
                    0,
                    0,
                    0,
                    x * Y + y,
                    W,
                    H,
                    1,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    context.getImageData(0, 0, W, H)
                );
            }
        }

        const draw = () => {
            const hsv = rgb2hsv(255, 0, 0);
            const changedHsv = { h: Math.floor(hsv.h + view.h * 360) % 360, s: hsv.s, v: hsv.v };
            const rgb = hsv2rgb(changedHsv.h, changedHsv.s, changedHsv.v);
            if (value) value.textContent = `H(${Number(range?.value).toFixed(2)}) RGB(${rgb.r}, ${rgb.g}, ${rgb.b}) x:${view.x.toFixed(1)} y:${view.y.toFixed(1)} z:${view.z.toFixed(1)}`;

            gl.canvas.width = canvas.clientWidth;
            gl.canvas.height = canvas.clientHeight;
            gl.viewport(view.z, view.z, gl.canvas.width - view.z, gl.canvas.height - view.z);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);

            gl.enableVertexAttribArray(aVertexPosition);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);

            gl.enableVertexAttribArray(aTextureCoord);
            gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
            gl.vertexAttribPointer(aTextureCoord, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(uResolution, W, H);
            gl.uniform1f(uIndex, view.x * Y + view.y);
            gl.uniform1i(uTexture, 0);
            if (range) gl.uniform1f(uHue, Number(range.value));

            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        if (range) range.onchange = () => {
            view.h = Number(range.value);
            draw();
        };
        canvas.onmousedown = (e: MouseEvent) => view.dragging = true;
        canvas.onmouseleave = canvas.onmouseup = (e: MouseEvent) => view.dragging = false;
        canvas.onmousemove = (e: MouseEvent) => {
            if (view.dragging) {
                view.x += e.movementX / X;
                while (view.x < 0) view.x += X;
                while (view.x >= X) view.x -= X;
                view.y += e.movementY / Y;
                if (view.y < 0) view.y = 0;
                else if (view.y >= Y) view.y = Y - 1;
                draw();
            }
        };
        canvas.onwheel = (e: WheelEvent) => {
            view.z += e.deltaY / 10;
            draw();
        }
        draw();
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
    window.onload = () => render();
})();