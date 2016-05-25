const gulp = require('gulp');
const plumber = require('gulp-plumber');
const ava = require('gulp-ava');


gulp.task('test', () => {
  gulp.src('test/**/*.js')
    .pipe(plumber())
    .pipe(ava());
});
