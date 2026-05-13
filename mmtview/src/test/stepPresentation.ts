export function codiconForStepType(type?: string): string {
  switch (type) {
    case 'print':
      return 'output';
    case 'js':
      return 'code';
    case 'call':
      return 'symbol-method';
    case 'data':
      return 'database';
    case 'delay':
      return 'debug-pause';
    case 'set':
      return 'symbol-constant';
    case 'const':
    case 'var':
    case 'let':
      return 'symbol-variable';
    case 'check':
      return 'check';
    case 'assert':
      return 'pass';
    case 'if':
      return 'question';
    case 'for':
      return 'sync';
    case 'repeat':
      return 'debug-restart';
    case 'setenv':
      return 'globe';
    case 'stage':
      return 'layers';
    case 'run':
      return 'server-process';
    default:
      return 'file';
  }
}

export function displayNameForStepType(type?: string): string {
  switch (type) {
    case 'delay':
      return 'delay';
    case 'for':
      return 'for';
    case 'repeat':
      return 'repeat';
    case 'call':
      return 'call';
    case 'run':
      return 'run';
    case 'assert':
      return 'assert';
    case 'check':
      return 'check';
    case 'set':
      return 'set';
    case 'const':
      return 'const';
    case 'var':
      return 'var';
    case 'let':
      return 'let';
    case 'data':
      return 'data';
    case 'setenv':
      return 'setenv';
    case 'print':
      return 'print';
    case 'js':
      return 'js';
    case 'stage':
      return 'stage';
    default:
      return type || 'step';
  }
}