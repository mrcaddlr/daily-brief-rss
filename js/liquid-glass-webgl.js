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

  const fragment = `
    precision mediump float;
    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_pointer;

    uniform vec4 u_shape0;
    uniform vec4 u_shape1;
    uniform vec4 u_shape2;
    uniform vec3 u_radii;
    uniform vec3 u_enabled;

    float sdRoundBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    vec3 background(vec2 px) {
      vec2 uv = px / u_resolution;

      vec2 c1 = vec2(
        0.12 + 0.025 * sin(u_time * 0.22),
        0.08 + 0.020 * cos(u_time * 0.18)
      );
      vec2 c2 = vec2(
        0.90 + 0.020 * cos(u_time * 0.19),
        0.15 + 0.035 * sin(u_time * 0.16)
      );
      vec2 c3 = vec2(
        0.52 + 0.045 * sin(u_time * 0.14),
        0.90 + 0.025 * cos(u_time * 0.21)
      );

      float a = exp(-distance(uv, c1) * 4.2);
      float b = exp(-distance(uv, c2) * 4.8);
      float c = exp(-distance(uv, c3) * 3.6);

      vec3 base = vec3(1.0, 0.969, 0.984);
      base += vec3(1.00, 0.48, 0.70) * a * 0.23;
      base += vec3(1.00, 0.73, 0.84) * b * 0.17;
      base += vec3(0.98, 0.58, 0.76) * c * 0.12;

      float wave = 0.5 + 0.5 * sin(uv.x * 9.0 + uv.y * 5.0 + u_time * 0.34);
      base += vec3(1.0, 0.35, 0.63) * wave * 0.016;

      return clamp(base, 0.0, 1.0);
    }

    vec3 makeGlass(vec2 px, vec4 shape, float radius) {
      vec2 p = px - shape.xy;
      vec2 halfSize = shape.zw * 0.5;
      float d = sdRoundBox(p, halfSize, radius);

      float mask = 1.0 - smoothstep(-1.5, 1.5, d);
      if (mask <= 0.001) return background(px);

      float edge = 1.0 - smoothstep(-34.0, 1.0, d);
      vec2 radial = normalize(p + vec2(0.001));

      float pointerDist = distance(px, u_pointer);
      float pointerLight = 1.0 - smoothstep(16.0, 250.0, pointerDist);

      float refraction = 20.0 * edge * edge;

      vec2 liquidWave = vec2(
        sin(p.y * 0.045 + u_time * 0.72),
        cos(p.x * 0.040 - u_time * 0.64)
      ) * 4.5;

      vec2 samplePx = px - radial * refraction + liquidWave * edge;

      vec3 frost = vec3(0.0);
      float samples = 0.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 offset = vec2(float(x), float(y)) * 1.5;
          frost += background(samplePx + offset);
          samples += 1.0;
        }
      }
      frost /= samples;

      float ca = 3.0 * edge;
      vec2 caOffset = radial * ca;

      vec3 refracted = vec3(
        background(samplePx - caOffset).r,
        background(samplePx).g,
        background(samplePx + caOffset).b
      );

      refracted = mix(frost, refracted, 0.78);
      refracted = mix(refracted, vec3(1.0, 0.985, 0.995), 0.13);

      float topEdge = smoothstep(0.82, 1.0, edge) * 0.065;
      float rim = smoothstep(0.15, 1.0, edge) * 0.045;
      float hoverGlow = pointerLight * 0.05;

      refracted += vec3(topEdge + rim + hoverGlow);
      return clamp(refracted, 0.0, 1.0);
    }

    vec3 applyShape(vec3 color, vec2 px, vec4 shape, float radius) {
      float d = sdRoundBox(px - shape.xy, shape.zw * 0.5, radius);
      float mask = 1.0 - smoothstep(-1.5, 1.5, d);
      vec3 glass = makeGlass(px, shape, radius);
      return mix(color, glass, mask);
    }

    void main() {
      vec2 px = v_uv * u_resolution;
      vec3 color = background(px);

      if (u_enabled.x > 0.5) color = applyShape(color, px, u_shape0, u_radii.x);
      if (u_enabled.y > 0.5) color = applyShape(color, px, u_shape1, u_radii.y);
      if (u_enabled.z > 0.5) color = applyShape(color, px, u_shape2, u_radii.z);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

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
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
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
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
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

    const dpr = Math.min(devicePixelRatio || 1, 1.5);
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
    const dpr = Math.min(devicePixelRatio || 1, 1.5);

    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform1f(u.time, elapsed);
    gl.uniform2f(u.pointer, pointerX * dpr, pointerY * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    last = ms;
    requestAnimationFrame(render);
  }

  resize();
  requestAnimationFrame(render);
})();