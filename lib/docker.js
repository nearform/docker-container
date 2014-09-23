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



/**
 * instantiates dockerode in one of two forms
 *
 * new Docker({socketPath: '/var/run/docker.sock'}); - for linux hosts
 * new Docker({host: 'http://192.168.1.10', port: 3000}); - for mac hosts
 */
var instantiateDocker = function() {
  var split;
  var url;
  var port;
  var docker;

  if (process.env.DOCKER_HOST) {
    split = /tcp:\/\/([0-9.]+):([0-9]+)/g.exec(process.env.DOCKER_HOST);
    url = 'http://' + split[1];
    port = split[2];
    docker = new Docker({host: url, port: port});
  }
  else {
    docker = new Docker({socketPath: '/var/run/docker.sock'});
  }
  return docker;
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

