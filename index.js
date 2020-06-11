const math = require('mathjs');

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
      encrypt_product = math.multiply(encrypt_product, enc);
    }
    if (decrypt_product === null) {
      decrypt_product = dec;
    } else {
      // TODO should this multiplication be the other way around?
      decrypt_product = math.multiply(decrypt_product, dec);
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
const matrix_bitmap = (ctx, matrix) => {

  let size = matrix_size(matrix);
  let imageData = ctx.createImageData(size.width, size.height);

  math.forEach(matrix, (v, ix, _) => {
    let x = aix(ix, 0);
    let y = aix(ix, 1);
    let i = 4 * (x + y * size.width);

    imageData.data[i]   = Math.floor(v * 255);
    imageData.data[i+1] = 0; // Math.floor(v * 255);
    imageData.data[i+2] = 0; // Math.floor(v * 255);
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
const draw_matrix_rects = (canvas, matrix) => {
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

    let fs = "rgb(" + Math.floor(v * 255) + ",0,0)";

    window.matfs = fs;

    ctx.fillStyle = fs;
    ctx.fillRect(x, y, blocksize.width, blocksize.height);
  });
};

const animate = (canvas, plaintext, keys) => {
  let current = 0;
  let last = keys.length - 1;
  let final_ct = math.multiply(keys.encrypt_product, plaintext);
  let ciphertext = plaintext;

  let playing = false;
  let timeoutID = null;

  let draw_matrix = draw_matrix_bitmap;

  draw_matrix(canvas, ciphertext);

  let render = () => {
    if (current === 0) {
      ciphertext = plaintext;
    } else if (current === last) {
      ciphertext = final_ct;
    } else {
      let key = matrices[current];
      ciphertext = math.multiply(key, ciphertext);
    }
    draw_matrix(canvas, ciphertext);
  }

  let pause = () => {
    playing = false;
    if (timeoutID != null) {
      window.clearTimeout(timeoutID);
      timeoutID = null;
    }
  };

  let play = () => {
    playing = true;
    if (timeoutID === null) {
      timeoutID = window.setTimeout(frame, 0);
    }
  };

  let frame = () => {
    render();
    current += 1;

    if (current < last && playing) {
      timeoutID = window.setTimeout(frame, 100);
    } else {
      timeoutID = null;
    }
  };

  let togglePlay = () => {
    if (playing || timeoutID != null) {
      pause();
    } else {
      play();
    }
  };

  let reset = () => {
    pause();
    current = 0;
    render();
  };

  let goto_end = () => {
    pause();
    current = last;
    render();
  };

  let next = () => {
    pause();
    current = Math.min(current+1, last);
    render();
  };

  let prev = () => {
    pause();
    current = Math.max(current-1, 0);
    render();
  };

  let isPlaying = () => playing;

  let currentMatrix = () => ciphertext;

  return { togglePlay,
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
