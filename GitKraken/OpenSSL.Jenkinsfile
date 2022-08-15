#!groovy

def windowsConfigurations = ["gk-win2016-x64-openssl"]
// def windowsConfigurations = ["gk-win2016-x86", "gk-win2016-x64"]
// def macosConfigurations = ["gk-macos-x64", "gk-macos-arm64"]

def builders = [:]

for (wc in windowsConfigurations) {
  def configuration = wc; // for closure scope
  builders[configuration] = {
    node(configuration) {
      try {
        stage("[${configuration}] Checking out") {
          try {
            bat 'git clean -qxdff' // needs to run before deleteDir
          } catch (err) {/* if this isn't a repo yet, we shouldn't fail */}
          deleteDir()
          checkout scm
        }

        stage("[${configuration}] NPM install") {
          timeout(10) {
            withEnv(['NODEGIT_SKIP_INSTALL=1']) {
              bat 'npm install'
            }
            dir('GitKraken') {
              bat 'npm install'
            }
          }
        }

        stage("[${configuration}] Build OpenSSL") {
          timeout(15) {
            withEnv(['NODEGIT_OPENSSL_BUILD_PACKAGE=1']) {
              bat 'node utils/acquireOpenSSL.js'
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
                  bat 'npm run pushOpenSSL'
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
