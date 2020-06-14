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
  let last = keys.encrypt_series.length - 1;
  let final_ct = math.multiply(keys.encrypt_product, plaintext);

  let ciphertext = plaintext;

  let currentStep = -1;
  let atStart = () => currentStep === -1;
  let atEnd = () => currentStep === last+1;

  let paused = "paused";
  let playing = "playing";
  let rewinding = "rewinding";
  let animState = paused;

  let delay = 100.0;

  let timeoutID = null;

  const render = () => {
    let draw_matrix = draw_matrix_rects;
    draw_matrix(canvas, ciphertext);
  }
  render();

  const stopAnimation = () => {
    if (timeoutID !== null) {
      window.clearTimeout(timeoutID);
      timeoutID = null;
    }
  };

  const next = (animate) => {
    stopAnimation();
    if (currentStep < last) {
      // increment the current step
      currentStep += 1;

      // update the matrix
      let key = keys.encrypt_series[currentStep];
      ciphertext = math.multiply(key, ciphertext);

      // render to canvas
      render();

      // if currentStep is now the last step, set it to the end to
      // signify encryption steps are complete
      if (currentStep >= last) {
        currentStep = last + 1;
        stopAnimation();
      } else if (animate === true) {
        timeoutID = window.setTimeout(next, delay, true)
      }
    }
  };

  const prev = (animate) => {
    stopAnimation();
    if (currentStep >= 0) {
      if (atEnd()) {
        currentStep -= 1;
      }
      // update the matrix
      let key = keys.decrypt_series[currentStep];
      ciphertext = math.multiply(key, ciphertext);
      currentStep -= 1;

      // render to canvas
      render();

      // if currentStep is now the last step, set it to the end to
      // signify encryption steps are complete
      if (currentStep < 0) {
        currentStep = -1;
        stopAnimation();
      } else if (animate === true) {
        timeoutID = window.setTimeout(prev, delay, true)
      }
    }
  }


  const goto_start = () => {
    stopAnimation();
    ciphertext = plaintext;
    currentStep = -1;
    render();
  };

  const goto_end = () => {
    stopAnimation();
    ciphertext = final_ct;
    currentStep = last + 1;
    render();
  };

  let isPlaying = () => playing;

  let currentMatrix = () => ciphertext;

  return { next,
           prev,
           goto_start,
           goto_end,
           pause: stopAnimation
         };
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
