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

//TODO: Write recursion for objectOf
function parseReactPropTypesRecursive(props, parent = '', obj = []){
  Object.entries(props || {}).forEach(([key, prop]) => {
    if(prop?.type?.name === 'shape') {
      parseReactPropTypesRecursive(prop.type.value, parent + key + '.', obj)
    }
    obj.push({
      name: parent + key,
      description: prop.description,
      type: prop.name ? prop.name : (prop.type ? prop.type.name : prop.flowType.name),
      required: typeof prop.required === 'boolean' && prop.required,
      defaultValue: prop.defaultValue
        ? (prop.defaultValue.computed ? 'function()' : prop.defaultValue.value)
        : undefined
    })
  })
  return obj
} 

exports.parseVue = parseVue
exports.parseReact = parseReact
