const gulp = require('gulp');
const ava = require('gulp-ava');

gulp.task('test', () => {
  gulp.src('test/**/*.js')
    .pipe(ava());
});
