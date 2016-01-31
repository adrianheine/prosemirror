'use strict'

var map = Object.create(null)
map.MenuGroup = "union<MenuElement, MenuCommandGroup, [union<MenuElement, MenuCommandGroup>]>"
// FIXME: This is an actual class, but it's private
map.SelectionToken = "{type: constructor<Selection>, a: number, b: number}"

module.exports = function (type, parse) {
  return typeof map[type] === 'string' ? parse(map[type]) : type
}
