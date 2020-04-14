import debug from 'debug'
import path from 'path'
import yaml from 'js-yaml'
import { promisify } from 'util'
import { exec } from 'child_process'

const log = debug('hspec:helm')
const execAsync = promisify(exec)

function valuesFilesFromOptions (options) {
  return (options.valuesFiles || []).map(vf => `-f ${path.join(options.chartPath, vf)}`).join(' ')
}

export async function template (path, options) {
  const helmBin = process.env.HSPEC_HELM_BIN || 'helm'
  const releaseName = options.releaseName
  const command = `${helmBin} template ${releaseName} ${path} ${valuesFilesFromOptions(options)}`

  log('helm template', command)

  const result = await execAsync(command)

  return yaml.safeLoadAll(result.stdout)
}
