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

var DEFAULT_USER = 'ubuntu';
//var IMPORT = 'sudo cat __BINARY__ | sudo docker import - __TARGETNAME__';
var IMPORT = 'sudo docker load < __BINARY__';
//var KILL = 'sudo docker kill $(sudo docker ps | grep __TARGETNAME__ | awk \'{print $1}\')';
var KILL = 'sudo docker kill __TARGETID__';
var RUN = 'sudo docker run __ARGUMENTS__';
var DELETE_UNTAGGED_CONGTAINERS = 'sudo docker ps -a -notrunc | grep \'Exit\' | awk \'{print $1}\' | xargs -r sudo docker rm';
var DELETE_UNTAGGED_IMAGES = 'sudo docker images -notrunc| grep none | awk \'{print $3}\' | xargs -r sudo docker rmi';


/**
 * deploy commands for demo - docker only
 */
module.exports = function(config) {
  var ssh = require('nscale-util').sshexec();
  var scp = require('nscale-util').sshcp();

  var nameFromBin = function(container) {
    var name = null;

    if (container.specific && container.specific.containerBinary) {
      var bin = container.specific.containerBinary.split('/');
      name = bin[bin.length - 1];
    }
    return name;
  };



  var deploy = function(mode, targetHost, system, containerDef, container, out, cb) {
    ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, 'mkdir -p /home/ubuntu/containers', function(err, op) {
      out.preview(op);
      if (err) { return cb(err); }
      var name = nameFromBin(container);

      ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, '[ ! -f /home/ubuntu/containers/' + name + ' ] && echo "notfound"', function(err, op, response) {
        out.preview(op);
        if (err) { return cb(err); }
        if (response && 'notfound' === response.trim()) {
          scp.copy(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, container.specific.containerBinary, '/home/ubuntu/containers/' + name, out, function(err, op) {
            out.preview(op);
            if (err) { return cb(err); }
            var importCommand = IMPORT.replace('__BINARY__', '/home/ubuntu/containers/' + name);
            importCommand = importCommand.replace('__TARGETNAME__', name);
            ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, importCommand, function(err, op) {
              out.preview(op);
              cb(err);
              //setTimeout(function() { cb(err); }, 10000);
            });
          });
        }
        else {
          ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, 'sudo docker images', function(err, op, images) {
            out.preview(op);
            if (err) { return cb(err); }
            var re = new RegExp(name, ['g']);
            if (!re.test(images)) {
              var importCommand = IMPORT.replace('__BINARY__', '/home/ubuntu/containers/' + name);
              importCommand = importCommand.replace('__TARGETNAME__', name);
              ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, importCommand, function(err, op) {
                out.preview(op);
                cb(err);
                //setTimeout(function() { cb(err); }, 10000);
              });
            }
            else {
              cb(err);
            }
          });
        }
      });
    });
  };



  var start = function(mode, targetHost, system, containerDef, container, out, cb) {
    var name = nameFromBin(container);
    name = system.namespace + '/' + name;
    var startCmd = RUN.replace('__ARGUMENTS__', containerDef.specific.arguments);
    startCmd = startCmd.replace(/__TARGETNAME__/g, name);
    ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, startCmd, function(err, op) {
      out.preview(op);
      cb(err);
    });
  };



  var link = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb();
  };



  var unlink = function(mode, targetHost, system, containerDef, container, out, cb) {
    cb();
  };



  var stop = function(mode, targetHost, system, containerDef, container, out, cb) {
    if (container.specific && container.specific.dockerContainerId) {
      var stopCmd = KILL.replace('__TARGETID__', container.specific.dockerContainerId);
      ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, stopCmd, function(err, op) {
        out.preview(op);
        cb(err);
      });
    }
    else {
      cb();
    }
  };


  /*
  var stop = function(mode, targetHost, system, containerDef, container, out, cb) {
    var name = nameFromBin(container);
    if (name) {
      var stopCmd = KILL.replace('__TARGETNAME__', name);
      ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, stopCmd, function(err, op) {
        out.preview(op);
        cb(err);
      });
    }
    else {
      cb();
    }
  };
  */


  var undeploy = function(mode, targetHost, system, containerDef, container, out, cb) {
    //var name = nameFromBin(container);
    ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, DELETE_UNTAGGED_CONGTAINERS, function(err, op) {
      out.preview(op);
      ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, DELETE_UNTAGGED_IMAGES, function(err, op) {
        out.preview(op);
        // for demo leave containers note that replace this wil history of last 5 deployed containers
        // for fast rollback / forward
        cb();
        /*
        if (name) {
          var removeCmd = REMOVE.replace('__TARGETNAME__', name);
          ssh.exec(mode, targetHost.privateIpAddress, DEFAULT_USER, config.sshKeyPath, removeCmd, function(err) {
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



  return {
    deploy: deploy,
    undeploy: undeploy,
    start: start,
    link: link,
    unlink: unlink,
    stop: stop,
  };
};

