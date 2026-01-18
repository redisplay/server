import chalk from 'chalk';

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

function formatData(data) {
  if (!data || Object.keys(data).length === 0) return '';
  return '\n' + chalk.gray(JSON.stringify(data, null, 2));
}

export function logSSE(message, data = {}) {
  const ts = chalk.gray(`[${getTimestamp()}]`);
  const tag = chalk.cyan.bold('[SSE]');
  console.log(`${ts} ${tag} ${message}${formatData(data)}`);
}

export function logChannel(message, channel, data = {}) {
  const ts = chalk.gray(`[${getTimestamp()}]`);
  const tag = chalk.magenta.bold(`[CHANNEL:${channel}]`);
  console.log(`${ts} ${tag} ${message}${formatData(data)}`);
}

export function logBle(message, data = {}) {
  const ts = chalk.gray(`[${getTimestamp()}]`);
  const tag = chalk.blue.bold('[BLE]');
  console.log(`${ts} ${tag} ${message}${formatData(data)}`);
}

export function logInfo(message, data = {}) {
  const ts = chalk.gray(`[${getTimestamp()}]`);
  const tag = chalk.green.bold('[INFO]');
  console.log(`${ts} ${tag} ${message}${formatData(data)}`);
}

export function logError(message, error) {
  const ts = chalk.gray(`[${getTimestamp()}]`);
  const tag = chalk.red.bold('[ERROR]');
  
  let errorDetails = '';
  if (error) {
    if (error instanceof Error) {
      errorDetails = '\n' + chalk.red(error.stack || error.message);
    } else {
      errorDetails = '\n' + chalk.red(JSON.stringify(error, null, 2));
    }
  }
  
  console.error(`${ts} ${tag} ${chalk.red(message)}${errorDetails}`);
}

export function logWarn(message, data = {}) {
  const ts = chalk.gray(`[${getTimestamp()}]`);
  const tag = chalk.yellow.bold('[WARN]');
  console.warn(`${ts} ${tag} ${chalk.yellow(message)}${formatData(data)}`);
}
