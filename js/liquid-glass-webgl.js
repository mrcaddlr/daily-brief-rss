import { vertexShaderSource, fragmentShaderSource } from './liquid-glass-reference/shaders.js';
import { compileShader, createProgram, getUniformLocations, initializeBackgroundImageTextures } from './liquid-glass-reference/webgl-utils.js';
import ReflectionBorder from './liquid-glass-reference/reflections.js';

(() => {
  const targets = [
    { el: document.querySelector('.hero'), radius: 28 },
    { el: document.querySelector('.console'), radius: 22 },
    { el: document.querySelector('.progress-dock'), radius: 18 }
  ].filter(x => x.el);

  if (!targets.length) return;

  function createGlass(target) {
    const canvas = document.createElement('canvas');
    canvas.className = 'reference-liquid-glass';
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '0',
      pointerEvents: 'none',
      borderRadius: 'inherit'
    });
    target.el.prepend(canvas);

    const gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: false, stencil: false })
      || canvas.getContext('experimental-webgl');
    if (!gl) return null;

    const vs = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fs = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    const program = createProgram(gl, vs, fs);
    if (!program) return null;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);

    const u = getUniformLocations(gl, program);
    initializeBackgroundImageTextures(gl, u, program);
    gl.enableVertexAttribArray(u.position);
    gl.vertexAttribPointer(u.position, 2, gl.FLOAT, false, 0, 0);

    const reflectionCanvas = document.createElement('canvas');
    Object.assign(reflectionCanvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '0',
      pointerEvents: 'none',
      borderRadius: 'inherit'
    });
    target.el.prepend(reflectionCanvas);
    const reflection = new ReflectionBorder(reflectionCanvas);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1 : 1.25);
      const w = Math.max(1, Math.floor(target.el.clientWidth * dpr));
      const h = Math.max(1, Math.floor(target.el.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      if (reflectionCanvas.width !== w || reflectionCanvas.height !== h) {
        reflectionCanvas.width = w;
        reflectionCanvas.height = h;
      }
    }

    function setUniforms() {
      const w = canvas.width;
      const h = canvas.height;
      const radius = Math.min(target.radius * (w / Math.max(1, target.el.clientWidth)), w * 0.5, h * 0.5);

      gl.uniform2f(u.resolution, w, h);
      gl.uniform2f(u.liquidGlassCenter, w * 0.5, h * 0.5);
      gl.uniform2f(u.rectangleSize, w, h);
      gl.uniform1f(u.rectangleCornerRadius, radius);
      gl.uniform1f(u.edgeDistortionThickness, Math.min(29, Math.max(0, Math.min(w, h) * 0.5 - 1)));

      gl.uniform4fv(u.gridLineColor, [0,0,0,0.15]);
      gl.uniform1f(u.gridSpacing, 25);
      gl.uniform4fv(u.pageBackgroundColor, [1,0.969,0.984,1]);
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

      gl.uniform1f(u.refractionStrength, 47);
      gl.uniform4fv(u.glassBaseColor, [0.9803921569,0.9803921569,1,0.10]);
      gl.uniform1f(u.frostiness, 1);
      gl.uniform1f(u.topShadowBlur, 60);
      gl.uniform1f(u.topShadowOffsetX, -14);
      gl.uniform1f(u.topShadowOffsetY, 21);
      gl.uniform1f(u.topShadowOpacity, 0.5);
      gl.uniform1f(u.bottomGlowBlur, 30);
      gl.uniform1f(u.bottomGlowOffsetX, 31);
      gl.uniform1f(u.bottomGlowOffsetY, -15);
      gl.uniform1f(u.bottomGlowOpacity, 0.3);
      gl.uniform1i(u.enableChromaticAberration, true);
      gl.uniform1f(u.chromaticAberrationAmount, 9.1);

      gl.uniform1f(gl.getUniformLocation(program, 'u_dropShadowBlur'), 20);
      gl.uniform1f(gl.getUniformLocation(program, 'u_dropShadowOffsetX'), 0);
      gl.uniform1f(gl.getUniformLocation(program, 'u_dropShadowOffsetY'), -10);
      gl.uniform1f(gl.getUniformLocation(program, 'u_dropShadowOpacity'), 0.5);
    }

    function render() {
      resize();
      gl.useProgram(program);
      setUniforms();
      gl.clearColor(1,0.969,0.984,1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      reflection.draw({
        center: { x: target.el.clientWidth / 2, y: target.el.clientHeight / 2 },
        size: { w: target.el.clientWidth, h: target.el.clientHeight },
        cornerRadius: target.radius,
        thickness: 2,
        blur: 0,
        offset: 1,
        rotationOffsetDeg: 76,
        stopPositions: [0,.38,.43,.52,.57,.62,.67,.76,1],
        opacity: 0.72
      });
    }

    return { render };
  }

  const instances = targets.map(createGlass).filter(Boolean);
  const renderAll = () => instances.forEach(x => x.render());

  let renderFrame = 0;
  const scheduleRender = () => {
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      renderAll();
    });
  };
  // The feed is inserted asynchronously, so the report panel can grow after the
  // first WebGL frame. Track its actual box instead of waiting for a scroll/resize.
  const sizeObserver = new ResizeObserver(scheduleRender);
  targets.forEach(({el}) => sizeObserver.observe(el));
  window.addEventListener('resize', scheduleRender, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRender);
  scheduleRender();
})();