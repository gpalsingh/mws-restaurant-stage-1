module.exports = function(grunt) {

  grunt.initConfig({
    responsive_images: {
      dev: {
        options: {
          engine: 'gm',
          sizes: [{
            width: 800,
            name: 'large-1x',
            rename: 'false',
            quality: 30
          }, {
            width: 1600,
            name: 'large-2x',
            rename: 'false',
            quality: 20,
            upscale: 'true'
          }, {
            width: 700,
            name: 'medium',
            rename: 'false',
            quality: 30
          }, {
            width: 500,
            name: 'small',
            rename: 'false',
            quality: 30
          }]
        },
        files: [{
          expand: true,
          src: ['*.{gif,jpg,png}'],
          cwd: 'img/',
          dest: 'img_res/'
        }]
      }
    },
  });

  grunt.loadNpmTasks('grunt-responsive-images');
  grunt.registerTask('default', ['responsive_images']);

};
