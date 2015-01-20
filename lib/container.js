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

var os = require('os');
var platform = require('./platform');
var bunyan = require('bunyan');
var buildRegistry = require('./registry.js');
var request = require('request');
var commands = require('./platform').commands;

module.exports = function(config, logger) {

  var builder = require('./dockerBuilder')(config, os.platform());
  var registryPort = config.registryPort || 8011;

  config.registryPort = registryPort;
  config.registryHost = 'localhost';
  config.registry = config.registryHost + ':' + registryPort;

  logger = logger || bunyan.createLogger({name: 'docker-container'});



  /**
   * build the container
   * system - the system definition
   * cdef - contianer definition block
   * out - ouput stream
   * cb - complete callback
   */
  var build = function build(mode, system, cdef, out, cb) {
    logger.info('building');
    out.stdout('--> building');

    builder.build(mode, system, cdef, out, function(err, specific) {
      if (err) { logger.error(err); return cb(err); }
      cb(err);
    });
  };

  /**
   * Check if the container needs a build
   *
   * system - the system definition
   * cdef - contianer definition block
   * out - ouput stream
   * cb - complete callback
   */
  var needsBuild = function needBuild(mode, system, cdef, out, cb) {
    // TODO handle authentication and HTTPS registries
    // also handle other registries than docker-registry-container

    var cmds = commands(os.platform());
    var tag = cmds.generateTag(config, system, cdef);
    var baseUrl = 'http://' + config.registry + '/v1/repositories';
    var url = tag.replace(config.registry,
                          baseUrl) + '/tags';

    request({ url: url, json: true }, function(err, res, body) {
      if (err) { return cb(err); }

      // return the missing definition, or null
      cb(null, Object.keys(body).length === 0 ? cdef : null);
    });
  };


  /**
   * prepare the environment to execute the operation and return the executor
   *
   * target - target to deploy to
   * out - output stream
   * operation - the string to log to announce the beginning to the operation
   */
   var prepareAndGetExecutor = function prepareAndGetExecutor(target, out, operation) {
    target.privateIpAddress = target.privateIpAddress || target.ipAddress || target.ipaddress;
    var executor = platform.executor(config, target.privateIpAddress, os.platform(), logger);
    logger.info(operation);
    out.stdout(operation);
    return executor;
   };



  /**
   * deploy the container
   * target - target to deploy to
   * system - the target system defintinion
   * cdef - the contianer definition
   * container - the container as defined in the system topology
   * out - ouput stream
   * cb - complete callback
   */
  var deploy = function deploy(mode, target, system, containerDef, container, out, cb) {
    var executor = prepareAndGetExecutor(target, out, 'deploying');
    executor.deploy(mode, target, system, containerDef, container, out, function(err) {
      cb(err);
    });
  };



  /**
   * undeploy the container from the target
   * target - target to deploy to
   * system - the target system defintinion
   * cdef - the contianer definition
   * container - the container as defined in the system topology
   * out - ouput stream
   * cb - complete callback
   */
  var undeploy = function undeploy(mode, target, system, containerDef, container, out, cb) {
    var executor = prepareAndGetExecutor(target, out, 'undeploying');
    executor.undeploy(mode, target, system, containerDef, container, out, function(err) {
      cb(err);
    });
  };



  /**
   * start the container on the target
   * target - target to deploy to
   * system - the target system defintinion
   * cdef - the contianer definition
   * container - the container as defined in the system topology
   * out - ouput stream
   * cb - complete callback
   */
  var start = function start(mode, target, system, containerDef, container, out, cb) {
    var executor = prepareAndGetExecutor(target, out, 'starting');
    executor.start(mode, target, system, containerDef, container, out, function(err) {
      cb(err);
    });
  };



  /**
   * stop the container on the target
   * target - target to deploy to
   * system - the target system defintinion
   * cdef - the contianer definition
   * container - the container as defined in the system topology
   * out - ouput stream
   * cb - complete callback
   */
  var stop = function stop(mode, target, system, containerDef, container, out, cb) {
    var executor = prepareAndGetExecutor(target, out, 'stopping');
    executor.stop(mode, target, system, containerDef, container, out, function(err) {
      cb(err);
    });
  };



  /**
   * link the container to the target
   * target - target to deploy to
   * system - the target system defintinion
   * cdef - the contianer definition
   * container - the container as defined in the system topology
   * out - ouput stream
   * cb - complete callback
   */
  var link = function link(mode, target, system, containerDef, container, out, cb) {
    var executor = prepareAndGetExecutor(target, out, 'linking');
    executor.link(mode, target, system, containerDef, container, out, function(err) {
      cb(err);
    });
  };



  /**
   * unlink the container from the target
   * target - target to deploy to
   * system - the target system defintinion
   * cdef - the contianer definition
   * container - the container as defined in the system topology
   * out - ouput stream
   * cb - complete callback
   */
  var unlink = function unlink(mode, target, system, containerDef, container, out, cb) {
    var executor = prepareAndGetExecutor(target, out, 'unlinking');
    executor.unlink(mode, target, system, containerDef, container, out, function(err) {
      cb(err);
    });
  };



  return {
    build: build,
    deploy: deploy,
    start: start,
    stop: stop,
    link: link,
    unlink: unlink,
    undeploy: undeploy,
    add: deploy,
    remove: undeploy,
    service: buildRegistry(config, logger),
    needsBuild: needsBuild
  };
};


if (require.main === module) {
  module.exports({}).service('.');
}
