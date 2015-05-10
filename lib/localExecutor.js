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

var async = require('async');
var executor = require('nscale-util').executor();
var toTargetIp = require('nscale-target-ip');


module.exports = function(config, commands, logger) {


  var deploy = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb();
  };



  var start = function(mode, targetHost, system, containerDef, container, out, cb) {
    var startCmd;
    var executeOpts = container.specific.execute  ? container.specific.execute : containerDef.specific.execute || {};
    var args = executeOpts.args || ' -d';
    var exec = executeOpts.exec || '';
    var tag = commands.generateTag(config, system, containerDef);

    if (args.indexOf('-d') === -1) {
      args += ' -d';
    }

    startCmd = [
      commands.execute,
      args,
      tag,
      exec,
      '&& docker tag',
      tag,
      tag + ':' + Date.now()
    ].join(' ');

    startCmd = startCmd.replace(/__TARGETIP__/g, toTargetIp(targetHost.privateIpAddress));

    executor.exec(mode, startCmd, config.imageCachePath, out, function(err) {
      out.preview({cmd: startCmd, host: 'localhost'});
      cb(err);
    });
  };


  var purgeImages = function(config, mode, executor, containerDef, out, cb) {
    var toPurge = commands.generatePurgeCommands(containerDef);
    if (toPurge) {
      async.eachSeries(toPurge, function(purge, next) {
        executor.exec(mode, commands.rmi + purge, config.imageCachePath, out, function(err) {
          next(err);
        });
      }, function(err) {
        cb(err);
      });
    }
    else {
      cb();
    }
  };



  var link = function(mode, targetHost, system, containerDef, container, out, cb) {
    purgeImages(config, mode, executor, containerDef, out, function(err) {
      cb(err);
    });
  };



  var unlink = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb();
  };



  /**
   * stop needs to 
   */
  var stop = function(mode, targetHost, system, containerDef, container, out, cb) {
    if (container.specific && container.specific.dockerContainerId) {
      var stopCmd = commands.kill.replace('__TARGETID__', container.specific.dockerContainerId);
      executor.exec(mode, stopCmd, config.imageCachePath, out, function(err) {
        out.preview({cmd: stopCmd, host: 'localhost'});
        if (err && err.code !== 2) { cb(err); } else { cb(); }
      });
    }
    else {
      cb();
    }
  };



  /**
   * leave container in place clean down untagged
   */
  var undeploy = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb(null);
  };



  var construct = function() {
  };



  construct();
  return {
    deploy: deploy,
    start: start,
    link: link,
    unlink: unlink,
    stop: stop,
    undeploy: undeploy
  };
};

