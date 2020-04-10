import chalk from 'chalk'

export function outputError (err) {
  console.log(chalk.redBright(`An error occurred while running your command:\n\n`))
  console.log(err.message)
  console.log(chalk.grey('\n\nRun this command with DEBUG=hspec* spec for additional details\n'))
}
