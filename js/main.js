(function() {

  function JsonInputView(el) {
    this.el = el;
    var codemirror = this.codemirror = CodeMirror.fromTextArea(this.el, {
      lineNumbers: true,
      mode: {name: "javascript", json: true}
    });
    var self = this;

    codemirror.on('inputRead', function (cm, e) {
      if (e.origin === 'paste') {
        autoFormat();
      }
      triggerChange();
    });
    codemirror.on('keyup', triggerChange);
    codemirror.on('change', triggerChange);
    codemirror.on('clear', function () {
      console.log(arguments);
    });

    var oldValue = '';
    function triggerChange() {
      var text = codemirror.getValue();
        if (text !== oldValue) {
          self.trigger('change');
        }
      oldValue = text;
    }

    function autoFormat() {
      var totalLines = codemirror.lineCount();
      codemirror.autoFormatRange({line:0, ch:0}, {line:totalLines});
      codemirror.setSelection({line:0, ch:0});
    }
  }

  JsonInputView.prototype.getText = function () {
    return this.codemirror.getValue();
  };

  JsonInputView.prototype.highlightRemoval = function (diff) {
    this._highlight(diff, 'red');
  };

  JsonInputView.prototype.highlightAddition = function (diff) {
    this._highlight(diff, 'blue');
  };

  JsonInputView.prototype.highlightChange = function (diff) {
    this._highlight(diff, 'yellow');
  };

  JsonInputView.prototype._highlight = function (diff, className) {
    debugger
    var pos = getStartAndEndPosOfDiff(this.getText(), diff);
    this.codemirror.markText(pos.start, pos.end, {
      css: 'background-color: ' + className
    });
  }

  JsonInputView.prototype.clearMarkers = function () {
    this.codemirror.getAllMarks().forEach(function (marker) {
      marker.clear();
    });
  }

  function getStartAndEndPosOfDiff(textValue, diff) {
    var findPath = diff.path;
    var contexts = {
      ARRAY: 'ARRAY',
      OBJECT: 'OBJECT'
    };
    var QUOTE = '"';
    var OBJ_OPEN = '{';
    var OBJ_CLOSE = '}';
    var ARR_OPEN = '[';
    var ARR_CLOSE = ']';
    var SEPARATOR = ',';
    var ESCAPE = '\\';
    var NL = '\n';
    var OBJ_PROPERTY_RGX = /^"([^"]|\\")*"(?=\s*:)/g;
    var startPos, endPos, currChar, prevChar, currPath = [], contextStack = [], line = 0, ch = 0, inString = false;
    for (var i = 0; i < textValue.length; i++) {
      ch++;
      currChar = textValue[i];
      if (currChar === NL) {
        line++;
        ch = 0;
      } else if (currChar === OBJ_OPEN) {
        currPath.push(null);
        contextStack.push(contexts.OBJECT);
      } else if (currChar === ARR_OPEN) {
        currPath.push(0);
        contextStack.push(contexts.ARRAY);
      } else if (currChar === QUOTE && !inString && prevChar !== ESCAPE) {
        inString = true;
        var prop = getNextObjProperty(i);
        if (prop) {
          currPath.push(prop);
        }
      } else if (currChar === SEPARATOR) {
        if (context() === contexts.ARRAY) {
          var currArrayIdx = currPath[currPath.length - 1];
          currArrayIdx  = typeof(currArrayIdx ) === 'number' ? currArrayIdx  + 1 : 0;
          currPath.pop();
          currPath.push(currArrayIdx);
        } else {
          currPath.pop();
        }
      } else if (currChar === QUOTE && inString) {
        inString = false;
      } else if (currChar === ARR_CLOSE || currChar === OBJ_CLOSE) {
        contextStack.pop();
        currPath.pop();
        if (!followedByComma(i)) {
          currPath.pop();
        }
      }

      var currPathStr = '/' + currPath.filter(function (item) {
        return item !== null;
      }).join('/');
      if (currPathStr === findPath && !startPos) {
        startPos = {
          line: line,
          ch: ch
        };
      } else if (currPathStr.indexOf(findPath) === 0) {
        endPos = {
          line: line,
          ch: ch
        };
      }

      prevChar = currChar;
    }

    function getNextObjProperty(idx) {
      var matches = textValue.substr(idx).match(OBJ_PROPERTY_RGX) || [];
      var next = matches[0];
      if (next) {
        next = next.substr(1, next.length - 2);
      }
      return next;
    }

    function followedByComma(idx) {
      var matches = textValue.substr(idx + 1).match(/^\s*,/g) || [];
      return matches.length > 0;
    }

    function context() {
      return contextStack[contextStack.length - 1];
    }

    return {
      start: startPos,
      end: endPos
    }
  }

  function indexToPos(textValue, i) {
    var beginStr = textValue.substr(0, i);
    var lines = beginStr.split('\n');
    return {
      line: lines.length - 1,
      ch: lines[lines.length - 1].length
    };
  }

  BackboneEvents.mixin(JsonInputView.prototype);


  var leftInputView = new JsonInputView(document.getElementById('json-diff-left'));
  var rightInputView = new JsonInputView(document.getElementById('json-diff-right'));
  leftInputView.on('change', compareJson);
  rightInputView.on('change', compareJson);
  leftInputView.on('scroll', function () {

  });
  rightInputView.on('scroll', function () {

  });

  function compareJson() {
    leftInputView.clearMarkers();
    rightInputView.clearMarkers();
    var leftJson, rightJson;
    try {
      leftJson = JSON.parse(leftInputView.getText());
      rightJson = JSON.parse(rightInputView.getText());
    } catch (e) {}
    if (!leftJson || !rightJson) return;
    var diffs = jsonpatch.compare(leftJson, rightJson);
    console.log(diffs);
    diffs.forEach(function (diff) {
      if (diff.op === 'remove') {
        leftInputView.highlightRemoval(diff);
      } else if (diff.op === 'add') {
        rightInputView.highlightAddition(diff);
      } else if (diff.op === 'replace') {
        rightInputView.highlightChange(diff);
        leftInputView.highlightChange(diff);
      }
    });
  }

})();
