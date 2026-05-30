function rand(min, max) {
  return min + Math.random() * (max - min);
}

function createTextureCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function makeCanvasTexture(THREE, size, draw, options = {}) {
  const canvas = createTextureCanvas(size, size);
  const ctx = canvas.getContext("2d");
  draw(ctx, size, canvas);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = options.anisotropy ?? 2;
  texture.generateMipmaps = options.generateMipmaps ?? true;
  texture.minFilter = texture.generateMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (options.colorSpace !== false && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function makeEnvironmentTexture(THREE, palette) {
  const canvas = createTextureCanvas(256, 128);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = palette.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.anisotropy = 2;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
export function makeOrbPatternTexture(THREE, index, mode = "color") {
  return makeCanvasTexture(THREE, mode === "color" ? 192 : 96, (ctx, size) => {
    const style = index % 32;
    const isBump = mode === "bump";
    const isRoughness = mode === "roughness";
    const base = isBump ? 128 : isRoughness ? 152 : 224;
    ctx.fillStyle = `rgb(${base},${base},${base})`;
    ctx.fillRect(0, 0, size, size);

    function gray(v, a = 1) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
    }

    if (style === 0) {
      for (let i = 0; i < 180; i++) {
        gray(rand(104, 168), rand(0.05, 0.18));
        ctx.beginPath();
        ctx.arc(rand(0, size), rand(0, size), rand(1.5, 8), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 1) {
      for (let y = -size; y < size * 1.8; y += 18) {
        gray(isBump ? 92 : 190, isBump ? 0.3 : 0.18);
        ctx.save();
        ctx.translate(size * 0.5, size * 0.5);
        ctx.rotate(-0.38);
        ctx.fillRect(-size, y - size * 0.5, size * 2.4, isBump ? 4 : 8);
        ctx.restore();
      }
    } else if (style === 2) {
      for (let y = 0; y < size; y += 20) {
        const v = 128 + Math.sin(y * 0.075) * 52;
        gray(v, isBump ? 0.55 : 0.22);
        ctx.fillRect(0, y, size, isBump ? 3 : 10);
      }
    } else if (style === 3) {
      for (let i = 0; i < 28; i++) {
        gray(i % 2 ? 238 : 112, isBump ? 0.24 : 0.16);
        ctx.lineWidth = rand(1, isBump ? 4 : 9);
        ctx.beginPath();
        const x = rand(-80, size + 80);
        ctx.moveTo(x, rand(0, size));
        ctx.bezierCurveTo(x + rand(-80, 80), rand(0, size), x + rand(-120, 120), rand(0, size), x + rand(-160, 160), rand(0, size));
        ctx.stroke();
      }
    } else if (style === 4) {
      const tile = 64;
      for (let y = -tile; y < size + tile; y += tile) {
        for (let x = -tile; x < size + tile; x += tile) {
          gray((x / tile + y / tile) % 2 ? 180 : 92, isBump ? 0.28 : 0.13);
          ctx.beginPath();
          ctx.arc(x + tile * 0.5, y + tile * 0.5, tile * 0.43, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (style === 5) {
      for (let i = 0; i < 110; i++) {
        gray(rand(74, 190), rand(0.04, 0.16));
        ctx.fillRect(rand(0, size), rand(0, size), rand(12, 70), rand(1, 4));
      }
    } else if (style === 6) {
      for (let i = 0; i < 42; i++) {
        gray(i % 2 ? 232 : 82, isBump ? 0.25 : 0.12);
        ctx.lineWidth = rand(1, 5);
        ctx.beginPath();
        ctx.arc(rand(0, size), rand(0, size), rand(18, 95), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (style === 7) {
      for (let x = 0; x < size; x += 16) {
        gray(90 + (x % 48), isBump ? 0.22 : 0.1);
        ctx.fillRect(x, 0, 4, size);
      }
      for (let y = 0; y < size; y += 23) {
        gray(218, isBump ? 0.14 : 0.08);
        ctx.fillRect(0, y, size, 2);
      }
    } else if (style === 8) {
      for (let y = 0; y < size; y += 9) {
        const v = Math.floor(128 + Math.sin(y * 0.06) * 70);
        gray(v, isBump ? 0.32 : 0.14);
        ctx.fillRect(0, y, size, 2);
      }
    } else if (style === 9) {
      for (let i = 0; i < 75; i++) {
        gray(rand(88, 224), rand(0.07, 0.2));
        ctx.save();
        ctx.translate(rand(0, size), rand(0, size));
        ctx.rotate(rand(0, Math.PI));
        ctx.fillRect(-rand(8, 34), -1, rand(18, 90), rand(1, 5));
        ctx.restore();
      }
    } else if (style === 10) {
      for (let i = 0; i < 24; i++) {
        gray(i % 2 ? 236 : 98, isBump ? 0.18 : 0.11);
        ctx.lineWidth = rand(2, 7);
        ctx.beginPath();
        ctx.moveTo(rand(0, size), -20);
        ctx.bezierCurveTo(rand(0, size), size * 0.25, rand(0, size), size * 0.75, rand(0, size), size + 20);
        ctx.stroke();
      }
    } else if (style === 11) {
      for (let r = size * 0.08; r < size * 0.78; r += 18) {
        gray(r % 36 < 18 ? 232 : 88, isBump ? 0.26 : 0.12);
        ctx.lineWidth = isBump ? 3 : 6;
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (style === 12) {
      for (let i = 0; i < 85; i++) {
        const x = rand(0, size);
        const y = rand(0, size);
        gray(rand(70, 232), rand(0.08, 0.22));
        ctx.beginPath();
        ctx.moveTo(x, y - rand(8, 28));
        ctx.lineTo(x + rand(8, 28), y);
        ctx.lineTo(x, y + rand(8, 28));
        ctx.lineTo(x - rand(8, 28), y);
        ctx.closePath();
        isBump ? ctx.fill() : ctx.stroke();
      }
    } else if (style === 13) {
      for (let y = 0; y < size; y += 12) {
        gray(110 + Math.sin(y * 0.11) * 80, isBump ? 0.34 : 0.16);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= size; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.045 + y * 0.04) * 18);
        ctx.lineWidth = isBump ? 3 : 5;
        ctx.stroke();
      }
    } else if (style === 14) {
      const tile = 38;
      for (let y = -tile; y < size + tile; y += tile) {
        for (let x = -tile; x < size + tile; x += tile) {
          gray((x / tile + y / tile) % 2 ? 226 : 84, isBump ? 0.2 : 0.1);
          ctx.beginPath();
          ctx.moveTo(x + tile * 0.5, y);
          ctx.lineTo(x + tile, y + tile * 0.28);
          ctx.lineTo(x + tile, y + tile * 0.72);
          ctx.lineTo(x + tile * 0.5, y + tile);
          ctx.lineTo(x, y + tile * 0.72);
          ctx.lineTo(x, y + tile * 0.28);
          ctx.closePath();
          ctx.stroke();
        }
      }
    } else if (style === 15) {
      for (let i = 0; i < 36; i++) {
        gray(i % 3 === 0 ? 238 : rand(76, 178), isBump ? 0.24 : 0.12);
        ctx.lineWidth = rand(1, 5);
        ctx.beginPath();
        ctx.moveTo(rand(0, size), rand(0, size));
        ctx.lineTo(rand(0, size), rand(0, size));
        ctx.stroke();
      }
    } else if (style === 16) {
      for (let i = 0; i < 180; i++) {
        const w = rand(8, 45);
        gray(rand(82, 222), rand(0.035, 0.16));
        ctx.fillRect(rand(0, size), rand(0, size), w, w * rand(0.12, 0.38));
      }
    } else if (style === 17) {
      for (let y = 0; y < size; y += 7) {
        const v = 128 + Math.sin(y * 0.18) * 34 + Math.sin(y * 0.035) * 58;
        gray(v, isBump ? 0.38 : 0.16);
        ctx.fillRect(0, y, size, 2);
      }
      for (let i = 0; i < 18; i++) {
        gray(i % 2 ? 240 : 70, isBump ? 0.12 : 0.06);
        ctx.fillRect(rand(0, size), 0, rand(1, 3), size);
      }
    } else if (style === 18) {
      for (let i = 0; i < 52; i++) {
        gray(rand(82, 228), rand(0.06, 0.2));
        ctx.lineWidth = rand(1, 4);
        ctx.beginPath();
        ctx.arc(rand(0, size), rand(0, size), rand(6, 55), rand(0, Math.PI), rand(Math.PI, Math.PI * 2));
        ctx.stroke();
      }
    } else if (style === 19) {
      for (let i = 0; i < 320; i++) {
        gray(rand(66, 232), rand(0.035, 0.15));
        ctx.fillRect(rand(0, size), rand(0, size), rand(1, 14), rand(1, 14));
      }
    } else if (style === 20) {
      const tile = 34;
      for (let y = -tile; y < size + tile; y += tile * 0.82) {
        for (let x = -tile; x < size + tile; x += tile) {
          const xo = ((y / tile) & 1) ? tile * 0.5 : 0;
          gray(rand(72, 226), isBump ? 0.26 : 0.12);
          ctx.lineWidth = isBump ? 3 : 4;
          ctx.beginPath();
          ctx.ellipse(x + xo, y, tile * 0.48, tile * 0.33, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (style === 21) {
      for (let i = 0; i < 46; i++) {
        let x = rand(0, size);
        let y = rand(0, size);
        gray(i % 3 === 0 ? 245 : 58, isBump ? 0.18 : 0.09);
        ctx.lineWidth = rand(1, isBump ? 4 : 2.5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < rand(3, 8); j++) {
          x += rand(-34, 34);
          y += rand(-34, 34);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (style === 22) {
      for (let y = -20; y < size + 20; y += 8) {
        gray(128 + Math.sin(y * 0.17) * 86, isBump ? 0.34 : 0.14);
        ctx.lineWidth = isBump ? 2.5 : 3.5;
        ctx.beginPath();
        for (let x = -10; x <= size + 10; x += 8) {
          const yy = y + Math.sin(x * 0.08 + y * 0.045) * 22 + Math.sin(x * 0.025) * 14;
          if (x < 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    } else if (style === 23) {
      for (let i = 0; i < 135; i++) {
        const x = rand(0, size);
        const y = rand(0, size);
        const r = rand(5, 24);
        const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 1, x, y, r);
        grad.addColorStop(0, `rgba(255,255,255,${isBump ? 0.28 : 0.12})`);
        grad.addColorStop(0.55, `rgba(128,128,128,${isBump ? 0.14 : 0.07})`);
        grad.addColorStop(1, `rgba(20,20,20,${isBump ? 0.20 : 0.08})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 24) {
      for (let i = 0; i < 62; i++) {
        let x = Math.round(rand(0, size) / 16) * 16;
        let y = Math.round(rand(0, size) / 16) * 16;
        gray(i % 2 ? 235 : 74, isBump ? 0.22 : 0.10);
        ctx.lineWidth = rand(1.5, isBump ? 5 : 3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < rand(2, 6); j++) {
          if (Math.random() < 0.5) x += (Math.random() < 0.5 ? -1 : 1) * rand(16, 54);
          else y += (Math.random() < 0.5 ? -1 : 1) * rand(16, 54);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (Math.random() < 0.4) { ctx.beginPath(); ctx.arc(x, y, rand(2, 6), 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (style === 25) {
      for (let r = 4; r < size * 0.72; r += 6) {
        gray(128 + Math.sin(r * 0.22) * 96, isBump ? 0.30 : 0.12);
        ctx.lineWidth = isBump ? 2.2 : 3.2;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2.2; a += 0.09) {
          const rr = r + Math.sin(a * 5.0 + r * 0.12) * 5;
          const x = size * 0.5 + Math.cos(a) * rr * 0.68;
          const y = size * 0.52 + Math.sin(a) * rr * 0.48;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (style === 26) {
      for (let i = 0; i < 95; i++) {
        const x = rand(-20, size + 20);
        const y = rand(-20, size + 20);
        const r = rand(10, 42);
        gray(rand(68, 238), isBump ? 0.24 : 0.12);
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * rand(0.35, 0.9), y - r * rand(0.05, 0.55));
        ctx.lineTo(x + r * rand(0.25, 0.75), y + r * rand(0.35, 0.95));
        ctx.lineTo(x - r * rand(0.45, 0.95), y + r * rand(0.05, 0.65));
        ctx.closePath();
        isBump ? ctx.stroke() : ctx.fill();
      }
    } else if (style === 27) {
      for (let x = -40; x < size + 40; x += 11) {
        gray(128 + Math.sin(x * 0.09) * 76, isBump ? 0.32 : 0.13);
        ctx.lineWidth = isBump ? 3 : 5;
        ctx.beginPath();
        for (let y = -20; y <= size + 20; y += 10) {
          const xx = x + Math.sin(y * 0.065 + x * 0.04) * 28;
          if (y < 0) ctx.moveTo(xx, y);
          else ctx.lineTo(xx, y);
        }
        ctx.stroke();
      }
    } else if (style === 28) {
      for (let i = 0; i < 250; i++) {
        const r = rand(1.5, 10);
        gray(Math.random() < 0.18 ? rand(210, 255) : rand(42, 148), rand(0.035, isBump ? 0.22 : 0.12));
        ctx.beginPath();
        ctx.arc(rand(0, size), rand(0, size), r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 29) {
      for (let i = 0; i < 42; i++) {
        const x = rand(0, size);
        const y = rand(0, size);
        const r = rand(18, 78);
        const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
        grad.addColorStop(0, `rgba(255,255,255,${isBump ? 0.20 : 0.16})`);
        grad.addColorStop(0.55, `rgba(150,150,150,${isBump ? 0.11 : 0.08})`);
        grad.addColorStop(1, "rgba(128,128,128,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 30) {
      for (let i = -8; i < 28; i++) {
        gray(i % 2 ? 238 : 78, isBump ? 0.25 : 0.11);
        ctx.lineWidth = isBump ? 5 : 8;
        ctx.beginPath();
        for (let x = -20; x <= size + 20; x += 12) {
          const y = i * 18 + Math.sin(x * 0.055 + i) * 18 + x * 0.18;
          if (x < -10) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 190; i++) {
        const x = rand(0, size);
        const y = rand(0, size);
        gray(rand(70, 238), rand(0.04, isBump ? 0.20 : 0.10));
        ctx.lineWidth = rand(1, 3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rand(-18, 18), y + rand(-18, 18));
        if (Math.random() < 0.5) ctx.lineTo(x + rand(-18, 18), y + rand(-18, 18));
        ctx.stroke();
      }
    }

    if (!isBump) {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, "rgba(255,255,255,0.18)");
      grad.addColorStop(0.52, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.globalAlpha = isRoughness ? 0.16 : 0.28;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }

    ctx.globalAlpha = 1;
  }, {
    anisotropy: mode === "color" ? 2 : 1,
    colorSpace: mode === "color",
    generateMipmaps: mode === "color",
  });
}
