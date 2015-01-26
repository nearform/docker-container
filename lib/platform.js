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
var xtend = require('xtend');

var basicCommand = {
  import: 'docker pull __TAG__',
  kill: 'docker kill __TARGETID__',
  run: 'docker run __ARGUMENTS__',
  execute: 'docker run ',

  generateTag: function(config, system, containerDef) {
    var result = [
      config.registry,
      system.namespace,
      containerDef.id.replace(' ', '_').replace('$', '-').replace('/', '.')
    ].join('/');

    return result;
  },

  generateBuildScript: function(config, system, containerDef) {
    var tag = this.generateTag(config, system, containerDef);
    var cmd;

    if (containerDef.specific.commit) {
      cmd = [
        // checkout the specific commit, silently
        'git checkout -q ' + containerDef.specific.commit,
        // give some output to the user
        'echo checked out ' + containerDef.specific.commit,
        // building!
        'docker build -t ' + tag + ' .',
        // cache the build result
        'RESULT=$?',
        // reset any changes we did to the repo
        'git reset -q HEAD .',
        //  exit
        '(exit $RESULT)'
      ].join(' && ');
    } 
    else {
      cmd = 'docker pull ' + containerDef.specific.name +
        ' && docker tag -f ' + containerDef.specific.name + ' ' + tag;
    }

    return cmd;
  },

  generatePushScript: function(config, system, containerDef) {
    return 'docker push ' + this.generateTag(config, system, containerDef);
  }
};


var cmds = {
  darwin: xtend(basicCommand, {
    defaultUser: '',
    deleteUntaggedContainers: 'docker ps -a --no-trunc | grep Exit | awk \'{print $1}\' | xargs -I {} docker rm {}',
    deleteUntaggedImages: 'docker images --no-trunc| grep none | awk \'{print $3}\' | xargs -I {} docker rmi {}',
  }),
  linux: xtend(basicCommand, {
    defaultUser: 'ubuntu',
    deleteUntaggedContainers: 'docker ps -a -notrunc | grep \'Exit\' | awk \'{print $1}\' | xargs -r docker rm',
    deleteUntaggedImages: 'docker images -notrunc| grep none | awk \'{print $3}\' | xargs -r docker rmi',
  })
};



exports.commands = function(platform) {
  if (platform) {
    return cmds[platform];
  }
  else {
    return cmds[os.platform()];
  }
};



exports.executor = function(config, ipaddress, platform, logger) {
  if (!ipaddress) {
    return require('./localExecutor')(config, exports.commands(platform), logger);
  }
  else {
    if (ipaddress === '127.0.0.1' || ipaddress === 'localhost') {
      return require('./localExecutor')(config, exports.commands(platform), logger);
    }
    else {
      return require('./remoteExecutor')(config, exports.commands('linux'), logger);
    }
  }
};

