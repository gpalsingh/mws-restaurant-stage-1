// generated on 2018-07-16 using generator-webapp 3.0.1
const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const browserSync = require('browser-sync').create();
const del = require('del');
const wiredep = require('wiredep').stream;
const runSequence = require('run-sequence');
const responsive = require('gulp-responsive');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const log = require('fancy-log');
const es = require('event-stream');
const rename = require('gulp-rename');
const concat = require('gulp-concat');
const ico = require('gulp-to-ico');

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

let dev = true;

gulp.task('styles', () => {
  return gulp.src('app/styles/*.css')
    .pipe($.if(dev, $.sourcemaps.init()))
    .pipe($.autoprefixer({browsers: ['> 1%', 'last 2 versions', 'Firefox ESR']}))
    .pipe($.cssnano({safe: true, autoprefixer: false}))
    .pipe($.if(dev, $.sourcemaps.write()))
    .pipe(gulp.dest('dist/css'))
    .pipe(reload({stream: true}));
});

gulp.task('scripts', () => {
  return gulp.src('app/scripts/**/*.js')
    //.pipe($.plumber())
    .pipe($.if(dev, $.sourcemaps.init()))
    .pipe($.babel())
    //.pipe($.uglify({compress: {drop_console: true}}))
    .pipe($.if(dev, $.sourcemaps.write('.')))
    .pipe(gulp.dest('dist/js'))
    .pipe(reload({stream: true}));
});

gulp.task('sw', () => {
  return gulp.src(['app/scripts/lib/idb.js', 'app/scripts/common.js', 'app/sw.js'])
    .pipe(concat('sw.js'))
    //.pipe($.plumber())
    .pipe($.babel())
    //.pipe($.uglify({compress: {drop_console: true}}))
    .pipe(gulp.dest('dist'))
    .pipe(reload({stream: true}));
});

function lint(files) {
  return gulp.src(files)
    .pipe($.eslint({ fix: true }))
    .pipe(reload({stream: true, once: true}))
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
}

gulp.task('lint', () => {
  return lint('app/scripts/**/*.js')
    .pipe(gulp.dest('app/scripts'));
});

gulp.task('lint:test', () => {
  return lint('test/spec/**/*.js')
    .pipe(gulp.dest('test/spec'));
});

gulp.task('html', ['styles', 'scripts'], () => {
  return gulp.src('app/*.html')
    .pipe($.useref({searchPath: ['.tmp', 'app', '.']}))
    //.pipe($.if(/\.js$/, $.uglify({compress: {drop_console: false}})))
    .pipe($.if(/\.css$/, $.cssnano({safe: true, autoprefixer: false})))
    .pipe($.if(/\.html$/, $.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      //minifyJS: {compress: {drop_console: false}},
      processConditionalComments: true,
      removeComments: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true
    })))
    .pipe(gulp.dest('dist'));
});

gulp.task('images', ['responsive-icons'], () => {
  //Delete old processed images
  del.sync(['app/images/responsive/*.jpg', '!app/images/responsive']);
  //Create new processed images
  return gulp.src('app/images/**/*')
    .pipe(responsive({
      '*.jpg': [{
        width: 800,
        rename: {suffix: '-large-1x'},
      }, {
        width: 1600,
        rename: {suffix: '-large-2x'},
        withoutEnlargement: false,
      }, {
        width: 700,
        rename: {suffix: '-medium'},
      }, {
        width: 500,
        rename: {suffix: '-small'},
      }],
    }, {
      quality: 30,
      progressive: true,
      withMetadata: false,
    }))
    .pipe($.cache($.imagemin([], {})))
    .pipe(gulp.dest('dist/images'));
});

gulp.task('responsive-icons', () => {
  return gulp.src('app/icon/*')
    .pipe(responsive({
      '*.png': [{
        width: 48,
        rename: {suffix: '-48'},
      }, {
        width: 72,
        rename: {suffix: '-72'},
      }, {
        width: 96,
        rename: {suffix: '-96'},
      }, {
        width: 128,
        rename: {suffix: '-128'},
      }, {
        width: 512,
        rename: {suffix: '-512'},
        withoutEnlargement: false,
      },
      {
        quality: 50,
        withMetadata: false,
      }]
    }))
    .pipe(gulp.dest('dist/icon'));
});

gulp.task('fonts', () => {
  return gulp.src(require('main-bower-files')('**/*.{eot,svg,ttf,woff,woff2}', function (err) {})
    .concat('app/fonts/**/*'))
    .pipe($.if(dev, gulp.dest('.tmp/fonts'), gulp.dest('dist/fonts')));
});

gulp.task('extras', () => {
  return gulp.src([
    'app/*',
    '!app/*.html',
    '!app/sw.js'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));
});

gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

gulp.task('serve', () => {
  runSequence(['clean', 'wiredep'], ['styles', 'scripts', 'sw', 'fonts'], () => {
    browserSync.init({
      notify: false,
      port: 9000,
      server: {
        baseDir: ['.tmp', 'app'],
        routes: {
          '/bower_components': 'bower_components'
        }
      }
    });

    gulp.watch([
      'app/*.html',
      'app/images/**/*',
      '.tmp/fonts/**/*'
    ]).on('change', reload);

    gulp.watch('app/styles/**/*.css', ['styles']);
    gulp.watch('app/scripts/**/*.js', ['scripts']);
    gulp.watch('app/sw.js', ['sw']);
    gulp.watch('app/fonts/**/*', ['fonts']);
    gulp.watch('bower.json', ['wiredep', 'fonts']);
  });
});

gulp.task('serve:dist', ['default'], () => {
  browserSync.init({
    notify: false,
    port: 9000,
    server: {
      baseDir: ['dist']
    }
  });

  gulp.watch('app/*.html', ['html']).on('change', reload);
  gulp.watch('app/images/original/**/*', ['images']).on('change', reload);
  gulp.watch('app/styles/**/*.css', ['styles']);
  gulp.watch('app/scripts/**/*.js', ['scripts']);
  gulp.watch(['app/sw.js', 'app/scripts/common.js'], ['sw']);
  gulp.watch('app/fonts/**/*', ['fonts']);
  gulp.watch('bower.json', ['wiredep', 'fonts']);
});

gulp.task('serve:test', ['scripts'], () => {
  browserSync.init({
    notify: false,
    port: 9000,
    ui: false,
    server: {
      baseDir: 'test',
      routes: {
        '/scripts': 'dist/js',
        '/bower_components': 'bower_components'
      }
    }
  });

  gulp.watch('app/scripts/**/*.js', ['scripts']);
  gulp.watch(['test/spec/**/*.js', 'test/index.html']).on('change', reload);
  gulp.watch('test/spec/**/*.js', ['lint:test']);
});

// inject bower components
gulp.task('wiredep', () => {
  gulp.src('app/*.html')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)*\.\./
    }))
    .pipe(gulp.dest('app'));
});

gulp.task('build', ['lint', 'html', 'images', 'fonts', 'extras', 'sw'], () => {
  return gulp.src('dist/**/*').pipe($.size({title: 'build'}));
});

gulp.task('default', () => {
  return new Promise(resolve => {
    dev = false;
    runSequence(['clean', 'wiredep'], 'build', resolve);
  });
});