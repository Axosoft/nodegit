var cp = require("child_process");
var _ = require("lodash");
var util = require("util");
var worker;

try {
  worker = require("worker_threads");
} catch (e) {}

var rawApi;

// Declare a preferred load order for built nodegit.node targets
// The OS informs this choice.
// On Windows and MacOS, default to whatever was built.
// On Linux, we have selected the order based on the most likely OpenSSL distribution you have installed.
// Fedora 28 =>   OpenSSL 1.1.0
// Centos 7 =>    OpenSSL 1.0.2
// Ubuntu 18 =>   OpenSSL 1.1.0
// Ubuntu 16 =>   OpenSSL 1.0.1
// Other =>       OpenSSL 1.0.0
var nativeModuleLoadOrder;
if (process.platform !== "linux") {
  nativeModuleLoadOrder = [
    "nodegit.node"
  ];
} else {
  var stdout = cp.execSync("cat /etc/os-release").toString();
  if (/^ID=fedora$/m.test(stdout)) {
    nativeModuleLoadOrder = [
      "nodegit-fedora-28.node",
      "nodegit-centos-7.node",
      "nodegit-ubuntu-18.node",
      "nodegit.node",
      "nodegit-debian-8.node"
    ];
  } else if (/^ID=centos$/m.test(stdout)) {
    nativeModuleLoadOrder = [
      "nodegit-fedora-28.node",
      "nodegit-centos-7.node",
      "nodegit-ubuntu-18.node",
      "nodegit.node",
      "nodegit-debian-8.node"
    ];
  } else if (/^ID=ubuntu$/m.test(stdout)) {
    nativeModuleLoadOrder = [
      "nodegit-ubuntu-18.node",
      "nodegit.node",
      "nodegit-debian-8.node"
    ]
  } else {
    nativeModuleLoadOrder = [
      "nodegit-fedora-28.node",
      "nodegit-centos-7.node",
      "nodegit-ubuntu-18.node",
      "nodegit.node",
      "nodegit-debian-8.node"
    ];
  }
}

// Attempt to load the production release first, using the load order determined
for (var nativeModuleName of nativeModuleLoadOrder) {
  try {
    rawApi = require(`../build/Release/${nativeModuleName}`);
    break;
  }
  catch (ex) {
    // do nothing
  }
}

if (!rawApi) {
  rawApi = require("build/Debug/nodegit.node");
}

var promisify = fn => fn && util.promisify(fn); // jshint ignore:line

// For disccussion on why `cloneDeep` is required, see:
// https://github.com/facebook/jest/issues/3552
// https://github.com/facebook/jest/issues/3550
// https://github.com/nodejs/node/issues/5016
rawApi = _.cloneDeep(rawApi);

// Native methods do not return an identifiable function, so we
// have to override them here
/* jshint ignore:start */
{% each . as idef %}
  {% if idef.type == 'struct' %}
    rawApi.{{ idef.jsClassName }} = util.deprecate(function {{ idef.jsClassName }}() {
      try {
        require("./deprecated/structs/{{ idef.jsClassName }}").call(this, rawApi);
      } catch (error) {/* allow these to be undefined */}
    }, "Instantiation of {{ idef.jsClassName }} is deprecated and will be removed in an upcoming version");
  {% endif %}
  {% if idef.type != "enum" %}

    {% if idef.functions.length > 0 %}
      var _{{ idef.jsClassName }}
        = rawApi.{{ idef.jsClassName }};
    {% endif %}

    {% each idef.functions as fn %}
      {% if fn.isAsync %}

        {% if fn.isPrototypeMethod %}

          var _{{ idef.jsClassName }}_{{ fn.jsFunctionName}}
            = _{{ idef.jsClassName }}.prototype.{{ fn.jsFunctionName }};
          _{{ idef.jsClassName }}.prototype.{{ fn.jsFunctionName }}
            = promisify(_{{ idef.jsClassName }}_{{ fn.jsFunctionName}});

        {% else %}

          var _{{ idef.jsClassName }}_{{ fn.jsFunctionName}}
            = _{{ idef.jsClassName }}.{{ fn.jsFunctionName }};
          _{{ idef.jsClassName }}.{{ fn.jsFunctionName }}
            = promisify(_{{ idef.jsClassName }}_{{ fn.jsFunctionName}});

        {% endif %}

      {% endif %}
    {% endeach %}

  {% endif %}
{% endeach %}

var _ConvenientPatch = rawApi.ConvenientPatch;
var _ConvenientPatch_hunks = _ConvenientPatch.prototype.hunks;
_ConvenientPatch.prototype.hunks = promisify(_ConvenientPatch_hunks);

var _ConvenientHunk = rawApi.ConvenientHunk;
var _ConvenientHunk_lines = _ConvenientHunk.prototype.lines;
_ConvenientHunk.prototype.lines = promisify(_ConvenientHunk_lines);

var _FilterRegistry = rawApi.FilterRegistry;
var _FilterRegistry_register = _FilterRegistry.register;
_FilterRegistry.register = promisify(_FilterRegistry_register);

var _FilterRegistry_unregister = _FilterRegistry.unregister;
_FilterRegistry.unregister = promisify(_FilterRegistry_unregister);

/* jshint ignore:end */

// Set the exports prototype to the raw API.
exports.__proto__ = rawApi;

var importExtension = function(name) {
  try {
    require("./" + name);
  }
  catch (unhandledException) {
    if (unhandledException.code != "MODULE_NOT_FOUND") {
      throw unhandledException;
    }
  }
};

// Load up utils
rawApi.Utils = {};
require("./utils/lookup_wrapper");
require("./utils/shallow_clone");

// Load up extra types;
require("./status_file");
require("./enums.js");

// Import extensions
// [Manual] extensions
importExtension("filter_registry");
{% each %}
  {% if type != "enum" %}
    importExtension("{{ filename }}");
  {% endif %}
{% endeach %}
/* jshint ignore:start */
{% each . as idef %}
  {% if idef.type != "enum" %}
    {% each idef.functions as fn %}
      {% if fn.useAsOnRootProto %}

        // Inherit directly from the original {{idef.jsClassName}} object.
        _{{ idef.jsClassName }}.{{ fn.jsFunctionName }}.__proto__ =
          _{{ idef.jsClassName }};

        // Ensure we're using the correct prototype.
        _{{ idef.jsClassName }}.{{ fn.jsFunctionName }}.prototype =
          _{{ idef.jsClassName }}.prototype;

        // Assign the function as the root
        rawApi.{{ idef.jsClassName }} =
          _{{ idef.jsClassName }}.{{ fn.jsFunctionName }};

      {% endif %}
    {% endeach %}
  {% endif %}
{% endeach %}
/* jshint ignore:end */

// Set version.
exports.version = require("../package").version;

// Expose Promise implementation.
exports.Promise = Promise;
