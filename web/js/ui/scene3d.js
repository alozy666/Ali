/* المشهد ثلاثي الأبعاد: طريق من نور من الكعبة المشرفة إلى قباب سامراء الذهبية
   three.js r149 مضمَّن محلياً — بلا أي طلب شبكة. تمثيل هندسي مجرّد محترم بلا صور حية. */
window.WKM = window.WKM || {};
WKM.Scene3D = (function () {
  var GOLD = 0xD4AF37, GOLD_SOFT = 0xE8C96A, EMERALD = 0x0B3D2E, NAVY = 0x0A1A3C;
  var state = null;

  function supported() {
    if (typeof THREE === 'undefined') return false;
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ——— عناصر المشهد ——— */

  function makeGold(extra) {
    var o = { color: GOLD, metalness: 0.92, roughness: 0.28, emissive: 0x2a1f05, emissiveIntensity: 0.5 };
    for (var k in (extra || {})) o[k] = extra[k];
    return new THREE.MeshStandardMaterial(o);
  }

  /* الكعبة المشرفة: مكعّب داكن يطوّقه حزام ذهبي — تجريد هندسي */
  function buildKaaba() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.8, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x07101F, metalness: 0.3, roughness: 0.75 })
    );
    body.position.y = 0.9;
    g.add(body);
    var belt = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.16, 1.66), makeGold());
    belt.position.y = 1.25;
    g.add(belt);
    var base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x1A2438, metalness: 0.4, roughness: 0.6 }));
    base.position.y = 0.06;
    g.add(base);
    return g;
  }

  /* الحرم في سامراء: قبّة ذهبية كبيرة ومئذنتان */
  function buildShrine() {
    var g = new THREE.Group();
    var gold = makeGold();
    var hall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x122A44, metalness: 0.45, roughness: 0.55 }));
    hall.position.y = 0.6; g.add(hall);

    var drum = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.5, 24), gold);
    drum.position.y = 1.45; g.add(drum);
    var dome = new THREE.Mesh(new THREE.SphereGeometry(0.78, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.position.y = 1.7; g.add(dome);
    var finial = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 12), gold);
    finial.position.y = 2.62; g.add(finial);

    [-1.45, 1.45].forEach(function (x) {
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.4, 16), gold);
      shaft.position.set(x, 1.2, 0.85); g.add(shaft);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
      cap.position.set(x, 2.4, 0.85); g.add(cap);
      var tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 10), gold);
      tip.position.set(x, 2.72, 0.85); g.add(tip);
    });
    return g;
  }

  /* الإسطرلاب: حلقات ذهبية متداخلة تدور بسرعات مختلفة */
  function buildAstrolabe() {
    var g = new THREE.Group();
    var gold = makeGold({ roughness: 0.2 });
    var r1 = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.035, 12, 64), gold);
    var r2 = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.028, 12, 56), gold);
    var r3 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.022, 12, 48), gold);
    g.rotation.set(-0.55, 0.42, 0.18);
    r2.rotation.x = Math.PI / 2.4; r3.rotation.y = Math.PI / 2.6;
    g.add(r1); g.add(r2); g.add(r3);
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      var pip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), gold);
      pip.position.set(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0);
      g.add(pip);
    }
    g.userData.rings = [r1, r2, r3];
    return g;
  }

  /* طريق النور: جسيمات ذهبية تنساب على منحنى يصل الكعبة بالحرم */
  function buildPath(count, from, to) {
    var pos = new Float32Array(count * 3);
    var seeds = new Float32Array(count);
    var ts = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      ts[i] = Math.random();
      seeds[i] = Math.random();
      placeAt(pos, i, ts[i], seeds[i], from, to);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: GOLD_SOFT, size: 0.1, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    var pts = new THREE.Points(geo, mat);
    pts.userData = { seeds: seeds, ts: ts, count: count, from: from, to: to };
    return pts;
  }
  /* t=0 عند الكعبة و t=1 عند الحرم، مع تقوّس لطيف وعرض للطريق */
  function placeAt(arr, i, t, seed, from, to) {
    var side = (seed - 0.5) * 2;
    var x = from.x + (to.x - from.x) * t + side * (1.05 - 0.45 * t);
    var z = from.z + (to.z - from.z) * t;
    var y = 0.08 + Math.sin(t * Math.PI) * 0.55 + seed * 0.35;
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
  }

  function buildStars(count) {
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = 3 + Math.random() * 22;
      pos[i * 3 + 2] = -60 + Math.random() * 60;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xCFE3FF, size: 0.11, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
  }

  /* ——— التركيب ——— */

  function mount(canvas) {
    if (!canvas || !supported()) return false;
    dispose();

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(NAVY);
    scene.fog = new THREE.Fog(NAVY, 22, 62);

    var camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 160);
    camera.position.set(0.2, 3.5, 9.2);
    camera.lookAt(-0.3, 1.35, -18);

    scene.add(new THREE.AmbientLight(0x6E86B8, 0.55));
    var key = new THREE.DirectionalLight(0xFFE9B0, 1.15);
    key.position.set(4, 8, 6); scene.add(key);
    var glowNear = new THREE.PointLight(GOLD, 2.6, 14); glowNear.position.set(4.6, 2.4, 0.2); scene.add(glowNear);
    var glowFar = new THREE.PointLight(GOLD_SOFT, 7.5, 40); glowFar.position.set(-2.6, 4.2, -22); scene.add(glowFar);
    var rim = new THREE.PointLight(0x2FA37A, 1.3, 34); rim.position.set(7, 3, -12); scene.add(rim);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ color: 0x081428, metalness: 0.55, roughness: 0.42 })
    );
    ground.rotation.x = -Math.PI / 2; scene.add(ground);

    var KAABA_AT = { x: 4.6, z: 0.2 }, SHRINE_AT = { x: -2.9, z: -25 };
    var kaaba = buildKaaba(); kaaba.position.set(KAABA_AT.x, 0, KAABA_AT.z); kaaba.scale.setScalar(0.92);
    kaaba.rotation.y = -0.38; scene.add(kaaba);
    var shrine = buildShrine(); shrine.position.set(SHRINE_AT.x, 0, SHRINE_AT.z); shrine.scale.setScalar(1.65);
    shrine.rotation.y = 0.28; scene.add(shrine);
    var astro = buildAstrolabe(); astro.position.set(4.9, 5.8, -10); astro.scale.setScalar(1.3); scene.add(astro);
    var path = buildPath(620, KAABA_AT, SHRINE_AT); scene.add(path);
    var stars = buildStars(320); scene.add(stars);

    var still = reducedMotion();
    var running = true, raf = null, t0 = performance.now();

    function resize() {
      var w = canvas.clientWidth || canvas.parentElement.clientWidth || 800;
      var h = canvas.clientHeight || Math.round(w * 0.52);
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function frame() {
      if (!running) return;
      var t = (performance.now() - t0) / 1000;
      if (!still) {
        var ring = astro.userData.rings;
        ring[0].rotation.z = t * 0.28;
        ring[1].rotation.z = -t * 0.36;
        ring[2].rotation.x = t * 0.44;
        astro.rotation.y = Math.sin(t * 0.25) * 0.35;

        var arr = path.geometry.attributes.position.array;
        var d = path.userData;
        for (var i = 0; i < d.count; i++) {
          d.ts[i] += 0.0016 + d.seeds[i] * 0.0014;            // النور يسري من الكعبة نحو الحرم
          if (d.ts[i] > 1) d.ts[i] -= 1;
          placeAt(arr, i, d.ts[i], d.seeds[i], d.from, d.to);
          arr[i * 3 + 1] += Math.sin(t * 1.5 + d.seeds[i] * 9) * 0.05;
        }
        path.geometry.attributes.position.needsUpdate = true;

        camera.position.y = 3.5 + Math.sin(t * 0.45) * 0.1;
        camera.position.x = 0.2 + Math.sin(t * 0.2) * 0.28;
        camera.lookAt(-0.3, 1.35, -18);
        glowFar.intensity = 7.0 + Math.sin(t * 1.2) * 1.2;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    resize();
    var ro = null;
    try { ro = new ResizeObserver(resize); ro.observe(canvas.parentElement || canvas); }
    catch (e) { window.addEventListener('resize', resize); }

    function onVisibility() {
      if (document.hidden) { running = false; if (raf) cancelAnimationFrame(raf); }
      else if (!running) { running = true; t0 = performance.now() - 1000; frame(); }
    }
    document.addEventListener('visibilitychange', onVisibility);

    state = { renderer: renderer, scene: scene, ro: ro, onVisibility: onVisibility,
              stop: function () { running = false; if (raf) cancelAnimationFrame(raf); } };
    frame();
    return true;
  }

  function dispose() {
    if (!state) return;
    state.stop();
    document.removeEventListener('visibilitychange', state.onVisibility);
    if (state.ro) { try { state.ro.disconnect(); } catch (e) {} }
    state.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); }); }
    });
    state.renderer.dispose();
    state = null;
  }

  return { mount: mount, dispose: dispose, supported: supported, isActive: function () { return !!state; } };
})();
