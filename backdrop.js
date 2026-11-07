/**
 * Ambient depth field behind the page.
 *
 * Raw WebGL2 on purpose: this is one draw call of perspective-projected
 * points, so pulling in a scene graph would cost ~600KB to do nothing extra.
 * Everything here degrades to the CSS gradient underneath rather than
 * throwing — no WebGL2, a software rasterizer, or reduced-motion all end
 * with the page looking finished without this layer.
 */

(function () {
  "use strict";

  const COUNT_DESKTOP = 560;
  const COUNT_MOBILE = 240;
  const IRIS = [0.431, 0.545, 1.0];
  const CYAN = [0.345, 0.78, 0.878];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isNarrow = window.matchMedia("(max-width: 820px)").matches;

  const canvas = document.createElement("canvas");
  canvas.id = "backdrop-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: true,
  });
  if (!gl) return;

  // A software rasterizer will technically run this and tank the whole page.
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return;

  const VERT = `#version 300 es
  in vec3 a_pos;
  in float a_tint;
  uniform float u_time;
  uniform float u_aspect;
  uniform float u_dpr;
  uniform vec2 u_mouse;
  out float v_alpha;
  out float v_tint;
  void main() {
    float t = fract(a_pos.z + u_time * 0.028);
    float depth = mix(2.4, 0.22, t);
    vec2 p = a_pos.xy / depth;
    p += u_mouse * (0.16 / depth);
    p.x /= u_aspect;
    gl_Position = vec4(p, 0.0, 1.0);
    gl_PointSize = clamp(u_dpr * 2.6 / depth, 1.0, 11.0);
    v_alpha = smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.72, 1.0, t));
    v_tint = a_tint;
  }`;

  const FRAG = `#version 300 es
  precision mediump float;
  in float v_alpha;
  in float v_tint;
  uniform vec3 u_c1;
  uniform vec3 u_c2;
  out vec4 outColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, d) * v_alpha;
    outColor = vec4(mix(u_c1, u_c2, v_tint), a * 0.5);
  }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const count = isNarrow ? COUNT_MOBILE : COUNT_DESKTOP;
  const pos = new Float32Array(count * 3);
  const tint = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * 1.9;
    pos[i * 3 + 1] = (Math.random() * 2 - 1) * 1.9;
    pos[i * 3 + 2] = Math.random();
    tint[i] = Math.random();
  }

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  const tintBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tintBuf);
  gl.bufferData(gl.ARRAY_BUFFER, tint, gl.STATIC_DRAW);
  const aTint = gl.getAttribLocation(prog, "a_tint");
  gl.enableVertexAttribArray(aTint);
  gl.vertexAttribPointer(aTint, 1, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, "u_time");
  const uAspect = gl.getUniformLocation(prog, "u_aspect");
  const uDpr = gl.getUniformLocation(prog, "u_dpr");
  const uMouse = gl.getUniformLocation(prog, "u_mouse");
  gl.uniform3fv(gl.getUniformLocation(prog, "u_c1"), IRIS);
  gl.uniform3fv(gl.getUniformLocation(prog, "u_c2"), CYAN);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, isNarrow ? 1.25 : 1.5);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform1f(uAspect, window.innerWidth / window.innerHeight);
    gl.uniform1f(uDpr, dpr);
  }

  let mx = 0, my = 0, tx = 0, ty = 0;
  if (!reduceMotion) {
    window.addEventListener("pointermove", function (e) {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }

  function draw(time) {
    mx += (tx - mx) * 0.045;
    my += (ty - my) * 0.045;
    gl.uniform2f(uMouse, mx, my);
    gl.uniform1f(uTime, time);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  document.body.appendChild(canvas);
  resize();
  window.addEventListener("resize", resize, { passive: true });

  if (reduceMotion) {
    draw(0);
    canvas.classList.add("ready");
    return;
  }

  let raf = 0;
  const start = performance.now();
  function loop(now) {
    draw((now - start) / 1000);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(function () { canvas.classList.add("ready"); });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      raf = requestAnimationFrame(loop);
    }
  });
})();
