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

// Generate a series of rotation matrices whose product will be the encryption key
const key_series = (num, dim) => {
  let result = [];
  for (let i=0; i<num; i++) {
    result.push(rand_rot(dim));
  }

  return result;
};


const aix = (a, ix) => math.subset(a, math.index(ix));

// Draw a matrix to a canvas, treating each entry as a grayscale pixel
const draw_matrix = (canvas, matrix) => {
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

const animate = (canvas, plaintext, matrices) => {
  let current = 0;
  let last = matrices.length - 1;
  let ciphertext = plaintext;

  let playing = false;
  let timeoutID = null;

  draw_matrix(canvas, ciphertext);

  let frame = () => {

    let key = matrices[current];

    ciphertext = math.multiply(key, ciphertext);
    draw_matrix(canvas, ciphertext);

    current += 1;

    if (current < last && playing) {
      timeoutID = window.setTimeout(frame, 100);
    } else {
      timeoutID = null;
    }
  };

  let togglePlay = () => {
    if (playing || timeoutID != null) {
      playing = false;
      if (timeoutID != null) {
        window.clearTimeout(timeoutID);
        timeoutID = null;
      }
    } else {
      playing = true;
      timeoutID = window.setTimeout(frame, 0);
    }
  };

  let reset = () => {
    playing = false;
    if (timeoutID != null) {
      window.clearTimeout(timeoutID);
    }
    current = 0;
    ciphertext = plaintext;
    draw_matrix(canvas, ciphertext);
  };

  let isPlaying = () => playing;

  return { togglePlay,
           reset,
           isPlaying };
};

const hegp = { rotation,
               rand_rot,
               key_series,
               draw_matrix,
               animate };

window.hegp = hegp;

window.math = math;
