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
var portscanner = require('portscanner');
var sshCheck = require('nscale-util').sshcheck();
var forwarder = require('remote-forwarder');
var path = require('path');
var POLL_INTERVAL = 5000;
var MAX_POLLS = 30;


module.exports = function(config, commands, logger) {
  var ssh = require('nscale-util').sshexec();
  var pollCount = 0;

  function createTunnel(mode, user, identity, host, cb) {
    var forwarderOpts = {
      target: host,
      identityFile: identity,
      user: user,
      port: config.registryPort,
      retries: 20
    };

    var forward = forwarder(forwarderOpts);

    logger.debug(forwarderOpts, 'setting up SSH tunnel');

    forward.once('connect', function() {
      logger.info(forwarderOpts, 'SSH tunnel setted up');
      cb(null, forward);
    });

    forward.on('reconnect failed', function() {
      logger.warn(forwarderOpts, 'unable to set up the SSH tunnel');
      cb(new Error('unable to set up tunnel'));
    });

    if (mode === 'preview') {
      // we are running in preview mode
      // don't set up the tunnel, be fast
      cb(null, forward);
    } else {
      forward.start();
    }
  }



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



  var getUser = function(target) {
    return target.user || config.user || commands.defaultUser;
  };



  var getSshKeyPath = function(system, target) {
    var identityFile = target.identityFile || config.identityFile;
    return path.resolve(system.repoPath, identityFile);
  };



  var deploy = function(mode, targetHost, system, containerDef, container, out, cb) {
    var user = getUser(targetHost);
    var sshKeyPath = getSshKeyPath(system, targetHost);
    var tag = commands.generateTag(config, system, containerDef);

    if (!sshKeyPath) {
      return cb(new Error('missing identity file'));
    }

    pollForConnectivity(mode, user, sshKeyPath, targetHost.privateIpAddress, out, function(err) {
      if (err) { return cb(err); }
      createTunnel(mode, user, sshKeyPath, targetHost.privateIpAddress, function(err, forward) {
        if (err) { return cb(err); }

        logger.info(targetHost, 'target online');

        var importCommand = commands.import.replace('__TAG__', tag);
        logger.info({ tag: tag }, 'pulling container');
        ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, importCommand, function(err, op) {
          if (err) {
            return cb(err);
          }

          logger.info({ tag: tag }, 'container pulled');
          out.preview(op);
          forward.stop();
          cb();
        });
      });
    });
  };



  var start = function(mode, targetHost, system, containerDef, container, out, cb) {
    var user = getUser(targetHost);
    var sshKeyPath = getSshKeyPath(system, targetHost);
    var executeOpts = container.specific.execute  ? container.specific.execute : containerDef.specific.execute || {};
    var args = executeOpts.args || ' -d';
    var exec = executeOpts.exec || '';
    var tag = commands.generateTag(config, system, containerDef);

    if (args.indexOf('-d') === -1) {
      args += ' -d';
    }

    var startCmd = [
      commands.execute,
      args,
      tag,
      exec,
      '&& docker tag',
      tag,
      tag + ':' + Date.now()
    ].join(' ');

    startCmd = startCmd.replace(/__TARGETIP__/g, targetHost.privateIpAddress);

    pollForConnectivity(mode, user, sshKeyPath, targetHost.privateIpAddress, out, function(err) {
      if (err) { return cb(err); }
      ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, startCmd, function(err, op) {
        out.preview(op);
        cb(err);
      });
    });
  };



  var purgeImages = function(config, mode, targetHost, ssh, user, sshKeyPath, containerDef, out, cb) {
    var toPurge = commands.generatePurgeCommands(containerDef);
    if (toPurge) {
      async.eachSeries(toPurge, function(purge, next) {
        ssh.exec(mode, targetHost.privateIpAddress, user, sshKeyPath, commands.rmi + purge, function(err, op) {
          out.preview(op);
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
    var user = getUser(targetHost);
    var sshKeyPath = getSshKeyPath(system, targetHost);

    pollForConnectivity(mode, user, sshKeyPath, targetHost.privateIpAddress, out, function(err) {
      if (err) { return cb(err); }
      purgeImages(config, mode, targetHost, ssh, user, sshKeyPath, containerDef, out, function(err) {
        logger.info(targetHost, 'purge finished');
        cb(err);
      });
    });
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

