#!groovy

def windowsConfigurations = ["gk-win2016-x64"]
def windowsBuildArches = ["x64", "x86"]
def macosConfigurations = ["gk-macos-x64", "gk-macos-arm64"]

def builders = [:]

for (wc in windowsConfigurations) {
  def configuration = wc; // for closure scope
  for (_arch in windowsBuildArches) {
    def arch = _arch; // for closure scope
    def fullConfiguration = "$configuration - $arch"
    builders[fullConfiguration] = {
      node(configuration) {
        try {
          stage("[${fullConfiguration}] Checking out") {
            try {
              bat 'git clean -qxdff' // needs to run before deleteDir
            } catch (err) {/* if this isn't a repo yet, we shouldn't fail */}
            deleteDir()
            checkout scm
          }

          stage("[${fullConfiguration}] NPM install") {
            timeout(10) {
              withEnv(['NODEGIT_SKIP_INSTALL=1']) {
                bat 'npm install'
              }
              dir('GitKraken') {
                bat 'npm install'
              }
            }
          }

          stage("[${fullConfiguration}] Build OpenSSL") {
            timeout(15) {
              withEnv(['NODEGIT_OPENSSL_BUILD_PACKAGE=1', "NODEGIT_VS_BUILD_ARCH=$arch"]) {
                bat 'node utils/acquireOpenSSL.js'
              }
            }
          }

          stage("[${fullConfiguration}] Deploy") {
            timeout(5) {
              sshagent(['Jenkins_SSH']) {
                withCredentials([[
                  $class: "AmazonWebServicesCredentialsBinding",
                  credentialsId: "gknodegit",
                  accessKeyVariable: "AWS_ACCESS_KEY_ID",
                  secretKeyVariable: "AWS_SECRET_ACCESS_KEY"
                ]]) {
                  dir('GitKraken') {
                    withEnv(["NODEGIT_VS_BUILD_ARCH=$arch"]) {
                      bat 'npm run pushOpenSSL'
                    }
                  }
                }
              }
            }
          }
        }
        catch (err) {
          throw err
        }
      }
    }
  }
}

for (macosConfig in macosConfigurations) {
  def configuration = macosConfig; // for closure scope
  builders[configuration] = {
    node(configuration) {
      try {
        stage("[${configuration}] Checking out") {
          try {
            sh 'git clean -qxdff' // needs to run before deleteDir
          } catch (err) {/* if this isn't a repo yet, we shouldn't fail */}
          deleteDir()
          checkout scm
        }

        stage("[${configuration}] NPM install") {
          timeout(10) {
            withEnv(['NODEGIT_SKIP_INSTALL=1']) {
              if (configuration == "gk-macos-arm64") {
                sh 'arch -arm64 npm install'
              } else {
                sh 'npm install'
              }
            }
            dir('GitKraken') {
              if (configuration == "gk-macos-arm64") {
                sh 'arch -arm64 npm install'
              } else {
                sh 'npm install'
              }
            }
          }
        }

        stage("[${configuration}] Build OpenSSL") {
          timeout(15) {
            withEnv(['NODEGIT_OPENSSL_BUILD_PACKAGE=1']) {
              if (configuration == "gk-macos-arm64") {
                sh 'arch -arm64 node utils/acquireOpenSSL.js 10.11'
              } else {
                sh 'node utils/acquireOpenSSL.js 10.11'
              }
            }
          }
        }

        stage("[${configuration}] Deploy") {
          timeout(5) {
            sshagent(['Jenkins_SSH']) {
              withCredentials([[
                $class: "AmazonWebServicesCredentialsBinding",
                credentialsId: "gknodegit",
                accessKeyVariable: "AWS_ACCESS_KEY_ID",
                secretKeyVariable: "AWS_SECRET_ACCESS_KEY"
              ]]) {
                dir('GitKraken') {
                  if (configuration == "gk-macos-arm64") {
                    sh 'arch -arm64 npm run pushOpenSSL'
                  } else {
                    sh 'npm run pushOpenSSL'
                  }
                }
              }
            }
          }
        }
      }
      catch (err) {
        throw err
      }
    }
  }
}

try {
  parallel builders
} catch (err) {
  throw err
}
