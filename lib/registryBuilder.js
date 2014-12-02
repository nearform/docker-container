
'use strict';

var findImage = require('./docker').findImage;
var toTargetIp = require('nscale-target-ip');
var exitError = require('exit-error');
var spawnCommand = require('spawn-command');
var pipeChildStdioToOut = require('./pipe-child-stdio-to-out');

module.exports = function(config, logger) {

  var execute = function(cmd, out, cb) {
    var child = spawnCommand(cmd);
    pipeChildStdioToOut(child, out);
    child.on('exit', function(code, signal) {
      cb(exitError(cmd, code, signal));
    });
  };

  /**
   * build the container
   * system - the system definition
   * cdef - contianer definition block
   * out - ouput stream
   * cb - complete callback
   */
  var build = function build(mode, system, containerDef, out, cb) {
    var name = containerDef.specific.name;

    if (!name) {
      return cb(new Error('missing name for definition ' + containerDef.id));
    }

    if (!containerDef.specific.execute) {
      return cb(new Error('missing execute block in ' + containerDef.id + ' container definition'));
    }

    var pullCmd = 'docker pull ' + name;
    var tag = system.name + '/' + containerDef.id;
    var tagCmd = 'docker tag ' + name + ' ' + tag;

    execute(pullCmd, out, function(err) {
      if (err) {
        return cb(err);
      }

      execute(tagCmd, out, function(err) {

        if (err) {
          return cb(err);
        }

        findImage(tag, function(err, image) {
          if (err) {
            return cb(err);
          }

          var registryTag = config.registry + '/' + tag;
          var pullCmd = 'docker tag ' + tag + ' ' + registryTag + ' && docker push ' + registryTag;
          execute(pullCmd, out, function(err) {
            if (err) {
              return cb(err);
            }

            cb(null, {
              dockerImageId: image.Id,
              dockerLocalTag: registryTag,
              imageTag: tag
            });
          });
        });
      });
    });
  };

  return {
    build: build
  }
};
