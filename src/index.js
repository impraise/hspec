import debug from 'debug'
import cmd from 'command-line-args'
import fs from 'fs'
import yaml from 'js-yaml'
import path from 'path'
import mkdirp from 'mkdirp'
import match from 'micromatch'
import chalk from 'chalk'
import prompt from 'prompt'

import { compare } from './spec'
import { template } from './helm'

const abbreviationMap = {
  deployment: 'dpl',
  service: 'svc',
  ingress: 'ing',
  configmap: 'cm'
}

const log = debug('hspec')

const args = cmd([
  { name: 'chart', alias: 'c', type: String },
  { name: 'apply', alias: 'a', type: Boolean },
  { name: 'hspec', alias: 'f', type: String }
])

const defaultOptions = {
  releaseName: 'hspec-test',
  failOnDuplicateResources: true,

  chartFile: 'Chart.yaml',
  hspecFile: 'hspec.yaml',
  helmBin: 'helm',

  hspecDir: 'hspec',
  excludeKind: [],
  excludeName: []
}

async function optionsForChart(chartPath, hspecFilePath) {
  let options = defaultOptions
  const hspecFile = hspecFilePath ? path.resolve(hspecFilePath) : path.join(chartPath, defaultOptions.hspecFile)

  log('looking for hspec file', hspecFile)

  // Try to load and parse the hspec file if one exists, or use
  // the default options:
  if (fs.existsSync(hspecFile)) {
    const hspec = await yaml.safeLoad(await fs.promises.readFile(hspecFile))
    log('loaded hspec file', hspecFile)
    options = { ...options, ...hspec }
  }

  // Try to load and parse the Chart.yaml file for this chart:
  const chartYaml = await fs.promises.readFile(path.join(chartPath, options.chartFile))

  options.chart = await yaml.safeLoad(chartYaml)
  options.chartPath = chartPath

  return options
}

async function createHspecDirIfMissing (options) {
  const hspecDir = path.join(options.chartPath, options.hspecDir)

  if (!fs.existsSync(hspecDir)) {
    await mkdirp(hspecDir)
  }

  return hspecDir
}

function excludeWithGlob (resources, globs, fieldFn) {
  return resources.filter(res => {
    const fieldValue = fieldFn(res)

    // If the field is not available for some reason, it passes the filter:
    if (typeof fieldValue !== 'string') return true

    return !match.isMatch(fieldValue, globs)
  })
}

function filterResources (resources, options) {
  const withKindFiltered = excludeWithGlob(resources, options.excludeKind, res => res.kind)
  const withNameFiltered = excludeWithGlob(withKindFiltered, options.excludeName, res => res.metadata.name)

  return withNameFiltered
}

function abbreviated (original) {
  if (abbreviationMap[original]) {
    return abbreviationMap[original]
  }

  return original
}

function isYamlFile (file) {
  const ext = path.extname(file)
  return ext === '.yml' || ext === '.yaml'
}

async function scanDirectoryForResources (dir) {
  const res = await fs.promises.readdir(dir)

  const readers = res.filter(isYamlFile).map(async (file) => {
    log('read file', file)
    const contents = await fs.promises.readFile(path.join(dir, file))

    return yaml.safeLoad(contents)
  })

  return Promise.all(readers)
}

async function unlinkFiles (files) {
  return Promise.all(files.map(async f => {
    log('delete file', f)
    return fs.promises.unlink(f)
  }))
}

async function dumpResources (dir, resources) {
  let filesToWrite = []

  const writers = resources.map(async res => {
    const ns = res.metadata.namespace ? `-${res.metadata.namespace}` : ''
    const fileName = `${abbreviated(res.kind.toLowerCase())}-${ns}${res.metadata.name}.yaml`

    const file = path.join(dir, fileName)
    filesToWrite.push(file)

    log('write file', file)
    return fs.promises.writeFile(file, yaml.safeDump(res))
  })

  // Delete yaml files not included in the list:
  const filestoRemove = (await fs.promises.readdir(dir)).filter(isYamlFile).map(file => {
    const fullPath = path.join(dir, file)
    if (filesToWrite.indexOf(fullPath) === -1) return fullPath
  }).filter(f => f)

  if (filestoRemove.length > 0) {
    log('deleting files', filestoRemove.length)
    await unlinkFiles(filestoRemove)
  }

  return Promise.all(writers)
}

function promptForConfirmation (resultFn) {
  prompt.start()
  
  prompt.get({
    properties: {
      confirmation: {
        description: chalk.blueBright(`Do you wish to record these changes with hspec?`),
        type: 'string',
        pattern: /^(yes|no)$/i,
        message: chalk.redBright('Must answer yes or no'),
        required: true
      }  
    }
  }, (err, result) => {
    if (err) throw err

    resultFn(result.confirmation && result.confirmation.toLowerCase() === 'yes')
  })
}

async function main () {
  const chartPath = args.chart ? path.resolve(args.chart) : process.cwd()
  const options = await optionsForChart(chartPath, args.hspec)
  const hspecDir = await createHspecDirIfMissing(options)

  const previous = await scanDirectoryForResources(hspecDir, options)
  const current = filterResources(await template(chartPath, options), options)

  if (previous.length === 0 && current.length > 0) {
    console.log('dumping artifacts for the first time, cannot compare')

    await dumpResources(hspecDir, current)
    return
  }
  
  if (compare(previous, current, options)) {
    if (args.apply) {
      console.log(chalk.greenBright('Accepting changes because --apply was provided'))
      await dumpResources(hspecDir, current)
    } else {
      promptForConfirmation(async accepted => {
        if (accepted) {
          await dumpResources(hspecDir, current)
        }
      })
    }
  } else {
    console.log(chalk.greenBright('\n----------\n\nNo changes, you\'re all set!\n'))
  }
}

main().catch(err => {
  console.log(
    chalk.redBright(`An error occurred while running your command:\n\n`),
    err.message,
    chalk.grey('\n\nRun this command with DEBUG=hspec* spec for additional details\n')
  )

  log('main exception', err)

  process.exit(1)
})
