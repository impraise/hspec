import chalk from 'chalk'
import yaml from 'js-yaml'

export function outputError (err) {
  console.log(chalk.redBright(`An error occurred while running your command:\n\n`))
  
  if (err instanceof yaml.YAMLException) {
    outputYamlError(err)
    console.log('\n\n')
  }
  
  console.log(err.message)
  console.log(chalk.grey('\n\nRun this command with DEBUG=hspec* spec for additional details\n'))
}

function outputYamlError (err) {
  const lines = err.mark.buffer.toString().split('\n')
  const lineNo = err.mark.line
  const contextLines = 6

  const context = lines.slice(Math.max(lineNo - contextLines, 0), Math.min(lineNo + contextLines, lines.length))

  const contextWithLineNo = context.map((line, idx) => {
    const contextLineNo = lineNo - idx + contextLines

    const isAffectedLine = contextLineNo === lineNo

    const lineNumberColor = isAffectedLine ? chalk.yellow : chalk.blue
    const lineColor = isAffectedLine ? chalk.white : chalk.grey

    return `  ${lineNumberColor(contextLineNo)} | ${lineColor(line)}`
  })

  console.log(contextWithLineNo.join('\n'))
}
