var reactDocs = require('react-docgen')
var vueDocs = require('vue-docgen-api')
var fs = require('fs')
var path = require('path')

exports.handlers = {
  beforeParse: function(e) {
    if (path.extname(e.filename) === '.vue') {
      e.componentInfo = vueDocs.parse(e.filename)
      var script = e.source.match(new RegExp('<script>(.*?)</script>', 's'))
      e.source = script[1]
    }
  },

  newDoclet: function({ doclet }) {
    var filePath = path.join(doclet.meta.path, doclet.meta.filename)
    const componentTag = (doclet.tags || []).find(tag => tag.title === 'component')
    if (componentTag) {
      if (path.extname(filePath) === '.vue') {
        doclet.component = parseVue(filePath, doclet)
        doclet.component.type = 'vue'
      } else {
        doclet.component = parseReact(filePath, doclet)
        doclet.component.type = 'react'
      }
      doclet.kind = 'class'
    } else {
      if (path.extname(filePath) === '.vue') {
        const docGen = vueDocs.parse(filePath)
        const name = docGen.displayName
        if (doclet.kind === 'function' || doclet.kind === 'event') {
          doclet.memberof = name
        } else {
          doclet.undocumented = true
        }
      }

      if (path.extname(filePath) === '.jsx') {
        if (doclet.kind !== 'function' && doclet.kind !== 'event') {
          doclet.undocumented = true
        }
      }
    }
  }
}

var parseReact = function (filePath, doclet) {
  if (path.extname(filePath) === '.tsx') {
    return {
      props: [],
      displayName: doclet.name,
      filePath: filePath,
    }
  }
  var src = fs.readFileSync(filePath, 'UTF-8')
  var docGen
  try {
    docGen = reactDocs.parse(src)
  } catch (error) {
    if (error.message === 'No suitable component definition found.') {
      return {
        props: [],
        filePath: filePath,
        displayName: doclet.name,
      }
    } else {
      throw error
    }
  }

  return {
    props: parseReactPropTypesRecursive(docGen.props),
    displayName: docGen.displayName,
    filePath: filePath,
  }
}

var parseVue = function (filePath, doclet) {
  const docGen = vueDocs.parse(filePath)
  doclet.name = doclet.longname = docGen.displayName
  return {
    displayName: docGen.displayName,
    filePath: filePath,
    props: Object.values(docGen.props || {}).map(prop => ({
      name: prop.name,
      description: prop.description,
      type: prop.type ? prop.type.name : prop.flowType.name,
      required: typeof prop.required === 'boolean' && prop.required,
      defaultValue: prop.defaultValue
        ? (prop.defaultValue.func ? 'function()' : prop.defaultValue.value)
        : undefined
    })),
    slots: Object.keys(docGen.slots || {}).map(key => ({
      name: key,
      description: docGen.slots[key].description,
    }))
  }
}

function parseReactPropTypesRecursive(props, parent = '', obj = []){
  Object.entries(props || {}).forEach(([key, prop]) => {
    let computedType = '', shapePrefix = ''
    console.log(prop?.name, prop?.type, prop?.type?.name, prop?.type?.value?.name)
    if(prop?.name) {
     [computedType, shapePrefix] = getPropName(prop)
    } else {
      [computedType, shapePrefix] = getPropName(prop.type)
    }
    obj.push({
      name: parent + key,
      description: prop.description,
      type: computedType,
      required: typeof prop.required === 'boolean' && prop.required,
      defaultValue: prop.defaultValue
        ? (prop.defaultValue.computed ? 'function()' : prop.defaultValue.value)
        : undefined
    })
    if (prop?.name === 'shape') parseReactPropTypesRecursive(prop.value, parent + key + shapePrefix + '.', obj)
    else if (prop?.value?.name === 'shape') parseReactPropTypesRecursive(prop.value.value, parent + key + shapePrefix + '.', obj)
    else if (prop?.type?.name === 'shape') parseReactPropTypesRecursive(prop.type.value, parent + key + shapePrefix + '.', obj)
    else if (prop?.type?.value?.name === 'shape') parseReactPropTypesRecursive(prop.type.value.value, parent + key + shapePrefix + '.', obj)
  })
  return obj

  function getPropName(prop){
    switch(prop?.name) {
      case 'shape': 
        return ['object', '']
      case 'objectOf': 
        if(prop?.value?.name === 'shape'){
          return ['objectOf(object)', '{}']
        } else {
          return [`objectOf(${prop.value.name})`, '']
        }
      case 'arrayOf':
        if(prop?.value?.name === 'shape'){
          return ['arrayOf(object)', '[]']
        } else {
          return [`arrayOf(${prop?.value?.name})`, '']
        }
      case 'union':
        return [prop?.value.map((val) => val?.name).reduce((prevVal, curVal) => prevVal + '|' + curVal), '']
      default:
        return [prop?.name, '']
    }
  }
}

exports.parseVue = parseVue
exports.parseReact = parseReact
