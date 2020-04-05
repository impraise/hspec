import varDiff from 'variable-diff'
import yaml from 'js-yaml'
import chalk from 'chalk'

const visualDiffColors = {
  removed: chalk.redBright,
  added: chalk.greenBright,
  modified: chalk.yellowBright
}

const visualDiffOptions = {
  indent: '  ',
  newLine: '\n',
  color: true,
  printVar (variable) {
    return yaml.safeDump(variable)
  },
  wrap (type, text) {
    return visualDiffColors[type](text)
  }
}

function resourceKey (res) {
  const ns = res.metadata.namespace || 'default'
  return `${ns}.${res.apiVersion}.${res.kind}.${res.metadata.name}`
}

function listToResourceMap (list, options) {
  return list.reduce((map, res) => {
    const key = resourceKey(res)

    if (typeof map[key] !== 'undefined' && options.failOnDuplicateResources) {
      throw new Error(`duplicate resource: '${key}' was already seen`)
    }

    map[key] = res
    return map
  }, {})
}

function outputChangeset (resources, opName, color, char = '~') {
  console.log(color.bold(`\n▓▓ ${opName} ${resources.length} resource(s)`))

  resources.forEach(res => {
    const key = resourceKey(res)

    console.log(color(`\n${char} ${key}\n`))
    console.log(color(yaml.safeDump(res)), '\n')
  })
}

export function compare (prev, current, options) {
  const prevMap = listToResourceMap(prev, options)
  const currentMap = listToResourceMap(current, options)

  const presenceFn = res => typeof prevMap[resourceKey(res)] !== 'undefined'
  const deletedFn = res => typeof currentMap[resourceKey(res)] === 'undefined'

  // Release-level changes:
  const existing = current.filter(presenceFn)
  const added = current.filter(res => !presenceFn(res))
  const removed = prev.filter(deletedFn)
  
  if (removed.length > 0) outputChangeset(removed, 'removed', visualDiffColors.removed, '-')
  if (added.length > 0) outputChangeset(added, 'add', visualDiffColors.added, '+')

  let internalDiffCount = 0

  existing.forEach(res => {
    const key = resourceKey(res)
    const old = prevMap[key]

    const diffResult = varDiff(old, res, visualDiffOptions)

    if (diffResult.changed) {
      internalDiffCount += 1

      console.log(visualDiffColors.modified.bold(`\n▓▓ change @`), visualDiffColors.modified(`${key}\n`))
      console.log(diffResult.text, '\n')
    }
  })

  const anyChange = internalDiffCount > 0 || removed.length > 0 || added.length > 0

  if (anyChange) {
    console.log('\n\n----------\n')
    console.log(visualDiffColors.modified(`${internalDiffCount} changes`))
    console.log(visualDiffColors.removed(`${removed.length} resources removed`))
    console.log(visualDiffColors.added(`${added.length} resources added`), '\n')
  }

  return anyChange
}
