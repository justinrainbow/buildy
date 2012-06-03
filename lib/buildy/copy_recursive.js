var fs = require('fs');
var path = require('path');
var events = require('events');
var util = require('util');
var filelist = require('./filelist');
var copy = require('./copy');

/**
 * Copy a list of items recursively to a specified destination.
 *
 * @class CopyRecursive
 * @namespace buildy
 * @param sources {Array} Array of filenames, directories, and/or glob patterns.
 * @param destination {String} Destination directory
 * @param callback {Function} Callback function (err, results)
 * @param options {Object} Copy options
 * @constructor
 */
function CopyRecursive(sources, destination, callback, options) {

    /**
     * Items that can be parsed to generate filenames (globs, filenames, directories).
     *
     * @type {Array}
     * @private
     */
    this._sources = sources;

    /**
     * Destination item (directory, or single file).
     *
     * @type {String}
     * @private
     */
    this._destination = destination;

    /**
     * Callback function
     *
     * @type {Function}
     * @private
     */
    this._callback = callback;

    /**
     * Copy options, such as file exclusions.
     *
     * @type {Object}
     * @private
     * @todo option to overwrite
     */
    this._options = options || { exclude : [] };

    this.initialize();
}

util.inherits(CopyRecursive, events.EventEmitter);

/**
 * Start the recursive copy process.
 */
CopyRecursive.prototype.initialize = function () {
    var self = this;

    // TODO: Relative path interprets the lack of a trailing slash as prepending the parent directory name.

    // Given two paths find the relative path of the longer one (the sub directory/file)
    function _getRelativePath(relativeTo, fullPath) {

        if (relativeTo === fullPath) { return path.basename(fullPath); }

        var relativeLastChar = relativeTo.substr((relativeTo.length - 1), 1);

        // Trailing slash rule - parent directory not appended
        if (relativeLastChar === '/' || relativeLastChar === '\\') {
            return fullPath.substr(relativeTo.length);
        } else {
            var relativePathBaseDir = path.basename(relativeTo);
            return path.join(relativePathBaseDir, fullPath.substr(relativeTo.length));
        }
    }

    function _getDestinationPath(dest, relativePath) {
        if (path.existsSync(dest)) {
            var stats = fs.statSync(dest);

            if (stats.isDirectory()) {
                return path.join(dest, relativePath);
            } else {
                return dest; // File exists with this name, overwrite single file
            }
        } else {
            if (path.basename(relativePath) === relativePath) {
                return dest;
            } else {
                return path.join(dest, relativePath);
            }
            // If relativePath is a non-existent directory, join it to dest
            // If dest is a non-existent file, only use
        }
    }

    this._sources.forEach(function _eachSource(source) {
       filelist(source, function _cbFileListing(err, files) {
          if (err) {
              this._callback(err);
              return;
          }

          files.forEach(function _eachSourceFile(file) {
              var filePathRelative = _getRelativePath(source, file);
              var destinationPath = _getDestinationPath(this._destination, filePathRelative);

              this.emit('copy', file, destinationPath);
              copy(file, destinationPath, function _cbCopyDone() {
                  self._handleCopyDone.apply(self, arguments);
              });
          }, this);
       }, {
           exclude : this._options.exclude,
           context : this
       });
    }, this);
};

/**
 * Called when each individual item has finished copying.
 *
 * @param err {String} error object
 * @param src {String} copy source
 * @param dst {String} copy destination
 * @private
 */
CopyRecursive.prototype._handleCopyDone = function (err, src, dst) {
    this.emit('success', src, dst);
    this._callback(err, src, dst);
};


/**
 * Copy a list of items recursively to a specified destination.
 *
 * @method copy_recursive
 * @param sources {Array} Array of filenames, directories, and/or glob patterns.
 * @param destination {String} Destination directory
 * @param callback {Function} Callback function (err, results)
 * @param options {Object} Copy options
 * @return {CopyRecursive} object which emits events at various stages through the copy process.
 * @public
 * @static
 */
var copy_recursive = module.exports = function copy_recursive(sources, destination, callback, options) {
    return new CopyRecursive(sources, destination, callback, options);
};