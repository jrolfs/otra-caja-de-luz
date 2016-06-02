const gulp = require('gulp');
const util = require('gulp-util');
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
    .on('error', function (error) {
      util.log(error);
      this.emit('end');
    })
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

gulp.task('fonts', () => {
  return gulp.src('./node_modules/font-awesome/fonts/**/*.{ttf,woff,eof,svg}')
    .pipe(gulp.dest(`${example}/fonts`));
});

gulp.task('clean', () => {
  return del(`${output}/**/*`);
});

gulp.task('serve', ['javascript', 'styles', 'fonts'], () => {
  browserSync.init({ server: './example' });

  gulp.watch(`${javascript}/**/*.js`, ['javascript']);
  gulp.watch(styles, ['styles']);
  gulp.watch(`${example}/**/*.+(html|js)`).on('change', browserSync.reload);
});

gulp.task('test', () => {
  gulp.src('test/**/*.js')
    .pipe(plumber())
    .pipe(ava());
});

gulp.task('build', ['clean', 'javascript', 'styles', 'fonts']);
