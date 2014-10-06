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
  import: 'docker load < __BINARY__',
  kill: 'docker kill __TARGETID__',
  run: 'docker run __ARGUMENTS__',
  build: 'docker build -t __NAMESPACE__/__TARGETNAME__-__BUILDNUMBER__ .',
  export: 'docker save __NAMESPACE__/__TARGETNAME__-__BUILDNUMBER__ > __BUILDPATH__/__TARGETNAME__-__BUILDNUMBER__'
}



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

