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

var portscanner = require('portscanner');
var sshCheck = require('nscale-util').sshcheck();
var path = require('path');
var POLL_INTERVAL = 5000;
var MAX_POLLS = 14;
var missingImage = require('./errors').missingImage;


module.exports = function(config, commands, logger) {
  var ssh = require('nscale-util').sshexec();
  var scp = require('nscale-util').sshcp();
  var pollCount = 0;


  var pollForConnectivity = function(mode, user, sshKeyPath, ipaddress, out, cb) {
    if (mode !== 'preview' && ipaddress && ipaddress !== '127.0.0.1' && ipaddress !== 'localhost') {
      logger.info({
        user: user,
        identityFile: sshKeyPath,
        ipAddress: ipaddress
      }, 'waiting for connectivity');

      portscanner.checkPortStatus(22, ipaddress, function(err, status) {
        if (status === 'closed') {
          if (pollCount > MAX_POLLS) {
            pollCount = 0;
            cb('timeout exceeded - unable to connect to: ' + ipaddress);
          }
          else {
            pollCount = pollCount + 1;
            setTimeout(function() { pollForConnectivity(mode, user, sshKeyPath, ipaddress, out, cb); }, POLL_INTERVAL);
          }
        }
        else if (status === 'open') {
          pollCount = 0;
          sshCheck.check(ipaddress, user, sshKeyPath, out, function(err) {
            cb(err);
          });
        }
      });
    }
    else {
      cb();
    }
  };



  var nameFromBin = function(container) {
    var name = null;

    if (container.specific && container.specific.containerBinary) {
      var bin = container.specific.containerBinary.split('/');
      name = bin[bin.length - 1];
    }
    return name;
  };

  var getUser = function(target) {
    return target.user || config.user || commands.defaultUser;
  };

  var getSshKeyPath = function(system, target) {
    if (target && target.identityFile) {
      return path.resolve(system.repoPath, target.identityFile);
    }
    return config.identityFile;
  };

  var deploy = function(mode, targetHost, system, containerDef, container, out, cb) {
    var user = getUser(targetHost);
    var sshKeyPath = getSshKeyPath(system, targetHost);
    var containersFolder = path.join('/home', user, 'containers');

    if (containerDef.specific.dockerImageId) {
      return cb(new Error(missingImage(containerDef)));
    }

    pollForConnectivity(mode, user, sshKeyPath, targetHost.privateIpAddress, out, function(err) {
      if (err) { return cb(err); }

      logger.info(targetHost, 'target online');

      ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, 'mkdir -p "' + containersFolder  + '"', function(err, op) {
        out.preview(op);
        if (err) { return cb(err); }
        var name = nameFromBin(container);
        var containerPath = path.join(containersFolder, name);

        logger.info({ folder: containersFolder }, 'created folder');

        ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, '[ ! -f ' + containerPath  + ' ] && echo "notfound"', function(err, op, response) {
          out.preview(op);
          if (err) { return cb(err); }
          if (response && 'notfound' === response.trim()) {
            logger.info({ file: containerPath, from: container.specific.containerBinary }, 'uploading container');
            scp.copy(mode, targetHost.privateIpAddress, user, sshKeyPath, container.specific.containerBinary, containerPath, out, function(err, op) {
              out.preview(op);
              if (err) { return cb(err); }
              var importCommand = commands.import.replace('__BINARY__', containerPath);
              importCommand = importCommand.replace('__TARGETNAME__', name);
              logger.info({ file: containerPath }, 'importing container');
              ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, importCommand, function(err, op) {
                logger.info({ file: containerPath }, 'container imported');
                out.preview(op);
                cb(err);
                //setTimeout(function() { cb(err); }, 10000);
              });
            });
          }
          else {
            ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, 'sudo docker images', function(err, op, images) {
              out.preview(op);
              if (err) { return cb(err); }
              var re = new RegExp(name, ['g']);
              if (!re.test(images)) {
                logger.info({ file: containerPath }, 'importing container');
                var importCommand = commands.import.replace('__BINARY__', path.join(containersFolder, name));
                importCommand = importCommand.replace('__TARGETNAME__', name);
                ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, importCommand, function(err, op) {
                  logger.info({ file: containerPath }, 'container imported');
                  out.preview(op);
                  cb(err);
                  //setTimeout(function() { cb(err); }, 10000);
                });
              }
              else {
                logger.info({ file: containerPath }, 'container already present');
                cb(err);
              }
            });
          }
        });
      });
    });
  };



  var start = function(mode, targetHost, system, containerDef, container, out, cb) {
    var user = getUser(targetHost);
    var sshKeyPath = getSshKeyPath(system, targetHost);
    var executeOpts = containerDef.specific.execute || {};
    var args = executeOpts.args || '-d';
    var exec = executeOpts.exec || '';

    if (containerDef.specific.dockerImageId) {
      return cb(new Error(missingImage(containerDef)));
    }

    var startCmd = [
      commands.execute,
      args,
      containerDef.specific.dockerImageId,
      exec
    ].join(' ');

    startCmd.replace('__TARGETIP__', targetHost.privateIpAddress);

    pollForConnectivity(mode, user, sshKeyPath, targetHost.privateIpAddress, out, function(err) {
      if (err) { return cb(err); }
      ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, startCmd, function(err, op) {
        out.preview(op);
        cb(err);
      });
    });
  };



  var link = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb();
  };



  var unlink = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb();
  };



  var stop = function(mode, targetHost, system, containerDef, container, out, cb) {
    var user = getUser(targetHost);
    var sshKeyPath = getSshKeyPath(system, targetHost);

    if (container.specific && container.specific.dockerContainerId) {
      var stopCmd = commands.kill.replace('__TARGETID__', container.specific.dockerContainerId);

      pollForConnectivity(mode, user, sshKeyPath, targetHost.privateIpAddress, out, function(err) {
        if (err) { return cb(err); }
        ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, stopCmd, function(err, op) {
          out.preview(op);
          cb(err);
        });
      });
    }
    else {
      cb();
    }
  };



  var undeploy = function(mode, targetHost, system, containerDef, container, out, cb) {
    var user = getUser(targetHost);
    var sshKeyPath = getSshKeyPath(system, targetHost);

    pollForConnectivity(mode, user, sshKeyPath, targetHost.privateIpAddress, out, function(err) {
      if (err) { return cb(err); }
      ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, commands.deleteUntaggedContainers, function(err, op) {
        out.preview(op);
        ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, commands.deleteUntaggedImages, function(err, op) {
          out.preview(op);
          cb();
        });
      });
    });
  };



  return {
    deploy: deploy,
    undeploy: undeploy,
    start: start,
    link: link,
    unlink: unlink,
    stop: stop,
  };
};

