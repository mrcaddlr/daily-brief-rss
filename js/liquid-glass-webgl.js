import {
  vertexShaderSource,
  fragmentShaderSource
} from './liquid-glass-reference/shaders.js';

import {
  compileShader,
  createProgram,
  getUniformLocations,
  initializeBackgroundImageTextures
} from './liquid-glass-reference/webgl-utils.js';

import ReflectionBorder from './liquid-glass-reference/reflections.js';

(() => {
  const canvas = document.getElementById('webglCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true
  }) || canvas.getContext('experimental-webgl');

  if (!gl) return;

  const vs = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return;

  const program = createProgram(gl, vs, fs);
  if (!program) return;

  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
    gl.STATIC_DRAW
  );

  const u = getUniformLocations(gl, program);
  initializeBackgroundImageTextures(gl, u, program);

  const position = u.position;
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const targets = [
    { el: document.querySelector('.hero'), radius: 28 },
    { el: document.querySelector('.console'), radius: 22 },
    { el: document.querySelector('.progress-dock'), radius: 18 }
  ];

  const reflectionLayers = targets.map((target, index) => {
    const canvas = document.createElement('canvas');
    canvas.id = 'liquidGlassReflectionCanvas-' + index;
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '1',
      pointerEvents: 'none'
    });
    document.body.appendChild(canvas);
    return { canvas, renderer: new ReflectionBorder(canvas), target };
  });

  const params = {
    edgeDistortionThickness: 29,
    refractionStrength: 47,
    glassBaseColor: [0.9803921569, 0.9803921569, 1, 0.10],
    frostiness: 1,
    topShadowBlur: 60,
    topShadowOffsetX: -14,
    topShadowOffsetY: 21,
    topShadowOpacity: 0.5,
    bottomGlowBlur: 30,
    bottomGlowOffsetX: 31,
    bottomGlowOffsetY: -15,
    bottomGlowOpacity: 0.3,
    enableChromaticAberration: true,
    chromaticAberrationAmount: 9.1,
    dropShadowBlur: 20,
    dropShadowOffsetX: 0,
    dropShadowOffsetY: -10,
    dropShadowOpacity: 0.5
  };

  const background = [1, 0.969, 0.984, 1];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.floor(innerWidth * dpr));
    const height = Math.max(1, Math.floor(innerHeight * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    for (const layer of reflectionLayers) {
      const w = Math.floor(innerWidth * dpr);
      const h = Math.floor(innerHeight * dpr);
      if (layer.canvas.width !== w || layer.canvas.height !== h) {
        layer.canvas.width = w;
        layer.canvas.height = h;
      }
    }
  }

  function setDefaults() {
    gl.uniform4fv(u.gridLineColor, [0, 0, 0, 0.15]);
    gl.uniform1f(u.gridSpacing, 25);
    gl.uniform4fv(u.pageBackgroundColor, background);
    gl.uniform1i(u.showGrid, false);

    gl.uniform1i(u.hasBackgroundImages, false);
    gl.uniform1i(u.backgroundImageCount, 0);

    gl.uniform2f(u.controlPanelCenter, -10000, -10000);
    gl.uniform2f(u.controlPanelSize, 0, 0);
    gl.uniform1f(u.controlPanelCornerRadius, 0);
    gl.uniform1f(u.controlPanelDistortionThickness, 0);

    gl.uniform2f(u.addImageButtonCenter, -10000, -10000);
    gl.uniform2f(u.addImageButtonSize, 0, 0);
    gl.uniform1f(u.addImageButtonCornerRadius, 0);
    gl.uniform1f(u.addImageButtonDistortionThickness, 0);

    gl.uniform2f(u.gridControlsCenter, -10000, -10000);
    gl.uniform2f(u.gridControlsSize, 0, 0);
    gl.uniform1f(u.gridControlsCornerRadius, 0);
    gl.uniform1f(u.gridControlsDistortionThickness, 0);

    gl.uniform1f(u.refractionStrength, params.refractionStrength);
    gl.uniform4fv(u.glassBaseColor, params.glassBaseColor);
    gl.uniform1f(u.frostiness, params.frostiness);

    gl.uniform1f(u.topShadowBlur, params.topShadowBlur);
    gl.uniform1f(u.topShadowOffsetX, params.topShadowOffsetX);
    gl.uniform1f(u.topShadowOffsetY, params.topShadowOffsetY);
    gl.uniform1f(u.topShadowOpacity, params.topShadowOpacity);

    gl.uniform1f(u.bottomGlowBlur, params.bottomGlowBlur);
    gl.uniform1f(u.bottomGlowOffsetX, params.bottomGlowOffsetX);
    gl.uniform1f(u.bottomGlowOffsetY, params.bottomGlowOffsetY);
    gl.uniform1f(u.bottomGlowOpacity, params.bottomGlowOpacity);

    gl.uniform1i(u.enableChromaticAberration, params.enableChromaticAberration);
    gl.uniform1f(u.chromaticAberrationAmount, params.chromaticAberrationAmount);

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_dropShadowBlur'),
      params.dropShadowBlur
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_dropShadowOffsetX'),
      params.dropShadowOffsetX
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_dropShadowOffsetY'),
      params.dropShadowOffsetY
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_dropShadowOpacity'),
      params.dropShadowOpacity
    );
  }

  function shape(el) {
    const r = el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    return {
      center: [(r.left + r.width / 2) * dpr, (innerHeight - r.top - r.height / 2) * dpr],
      size: [r.width * dpr, r.height * dpr],
      radius: Math.min(
        targets.find(t => t.el === el)?.radius || 20,
        r.width * 0.5,
        r.height * 0.5
      ) * dpr
    };
  }

  function drawGlass(s) {
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform2f(u.liquidGlassCenter, s.center[0], s.center[1]);
    gl.uniform2f(u.rectangleSize, s.size[0], s.size[1]);
    gl.uniform1f(u.rectangleCornerRadius, s.radius);
    gl.uniform1f(u.edgeDistortionThickness, Math.min(params.edgeDistortionThickness, Math.min(s.size[0], s.size[1]) * 0.5 - 1));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function drawReflections() {
    for (const layer of reflectionLayers) {
      if (!layer.target.el) continue;
      const r = layer.target.el.getBoundingClientRect();

      layer.renderer.draw({
        center: {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2
        },
        size: {
          w: r.width,
          h: r.height
        },
        cornerRadius: layer.target.radius,
        thickness: 2,
        blur: 0,
        offset: 1,
        rotationOffsetDeg: 76,
        stopPositions: [0, .38, .43, .52, .57, .62, .67, .76, 1],
        opacity: 0.72
      });
    }
  }

  function render() {
    resize();

    gl.clearColor(background[0], background[1], background[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    setDefaults();

    gl.enable(gl.SCISSOR_TEST);
    for (const target of targets) {
      if (!target.el) continue;
      const r = target.el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const x = Math.max(0, Math.floor(r.left * dpr));
      const y = Math.max(0, Math.floor((innerHeight - r.bottom) * dpr));
      const w = Math.max(1, Math.ceil(r.width * dpr));
      const h = Math.max(1, Math.ceil(r.height * dpr));
      gl.scissor(x, y, w, h);
      drawGlass(shape(target.el));
    }
    gl.disable(gl.SCISSOR_TEST);

    drawReflections();
    requestAnimationFrame(render);
  }

  render();
})();