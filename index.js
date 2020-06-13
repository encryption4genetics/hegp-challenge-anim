const math = require('mathjs');
const chroma = require('./chroma.min.js');

// Generate n-by-n rotation matrix around given dimensions, with the
// given angle
const rotation = (n, r, a, b) => {
  let mat = math.identity(n);
  mat.subset(math.index(a, a), Math.cos(r));
  mat.subset(math.index(a, b), -Math.sin(r));
  mat.subset(math.index(b, a), Math.sin(r));
  mat.subset(math.index(b, b), Math.cos(r));
  return mat;
};


// Generate random n-by-n rotation matrix
const rand_rot = (n) => {
  let dim = () => Math.floor(Math.random() * n);
  let r = Math.random() * Math.PI * 2.0;
  let a = dim();
  let b = dim();
  while (a == b) {
    b = dim();
  }

  return rotation(n, r, a, b);
}

// Generate a series of rotation matrices whose product will be the
// encryption key; return both the rotation matrices, their inverses,
// and their products, going both ways.
const key_series = (num, dim) => {
  let encrypt = [];
  let decrypt = [];
  let encrypt_product = null;
  let decrypt_product = null;
  for (let i=0; i<num; i++) {
    let enc = rand_rot(dim);
    let dec = math.transpose(enc);
    if (encrypt_product === null) {
      encrypt_product = enc;
    } else {
      encrypt_product = math.multiply(enc, encrypt_product);
    }
    if (decrypt_product === null) {
      decrypt_product = dec;
    } else {
      // TODO should this multiplication be the other way around?
      decrypt_product = math.multiply(dec, decrypt_product);
    }
    encrypt.push(enc);
    decrypt.push(dec);
  }

  return { encrypt_series: encrypt,
           decrypt_series: decrypt,
           encrypt_product,
           decrypt_product }
};

const aix = (a, ix) => math.subset(a, math.index(ix));

const matrix_size = (matrix) => {
  let mat_size = math.size(matrix);
  let cs = aix(mat_size, 0);
  let rs = aix(mat_size, 1);
  return {width: cs, height: rs};
}

// Create an ImageBitmap of the matrix, with one pixel per matrix entry
// returns a promise
const matrix_bitmap = (ctx, matrix, colorscale) => {

  let colorfun = null;
  if (colorscale === undefined) {
    colorfun = chroma.scale(['#010122', 'red']).mode('hsl');
  } else {
    colorfun = colorscale;
  }

  let size = matrix_size(matrix);
  let imageData = ctx.createImageData(size.width, size.height);

  math.forEach(matrix, (v, ix, _) => {
    let x = aix(ix, 0);
    let y = aix(ix, 1);
    let i = 4 * (x + y * size.width);

    let color = colorfun(v).rgb();

    imageData.data[i]   = color[0];
    imageData.data[i+1] = color[1];
    imageData.data[i+2] = color[2];
    imageData.data[i+3] = 255;
  });

  return createImageBitmap(imageData);
};

const draw_matrix_bitmap = (canvas, matrix) => {
  let ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let w = canvas.width;
  let h = canvas.height;

  let bitmap = matrix_bitmap(ctx, matrix);

  bitmap.then((img) => {
    ctx.drawImage(img, 0, 0, w, h)
  });
};

// Draw a matrix to a canvas, treating each entry as a grayscale pixel
const draw_matrix_rects = (canvas, matrix, colorscale) => {

  let colorfun = null;
  if (colorscale === undefined) {
    colorfun = chroma.scale(['#010122', 'red']).mode('hsl');
  } else {
    colorfun = colorscale;
  }

  let ctx = canvas.getContext('2d');
  let w = canvas.width;
  let h = canvas.height;

  let mat_size = math.size(matrix);
  let cs = aix(mat_size, 0);
  let rs = aix(mat_size, 1);

  window.mat_size = mat_size;

  let blocksize = { width: w / cs, height: h / rs };

  math.forEach(matrix, (v, ix, _) => {
    let x = aix(ix, 0) * blocksize.width;
    let y = aix(ix, 1) * blocksize.height;

    let color = colorfun(v).hex();

    ctx.fillStyle = color;
    ctx.fillRect(x, y, blocksize.width, blocksize.height);
  });
};

const animate = (canvas, plaintext, keys) => {
  let current = 0;
  let last = keys.encrypt_series.length - 1;
  let final_ct = math.multiply(keys.encrypt_product, plaintext);
  let ciphertext = plaintext;

  let rewinding = false;
  let playing = false;
  let timeoutID = null;

  let draw_matrix = draw_matrix_rects;

  draw_matrix(canvas, ciphertext);

  let updateMatrix = (reverse) => {
    if (current === 0) {
      // ciphertext = plaintext;
    } else if (current === last) {
      // ciphertext = final_ct;
    } else {
      let key = reverse ? keys.decrypt_series[current] : keys.encrypt_series[current];
      ciphertext = math.multiply(key, ciphertext);
    }
  };

  let render = (reverse) => {
    draw_matrix(canvas, ciphertext);
  }

  let pause = () => {
    playing = false;
    if (timeoutID != null) {
      window.clearTimeout(timeoutID);
      timeoutID = null;
    }
  };

  const unpause = (reverse) => {
    playing = true;
    rewinding = reverse;
    if (timeoutID === null) {
      timeoutID = window.setTimeout(frame, 0);
    }
  };

  let play = () => {
    playing = true;
    rewinding = false;
    if (timeoutID === null) {
      timeoutID = window.setTimeout(frame, 0);
    }
  };

  let rewind = () => {
    playing = true;
    rewinding = true;
    if (timeoutID === null) {
      timeoutID = window.setTimeout(frame, 0);
    }
  };

  let frame = () => {
    if (rewinding) {
      prev();
    } else {
      next();
    }

    if (playing) {
      timeoutID = window.setTimeout(frame, 100);
    } else {
      timeoutID = null;
    }
  };

  let togglePlay = () => {
    if ((playing || timeoutID != null) && !rewinding) {
      pause();
    } else {
      play();
    }
  };

  let toggleRewind = () => {
    if ((playing || timeoutID != null) && rewinding) {
      pause();
    } else {
      rewind();
    }
  };

  let reset = () => {
    pause();
    ciphertext = plaintext;
    // updateMatrix();
    current = 0;
    render();
  };

  let goto_end = () => {
    pause();
    ciphertext = final_ct;
    // updateMatrix();
    current = last;
    render();
  };

  let next = () => {
    updateMatrix();
    current = Math.min(current+1, last);
    if (current === last) {
      playing = false;
    }
    render();
  };

  let prev = () => {
    updateMatrix(true);
    current = Math.max(current-1, 0);
    if (current === 0) {
      playing = false;
    }
    render(true);
  };

  let isPlaying = () => playing;

  let currentMatrix = () => ciphertext;

  return { togglePlay,
           toggleRewind,
           next,
           prev,
           reset,
           goto_end,
           isPlaying,
           currentMatrix, };
};

// TODO make this randomly generated or read from some data
const gen_plaintext = (n) => math.identity(n);

const hegp = { rotation,
               rand_rot,
               key_series,
               draw_matrix_rects,
               draw_matrix_bitmap,
               gen_plaintext,
               animate };

window.hegp = hegp;
