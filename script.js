// ============================================
// PRELOADER — GRADIENT DESCENT LOSS CURVE
// ============================================
(function() {
  const preloader = document.getElementById('preloader');
  const lossCanvas = document.getElementById('loss-canvas');
  const lossText = document.getElementById('preloader-loss');
  const progressBar = document.getElementById('preloader-progress');
  const pageContent = document.getElementById('page-content');

  if (!preloader || !lossCanvas) return;

  // Skip preloader if already seen this session
  const hasSeenIntro = sessionStorage.getItem('introSeen');
  if (hasSeenIntro) {
    preloader.remove();
    pageContent.classList.add('revealed');
    // Show name immediately without decode animation
    const nameEl = document.getElementById('animated-name');
    if (nameEl) nameEl.textContent = 'Shashank Srivastava';
    const tagline = document.getElementById('animated-tagline');
    if (tagline) tagline.classList.add('visible');
    // Show cascade elements immediately
    document.querySelectorAll('.cascade').forEach(el => el.classList.add('in'));
    return;
  }

  const ctx = lossCanvas.getContext('2d');
  const W = lossCanvas.width;
  const H = lossCanvas.height;
  const totalSteps = 80;
  const points = [];
  let step = 0;

  // Generate a realistic-looking loss curve that descends to ~0
  function getLoss(t) {
    // Exponential decay with some noise
    const progress = t / totalSteps;
    const baseLoss = 4.2 * Math.exp(-4.5 * progress);
    const noise = (Math.random() - 0.5) * baseLoss * 0.15;
    return Math.max(0.001, baseLoss + noise);
  }

  function drawCurve() {
    ctx.clearRect(0, 0, W, H);

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 10); ctx.lineTo(30, H - 10);
    ctx.lineTo(W - 10, H - 10);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '9px monospace';
    ctx.fillText('loss', 2, 14);
    ctx.fillText('step', W - 30, H - 2);

    if (points.length < 2) return;

    // Draw gradient under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(217, 119, 6, 0.2)');
    gradient.addColorStop(1, 'rgba(217, 119, 6, 0)');

    ctx.beginPath();
    ctx.moveTo(30, H - 10);
    points.forEach((p, i) => {
      const x = 30 + (i / totalSteps) * (W - 40);
      const y = 15 + (1 - p / 4.5) * (H - 30);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    const lastX = 30 + ((points.length - 1) / totalSteps) * (W - 40);
    ctx.lineTo(lastX, H - 10);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the line
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = 30 + (i / totalSteps) * (W - 40);
      const y = 15 + (1 - p / 4.5) * (H - 30);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dot at current point
    const lastPoint = points[points.length - 1];
    const dotX = 30 + ((points.length - 1) / totalSteps) * (W - 40);
    const dotY = 15 + (1 - lastPoint / 4.5) * (H - 30);

    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#d97706';
    ctx.fill();

    // Glow on dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(217, 119, 6, 0.25)';
    ctx.fill();
  }

  function tick() {
    if (step >= totalSteps) {
      // Done — loss reached ~0
      lossText.textContent = 'loss: 0.0001 ✓';
      progressBar.style.width = '100%';

      setTimeout(() => {
        preloader.classList.add('done');
        pageContent.classList.add('revealed');
        sessionStorage.setItem('introSeen', '1');
        setTimeout(startPageAnimations, 300);
      }, 400);
      return;
    }

    const loss = getLoss(step);
    points.push(loss);
    drawCurve();

    // Update text and progress
    lossText.textContent = 'loss: ' + loss.toFixed(4);
    progressBar.style.width = ((step / totalSteps) * 100) + '%';

    step++;
    // Speed up as loss decreases (like learning rate warm-up feel)
    const delay = step < 10 ? 35 : step < 40 ? 25 : 18;
    setTimeout(tick, delay);
  }

  tick();

  // ============================================
  // BACKGROUND FLASHES — specific AI/ML concepts
  // ============================================
  const flashContainer = document.getElementById('preloader-flashes');
  const flashContent = [
    { text: 'σ(zᵢ) = eᶻⁱ / Σ eᶻʲ', type: 'equation' },
    { text: 'MCP', type: 'term' },
    { text: 'LangGraph', type: 'term' },
    { text: 'RAG', type: 'term' },
    { text: 'YOLO', type: 'term' },
    { text: 'SAM', type: 'term' },
    { text: 'FastAPI', type: 'term' },
    { text: 'Celery', type: 'term' },
    { text: 'Kubernetes', type: 'term' },
    { text: 'PySpark', type: 'term' },
  ];

  // Fixed positions in a grid so they don't overlap
  const positions = [
    { x: 8, y: 12 }, { x: 55, y: 8 }, { x: 25, y: 75 },
    { x: 65, y: 70 }, { x: 10, y: 45 }, { x: 70, y: 38 },
    { x: 35, y: 25 }, { x: 80, y: 82 }, { x: 5, y: 85 },
    { x: 50, y: 50 }, { x: 20, y: 55 }, { x: 75, y: 18 },
  ];

  let posIndex = 0;
  let flashIdx = 0;

  let flashInterval = setInterval(() => {
    if (preloader.classList.contains('done')) {
      clearInterval(flashInterval);
      return;
    }

    const item = flashContent[flashIdx % flashContent.length];
    const pos = positions[posIndex % positions.length];
    posIndex++;
    flashIdx++;

    const el = document.createElement('div');
    el.className = 'flash-item ' + item.type;
    el.textContent = item.text;
    el.style.left = pos.x + '%';
    el.style.top = pos.y + '%';
    flashContainer.appendChild(el);

    setTimeout(() => el.remove(), 2600);
  }, 350);

  function startPageAnimations() {
    decodeName();
    const cascadeEls = document.querySelectorAll('.cascade');
    cascadeEls.forEach((el, i) => {
      setTimeout(() => el.classList.add('in'), i * 80);
    });
  }

  // ============================================
  // NAME CIPHER DECODE ANIMATION
  // ============================================
  const nameEl = document.getElementById('animated-name');
  const YOUR_NAME = 'Shashank Srivastava';
  const cipherChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*';

  if (nameEl) {
    YOUR_NAME.split('').forEach(char => {
      const span = document.createElement('span');
      span.className = 'char' + (char === ' ' ? ' space' : ' decoding');
      span.textContent = char === ' ' ? '\u00A0' : cipherChars[Math.floor(Math.random() * cipherChars.length)];
      span.dataset.final = char;
      nameEl.appendChild(span);
    });
  }

  function decodeName() {
    if (!nameEl) return;
    const chars = nameEl.querySelectorAll('.char:not(.space)');

    chars.forEach((span, i) => {
      const finalChar = span.dataset.final;
      let iterations = 0;
      const maxIterations = 6 + Math.floor(Math.random() * 4);

      const interval = setInterval(() => {
        if (iterations >= maxIterations) {
          clearInterval(interval);
          span.textContent = finalChar;
          span.classList.remove('decoding');
          span.classList.add('decoded');

          if (i === chars.length - 1) {
            setTimeout(() => {
              const tagline = document.getElementById('animated-tagline');
              if (tagline) tagline.classList.add('visible');
            }, 200);
          }
          return;
        }
        span.textContent = cipherChars[Math.floor(Math.random() * cipherChars.length)];
        iterations++;
      }, 40 + i * 8);
    });
  }
})();

// ============================================
// NEURAL NETWORK BACKGROUND
// ============================================
(function() {
  const canvas = document.getElementById('neural-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let nodes = [];
  let mouseX = null, mouseY = null;
  let pulses = [];
  let lastPulse = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createNodes() {
    nodes = [];
    const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 18000));
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function getColor() {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    if (hex && hex.startsWith('#')) {
      return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
    }
    return { r: 217, g: 119, b: 6 };
  }

  function loop(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const c = getColor();

    // Update nodes
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
      if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      n.cr = n.r + Math.sin(time * 0.002 + n.phase) * 0.5;

      if (mouseX !== null) {
        const dx = mouseX - n.x, dy = mouseY - n.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 200 && dist > 0) { n.x += dx * 0.002; n.y += dy * 0.002; }
      }
    });

    // Connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${(1-dist/130)*0.2})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      // Mouse connections
      if (mouseX !== null) {
        const dx = nodes[i].x - mouseX, dy = nodes[i].y - mouseY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 160) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(mouseX, mouseY);
          ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${(1-dist/160)*0.3})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.cr, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.5)`;
      ctx.fill();
    });

    // Pulses
    if (time - lastPulse > 350 && nodes.length > 1) {
      const i = Math.floor(Math.random()*nodes.length);
      let j = Math.floor(Math.random()*nodes.length);
      if (j===i) j = (j+1)%nodes.length;
      const dx = nodes[i].x-nodes[j].x, dy = nodes[i].y-nodes[j].y;
      if (Math.sqrt(dx*dx+dy*dy) < 140) pulses.push({ from:i, to:j, t:0 });
      lastPulse = time;
    }

    pulses = pulses.filter(p => p.t <= 1);
    pulses.forEach(p => {
      p.t += 0.02;
      const from = nodes[p.from], to = nodes[p.to];
      const x = from.x + (to.x-from.x)*p.t;
      const y = from.y + (to.y-from.y)*p.t;
      const fade = 1 - p.t;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.12*fade})`; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.7*fade})`; ctx.fill();
    });

    requestAnimationFrame(loop);
  }

  resize(); createNodes(); requestAnimationFrame(loop);
  window.addEventListener('resize', () => { resize(); createNodes(); });
  document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  document.addEventListener('mouseleave', () => { mouseX = null; mouseY = null; });
})();

// ============================================
// THEME TOGGLE
// ============================================
(function() {
  const toggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  // Default to dark mode
  if (!localStorage.getItem('theme') || localStorage.getItem('theme') === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }
  if (toggle) {
    toggle.addEventListener('click', () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      root.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
    });
  }
})();

// ============================================
// SCROLL REVEAL
// ============================================
(function() {
  const els = document.querySelectorAll('.section, .experience-item, .writing-item, .project-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), idx * 50);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => { el.classList.add('reveal'); observer.observe(el); });
})();

// ============================================
// CUSTOM CURSOR
// ============================================
(function() {
  const dot = document.querySelector('.cursor-dot');
  if (!dot || window.innerWidth < 768) return;
  let cx = 0, cy = 0, dx = 0, dy = 0;
  document.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY; });
  function tick() {
    dx += (cx - dx) * 0.12; dy += (cy - dy) * 0.12;
    dot.style.left = (dx-4)+'px'; dot.style.top = (dy-4)+'px';
    requestAnimationFrame(tick);
  }
  tick();
})();

// ============================================
// GITHUB CONTRIBUTION GRAPH
// ============================================
(function() {
  const grid = document.getElementById('contribution-graph');
  if (!grid) return;
  const total = 52 * 7;
  for (let i = 0; i < total; i++) {
    const cell = document.createElement('div');
    cell.className = 'graph-cell';
    const week = Math.floor(i/7), rand = Math.random(), bias = week/52;
    let level = 0;
    if (rand < 0.15 + bias*0.3) level = 1;
    if (rand < 0.08 + bias*0.2) level = 2;
    if (rand < 0.04 + bias*0.12) level = 3;
    if (rand < 0.02 + bias*0.06) level = 4;
    if (level > 0) cell.classList.add('level-'+level);
    cell.style.opacity = '0';
    cell.style.transition = 'opacity 0.2s ease ' + (i*1.2) + 'ms';
    grid.appendChild(cell);
  }
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        grid.querySelectorAll('.graph-cell').forEach(c => { c.style.opacity = '1'; });
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  obs.observe(grid);
})();

// ============================================
// SKILL TAGS STAGGER
// ============================================
(function() {
  const tags = document.querySelectorAll('.skills-tags span');
  if (!tags.length) return;
  tags.forEach(t => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; });
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tags.forEach((tag, i) => {
          setTimeout(() => {
            tag.style.transition = 'all 0.3s ease';
            tag.style.opacity = '1'; tag.style.transform = 'translateY(0)';
          }, i * 40);
        });
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  obs.observe(document.querySelector('.skills-tags'));
})();

// ============================================
// PROJECT CARD MOUSE GLOW
// ============================================
(function() {
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      card.style.background = `radial-gradient(circle at ${e.clientX-rect.left}px ${e.clientY-rect.top}px, var(--glow) 0%, var(--card-bg) 60%)`;
    });
    card.addEventListener('mouseleave', () => { card.style.background = ''; });
  });
})();

// ============================================
// RESUME DOWNLOAD EMOJI EFFECT
// ============================================
(function() {
  const resumeLinks = document.querySelectorAll('.resume-link');
  if (resumeLinks.length === 0) return;
  
  resumeLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Create floating emoji
      const emoji = document.createElement('div');
      emoji.textContent = '😂';
      emoji.style.position = 'fixed';
      emoji.style.fontSize = '3rem';
      emoji.style.pointerEvents = 'none';
      emoji.style.zIndex = '10001';
      emoji.style.left = (e.clientX - 24) + 'px';
      emoji.style.top = (e.clientY - 24) + 'px';
      emoji.style.animation = 'emojiFloat 2s ease-out forwards';
      document.body.appendChild(emoji);
      
      // Remove after animation
      setTimeout(() => emoji.remove(), 2000);
    });
  });
})();
