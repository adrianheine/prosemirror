function skipCommentLines(str) {
  var match;
  while (match = str.match(/^[ \t]*\/\/.*\n/)) {
    str = str.substr(match[0].length);
  }
  return str;
}

exports.skipCommentLines = skipCommentLines
