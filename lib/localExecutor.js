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

var executor = require('nscale-util').executor();



module.exports = function(config, commands, logger) {


  var nameFromBin = function(container) {
    var name = null;

    if (container.specific && container.specific.containerBinary) {
      var bin = container.specific.containerBinary.split('/');
      name = bin[bin.length - 1];
    }
    return name;
  };



  var deploy = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb();
  };



  var start = function(mode, targetHost, system, containerDef, container, out, cb) {
    var name = nameFromBin(container);
    name = system.namespace + '/' + name;
    var startCmd = commands.run.replace('__ARGUMENTS__', containerDef.specific.arguments);
    startCmd = startCmd.replace(/__TARGETNAME__/g, name);
    executor.exec(mode, startCmd, config.imageCachePath, out, function(err) {
      out.preview({cmd: startCmd, host: 'localhost'});
      cb(err);
    });
  };



  var link = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb();
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
    //var name = nameFromBin(container);

    executor.exec(mode, commands.deleteUntaggedContainers, config.imageCachePath, out, function(err) {
      out.preview({cmd: commands.deleteUntaggedContainers, host: 'localhost'});
      if (err && err.code !== 1) { cb(err); }
      executor.exec(mode, commands.deleteUntaggedImages, config.imageCachePath, out, function(err) {
        out.preview({cmd: commands.deleteUntaggedImages, host: 'localhost'});
        if (err && err.code !== 1) { cb(err); } else { cb(); }
        /* disabled undeploy
        if (name) {
          var removeCmd = REMOVE.replace('__TARGETNAME__', name);
          executor.exec(mode, removeCmd, config.imageCachePath, out, function(err) {
            out.preview({cmd: removeCmd, host: 'localhost'});
            cb(err);
          });
        }
        else {
          cb();
        }
        */
      });
    });
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

