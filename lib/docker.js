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

var Docker = require('dockerode');
var _ = require('underscore');
var fs = require('fs');
var path = require('path');



/**
 * instantiates dockerode in one of two forms
 *
 * new Docker({socketPath: '/var/run/docker.sock'}); - for linux hosts
 * new Docker({host: 'http://192.168.1.10', port: 3000}); - for mac hosts
 */
var instantiateDocker = function() {
  var split;
  var opts = {};

  if (process.env.DOCKER_HOST) {
    split = /tcp:\/\/([0-9.]+):([0-9]+)/g.exec(process.env.DOCKER_HOST);

    if (process.env.DOCKER_TLS_VERIFY === '1') {
      opts.protocol = 'https';
    }
    else {
      opts.protocol = 'http';
    }

    opts.host = split[1];

    if (process.env.DOCKER_CERT_PATH) {
      opts.ca = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'ca.pem'));
      opts.cert = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'cert.pem'));
      opts.key = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'key.pem'));
    }

    opts.port = split[2];
  }
  else {
    opts.socketPath = '/var/run/docker.sock';
  }

  return new Docker(opts);
};



exports.findImage = function(searchStr, cb) {
  var docker = instantiateDocker();
  docker.listImages(function(err, images) {
    if (err) { return cb(err); }
    var f = _.find(images, function(image) {
      return _.find(image.RepoTags, function(tag) {
        return tag.indexOf(searchStr) !== -1;
      });
    });
    cb(err, f);
  });
};

