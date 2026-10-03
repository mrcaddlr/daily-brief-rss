(() => {
  const canvas = document.getElementById('liquidGlassCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'low-power'
  }) || canvas.getContext('experimental-webgl');

  if (!gl) {
    canvas.remove();
    return;
  }

  const vertex = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_uv = a_position * 0.5 + 0.5;
    }
  `;

  const fragment = \`
    precision mediump float;
    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_speed;
    uniform vec3 u_colors[5];
    uniform vec2 u_pointer;
    uniform vec4 u_shape0;
    uniform vec4 u_shape1;
    uniform vec4 u_shape2;
    uniform vec3 u_radii;
    uniform vec3 u_enabled;

    vec3 permute(vec3 x) {
      return mod(((x * 34.0) + 1.0) * x, 289.0);
    }

    float snoise(vec2 v) {
      const vec4 C = vec4(
        0.211324865405187,
        0.366025403784439,
        -0.577350269189626,
        0.024390243902439
      );

      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);

      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);

      vec3 p = permute(
        permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0)
      );

      vec3 m = max(
        0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
        ),
        0.0
      );

      m = m * m;
      m = m * m;

      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;

      m *= 1.79284291400159 -
        0.85373472095314 * (a0 * a0 + h * h);

      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;

      return 130.0 * dot(m, g);
    }

    vec3 fluidBackground(vec2 px) {
      vec2 uv = px / u_resolution.xy;
      float time = u_time * 0.15 * u_speed;
      float n1 = snoise(uv * 0.5 + vec2(time*0.1,time*0.2));
      float n2 = snoise(uv * 1.2 - vec2(time*0.2,time*0.1));
      vec2 distUV = uv + vec2(n1,n2) * 0.2;
      float mask1 = snoise(distUV*0.5 + vec2(time*0.1,0.0))*0.5+0.5;
      float mask2 = snoise(distUV*0.6 + vec2(0.0,time*0.15)+10.0)*0.5+0.5;
      float mask3 = snoise(distUV*0.4 - vec2(time*0.1,time*0.1)+20.0)*0.5+0.5;
      float mask4 = snoise(distUV*0.7 + vec2(time*0.15,-time*0.1)+30.0)*0.5+0.5;
      vec3 color = u_colors[0];
      color = mix(color,u_colors[1],mask1*0.6);
      color = mix(color,u_colors[2],mask2*0.6);
      color = mix(color,u_colors[3],mask3*0.5);
      color = mix(color,u_colors[4],mask4*0.4);
      float grain = fract(sin(dot(uv,vec2(12.9898,78.233)))*43758.5453);
      color += (grain-0.5)*0.018;
      return clamp(color,0.0,1.0);
    }
    float sdRoundBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r;
    }

    vec3 glass(vec2 px, vec4 shape, float radius) {
      vec2 p = px - shape.xy;
      float d = sdRoundBox(p, shape.zw*0.5, radius);
      float mask = 1.0 - smoothstep(-1.5,1.5,d);
      if(mask <= 0.001) return fluidBackground(px);
      float edge = 1.0 - smoothstep(-34.0,1.0,d);
      vec2 dir = normalize(p + vec2(0.001));
      float refraction = 22.0 * edge * edge;
      vec2 wave = vec2(sin(p.y*0.045 + u_time*0.72),cos(p.x*0.040 - u_time*0.64))*4.0;
      vec2 samplePx = px - dir*refraction + wave*edge;
      vec3 frost = vec3(0.0);
      float count = 0.0;
      for(int x=-1;x<=1;x++){
        for(int y=-1;y<=1;y++){
          frost += fluidBackground(samplePx + vec2(float(x),float(y))*1.5);
          count += 1.0;
        }
      }
      frost /= count;
      float ca = 3.2*edge;
      vec2 caOffset = dir*ca;
      vec3 refracted = vec3(
        fluidBackground(samplePx-caOffset).r,
        fluidBackground(samplePx).g,
        fluidBackground(samplePx+caOffset).b
      );
      refracted = mix(frost,refracted,0.78);
      refracted = mix(refracted,vec3(1.0,0.985,0.995),0.11);
      float pointerDist = distance(px,u_pointer);
      float pointerLight = 1.0-smoothstep(18.0,240.0,pointerDist);
      refracted += vec3(smoothstep(0.1,1.0,edge)*0.075 + smoothstep(0.78,1.0,edge)*0.07 + pointerLight*0.045);
      return clamp(refracted,0.0,1.0);
    }

    vec3 applyGlass(vec3 color, vec2 px, vec4 shape, float radius) {
      float d = sdRoundBox(px-shape.xy,shape.zw*0.5,radius);
      float mask = 1.0-smoothstep(-1.5,1.5,d);
      return mix(color,glass(px,shape,radius),mask);
    }

    void main() {
      vec2 px = gl_FragCoord.xy;
      vec3 color = fluidBackground(px);
      if(u_enabled.x>0.5) color=applyGlass(color,px,u_shape0,u_radii.x);
      if(u_enabled.y>0.5) color=applyGlass(color,px,u_shape1,u_radii.y);
      if(u_enabled.z>0.5) color=applyGlass(color,px,u_shape2,u_radii.z);
      gl_FragColor=vec4(color,1.0);
    }  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) {
    canvas.remove();
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    canvas.remove();
    return;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
    gl.STATIC_DRAW
  );

  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const u = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    time: gl.getUniformLocation(program, 'u_time'),
    speed: gl.getUniformLocation(program, 'u_speed'),
    colors: [
      gl.getUniformLocation(program, 'u_colors[0]'),
      gl.getUniformLocation(program, 'u_colors[1]'),
      gl.getUniformLocation(program, 'u_colors[2]'),
      gl.getUniformLocation(program, 'u_colors[3]'),
      gl.getUniformLocation(program, 'u_colors[4]')
    ],
    pointer: gl.getUniformLocation(program, 'u_pointer'),
    shape0: gl.getUniformLocation(program, 'u_shape0'),
    shape1: gl.getUniformLocation(program, 'u_shape1'),
    shape2: gl.getUniformLocation(program, 'u_shape2'),
    radii: gl.getUniformLocation(program, 'u_radii'),
    enabled: gl.getUniformLocation(program, 'u_enabled')
  };

  const targets = [
    { el: document.querySelector('.hero'), radius: 28 },
    { el: document.querySelector('.console'), radius: 22 },
    { el: document.querySelector('.progress-dock'), radius: 18 }
  ];

  const COVER_SOURCES = [
    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Faestheticwallpapers.io%2Fwallpaper%2F317144.jpg&f=1&nofb=1&ipt=fc328366695c1a905c97f130d8d18dc7222414f02b6326cd9ed38d98145199ab&ipo=images',
    'https://aestheticwallpapers.io/wallpaper/317144.jpg'
  ];

  // Color extraction follows the reference project's cover sampling idea.
  function extractCoverColors(img) {
    const temp = document.createElement('canvas');
    const ctx = temp.getContext('2d', { willReadFrequently: true });
    temp.width = 100;
    temp.height = 100;
    ctx.drawImage(img, 0, 0, 100, 100);

    const data = ctx.getImageData(0, 0, 100, 100).data;
    const pixels = [];

    for (let i = 0; i < data.length; i += 8) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      if (brightness > 10 && brightness < 245) {
        pixels.push([r / 255, g / 255, b / 255]);
      }
    }

    if (!pixels.length) throw new Error('no usable cover pixels');

    const distSq = (a, b) =>
      (a[0] - b[0]) ** 2 +
      (a[1] - b[1]) ** 2 +
      (a[2] - b[2]) ** 2;

    let seed = pixels[0];
    let maxSat = -1;
    for (let i = 0; i < pixels.length; i += 10) {
      const p = pixels[i];
      const sat = Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]);
      if (sat > maxSat) {
        maxSat = sat;
        seed = p;
      }
    }

    const finalColors = [seed];
    const candidateCount = Math.min(1000, pixels.length * 3);

    for (let k = 1; k < 5; k++) {
      let best = pixels[k % pixels.length];
      let maxDist = -1;

      for (let i = 0; i < candidateCount; i++) {
        const candidate = pixels[
          Math.floor((i * 7919 + k * 104729) % pixels.length)
        ];

        let nearest = Infinity;
        for (const existing of finalColors) {
          nearest = Math.min(nearest, distSq(candidate, existing));
        }

        if (nearest > maxDist) {
          maxDist = nearest;
          best = candidate;
        }
      }

      finalColors.push(best);
    }

    while (finalColors.length < 5) finalColors.push(finalColors[0]);
    return finalColors;
  }

  let coverColors = [
    [0.80, 0.38, 0.52],
    [0.94, 0.66, 0.75],
    [0.68, 0.42, 0.48],
    [0.98, 0.80, 0.84],
    [0.60, 0.30, 0.40]
  ];

  function setCoverColors(colors) {
    coverColors = colors;
    for (let i = 0; i < 5; i++) {
      gl.uniform3fv(u.colors[i], new Float32Array(coverColors[i]));
    }
  }

  let coverAttempt = 0;
  function loadCover() {
    const cover = new Image();
    cover.crossOrigin = 'anonymous';
    cover.onload = () => {
      try {
        setCoverColors(extractCoverColors(cover));
      } catch (err) {
        console.warn('Cover color sampling failed:', err);
        if (++coverAttempt < COVER_SOURCES.length) loadCover();
        else setCoverColors(coverColors);
      }
    };
    cover.onerror = () => {
      if (++coverAttempt < COVER_SOURCES.length) loadCover();
      else setCoverColors(coverColors);
    };
    cover.src = COVER_SOURCES[coverAttempt];
  }
  loadCover();

  let pointerX = innerWidth * 0.5;
  let pointerY = innerHeight * 0.25;

  function updatePointer(x, y) {
    pointerX = x;
    pointerY = innerHeight - y;
  }

  addEventListener('pointermove', e => updatePointer(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t) updatePointer(t.clientX, t.clientY);
  }, { passive: true });

  function resize() {
    const dpr = matchMedia('(pointer:coarse)').matches
      ? Math.min(devicePixelRatio || 1, 1.0)
      : Math.min(devicePixelRatio || 1, 1.25);
    const w = Math.max(1, Math.floor(innerWidth * dpr));
    const h = Math.max(1, Math.floor(innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function shapeFor(target) {
    const r = target.el.getBoundingClientRect();
    const dpr = matchMedia('(pointer:coarse)').matches
      ? Math.min(devicePixelRatio || 1, 1.0)
      : Math.min(devicePixelRatio || 1, 1.25);
    return new Float32Array([
      (r.left + r.width * 0.5) * dpr,
      (innerHeight - (r.top + r.height * 0.5)) * dpr,
      r.width * dpr,
      r.height * dpr
    ]);
  }

  function syncShapes() {
    for (const target of targets) {
      if (!target.el) return;
    }
    gl.uniform4fv(u.shape0, shapeFor(targets[0]));
    gl.uniform4fv(u.shape1, shapeFor(targets[1]));
    gl.uniform4fv(u.shape2, shapeFor(targets[2]));

    const dpr = matchMedia('(pointer:coarse)').matches
      ? Math.min(devicePixelRatio || 1, 1.0)
      : Math.min(devicePixelRatio || 1, 1.25);
    gl.uniform3f(
      u.radii,
      targets[0].radius * dpr,
      targets[1].radius * dpr,
      targets[2].radius * dpr
    );
    gl.uniform3f(u.enabled, 1, 1, 1);
  }

  let last = 0;
  function render(ms) {
    resize();
    syncShapes();

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const elapsed = reduced ? 0 : ms * 0.001;
    const dpr = matchMedia('(pointer:coarse)').matches
      ? Math.min(devicePixelRatio || 1, 1.0)
      : Math.min(devicePixelRatio || 1, 1.25);

    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform1f(u.time, elapsed);
    gl.uniform1f(u.speed, reduced ? 0.0 : 1.0);
    gl.uniform2f(u.pointer, pointerX * dpr, pointerY * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    last = ms;
    requestAnimationFrame(render);
  }

  resize();
  requestAnimationFrame(render);
})();