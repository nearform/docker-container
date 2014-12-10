/*
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
 * IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

var fse = require('fs-extra');
var fs = require('fs');
var logger = require('bunyan').createLogger({name: 'docker-container'});
var executor = require('nscale-util').executor();
var docker = require('./docker');
var commands = require('./platform').commands;



/**
 * docker specific build process
 */
module.exports = function(config, platform) {


  /**
   * check that docker is able to run on this system
   */
  var preCheck = function() {
    var stat = fs.existsSync('/var/run/docker.sock');
    if (!stat) {
      stat = process.env.DOCKER_HOST || false;
    }
    return stat;
  };



  var readVersion = function(path) {
    var version = 'unspecified';
    var pkg;

    try {
      pkg = fs.readFileSync(path + '/package.json');
      version = JSON.parse(pkg).version;
    }
    catch (e) {
      // ignore parse errors
    }
    return version;
  };



  var generateTargetPath = function(system, options, containerDef) {
    var root = system.repoPath + '/workspace';
    var re = /.*?\/([^\/]*?)\.git/i;
    var rpath = re.exec(containerDef.specific.repositoryUrl);
    return root + '/' + rpath[1];
  };



  var generateBuildPath = function(system, options) {
    var buildPath = system.repoPath + '/builds';
    return buildPath;
  };




  var generateBuildScript = function(system, targetName, containerDef) {
    var cmds = commands(platform);
    var script = cmds.build;

    script = script.replace(/__NAMESPACE__/g, system.namespace);
    script = script.replace(/__TARGETNAME__/g, targetName);
    script = script.replace(/__BUILDNUMBER__/g, containerDef.specific.buildHead);

    return script;
  };



  var generatePushScript = function(system, targetName, containerDef, buildPath) {
    var cmds = commands(platform);
    var script;

    script = cmds.push;
    script = script.replace(/__REGISTRY__/g, config.registry);
    script = script.replace(/__NAMESPACE__/g, system.namespace);
    script = script.replace(/__TARGETNAME__/g, targetName);
    script = script.replace(/__BUILDNUMBER__/g, containerDef.specific.buildHead);
    script = script.replace(/__BUILDPATH__/g, buildPath);
    return script;
  };



  var createImage = function(mode, system, containerDef, targetPath, out, cb) {
    var targetName = containerDef.name.replace(' ', '_');
    var path = generateTargetPath(system, config, containerDef);
    var buildPath = generateBuildPath(system, config);

    out.stdout('creating image');
    logger.info('creating image');

    fse.mkdirp(buildPath);
    path = path + '/';

    var script = generateBuildScript(system, targetName, containerDef);
    logger.debug('docker build script: ' + script);

    executor.exec(mode, script, path + targetPath, out, function(err) {
      if (err) {
        return cb(err);
      }

      out.progress('pushing to registry');
      script = generatePushScript(system, targetName, containerDef, buildPath);
      logger.debug('docker push script: ' + script);

      executor.exec(mode, script, path + targetPath, out, function(err) {
        if (err) {
          return cb(err);
        }

        out.progress('creating image');

        docker.findImage(system.namespace + '/' + targetName + '-' + containerDef.specific.buildHead, function(err, image) {
          var result;

          if (image) {
            result = {
              dockerImageId: image.Id,
              dockerLocalTag: config.registry + '/' + system.namespace + '/' + targetName + '-' + containerDef.specific.buildHead,
              buildNumber: containerDef.specific.buildHead
            };
          }

          cb(err, result);
        });
      });
    });
  };



  var build = function(mode, system, containerDef, out, cb) {
    var path = generateTargetPath(system, config, containerDef);
    var version = readVersion(path);

    function deliver(err, specific) {
      if (err) {
        return cb(err);
      }

      specific.version = version;
      containerDef.version = version;

      cb(null, specific);
    }

    if (preCheck()) {
      if (containerDef.specific.buildScript) {
        logger.info('running build script: sh ./' + containerDef.specific.buildScript);
        out.progress('running build script: ./' + containerDef.specific.buildScript);
        executor.exec(mode, 'sh ./' + containerDef.specific.buildScript, path, out, function(err, targetPath) {
          if (err) {
            return cb(err);
          }

          createImage(mode, system, containerDef, targetPath, out, deliver);
        });
      }
      else {
        logger.info('no build script present, skipping');
        out.progress('no build script present, skipping');
        createImage(mode, system, containerDef, '.', out, deliver);
      }
    }
    else {
      cb('docker precheck failed, please enusure that docker can run on this system', null);
    }
  };



  return {
    build: build,
  };
};

