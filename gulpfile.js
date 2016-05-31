const gulp = require('gulp');
const plumber = require('gulp-plumber');
const rename = require('gulp-rename');
const stream = require('vinyl-source-stream');
const browserify = require('browserify');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const browserSync = require('browser-sync').create();
const del = require('del');
const ava = require('gulp-ava');


const source = './src';
const output = './lib';
const example = './example';

const javascript = `${source}/javascript`;
const styles = `${source}/styles/**/*.scss`;

gulp.task('javascript', () => {
  return browserify(javascript, {
    standalone: 'OCDL',
    extensions: ['.js'],
    debug: true
  }).bundle()
    .pipe(plumber())
    .pipe(stream(javascript))
    .pipe(rename('ocdl.js'))
    .pipe(gulp.dest(`${output}/javascript`))
    .pipe(gulp.dest(`${example}/js`));
});

gulp.task('styles', () => {
  return gulp.src(styles)
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(`${output}/styles`))
    .pipe(gulp.dest(`${example}/css`))
    .pipe(browserSync.stream());
});

gulp.task('clean', () => {
  return del(`${output}`);
});

gulp.task('serve', ['javascript', 'styles'], () => {
  const reload = browserSync.reload;

  browserSync.init({ server: './example' });

  gulp.task('javascript-watch', ['javascript'], reload);

  gulp.watch(`${javascript}/**/*.js`, ['javascript-watch']);
  gulp.watch(styles, ['styles']);
  gulp.watch(`${example}/**/*.html`).on('change', reload);
});

gulp.task('test', () => {
  gulp.src('test/**/*.js')
    .pipe(plumber())
    .pipe(ava());
});

gulp.task('build', ['clean', 'styles', 'javascript']);
