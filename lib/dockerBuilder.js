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
var p = require('path');



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

  var generateTargetPath = function(system, options, containerDef) {
    var re = /.*?\/([^\/]*?)\.git/i;
    var rpath = re.exec(containerDef.specific.repositoryUrl);
    var result = p.join(system.repoPath, 'workspace', containerDef.specific.checkoutDir || rpath[1]);
    console.log('RESULT', result);
    return result;
  };

  var createImage = function(mode, system, containerDef, targetPath, out, cb) {
    var cmds = commands(platform);
    var path = process.cwd();

    if (containerDef.specific.repositoryUrl) {
      path = generateTargetPath(system, config, containerDef);
    }

    path = path + '/';

    out.stdout('creating image');
    logger.info('creating image');

    var script = cmds.generateBuildScript(config, system, containerDef);
    logger.debug('docker build script: ' + script);

    executor.exec(mode, script, path + targetPath, out, function(err) {
      if (err) {
        return cb(err);
      }

      out.progress('pushing to registry');
      script = cmds.generatePushScript(config, system, containerDef);
      logger.debug('docker push script: ' + script);

      executor.exec(mode, script, path + targetPath, out, function(err) {
        if (err) {
          return cb(err);
        }

        out.progress('created image');
        cb();
      });
    });
  };



  var build = function(mode, system, containerDef, out, cb) {
    var path;

    if (preCheck()) {
      if (containerDef.specific.buildScript) {
        path = generateTargetPath(system, config, containerDef);
        logger.info('running build script: sh ./' + containerDef.specific.buildScript);
        out.progress('running build script: ./' + containerDef.specific.buildScript);
        executor.exec(mode, 'sh ./' + containerDef.specific.buildScript, path, out, function(err, targetPath) {
          if (err) {
            return cb(err);
          }

          createImage(mode, system, containerDef, targetPath, out, cb);
        });
      }
      else {
        logger.info('no build script present, skipping');
        createImage(mode, system, containerDef, '.', out, cb);
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

