export function less(a: any, b: any) {
  return a < b;
}

export function greater(a: any, b: any) {
  return a > b;
}

export function lessOrEqual(a: any, b: any) {
  return a <= b;
}

export function greaterOrEqual(a: any, b: any) {
  return a >= b;
}

export function equals(a: any, b: any) {
  return a === b;
}

export function notEquals(a: any, b: any) {
  return a !== b;
}

export function isAt(a: any, b: any) {
  // Checks if a is in b (for strings or arrays)
  if (typeof b === 'string' || Array.isArray(b)) {
    return b.includes(a);
  }
  return false;
}

export function isNotAt(a: any, b: any) {
  if (typeof b === 'string' || Array.isArray(b)) {
    return !b.includes(a);
  }
  return true;
}

export function matches(a: any, b: any) {
  // b is a regex string, e.g. "^foo.*"
  try {
    const re = new RegExp(b);
    return re.test(a);
  } catch {
    return false;
  }
}

export function notMatches(a: any, b: any) {
  try {
    const re = new RegExp(b);
    return !re.test(a);
  } catch {
    return true;
  }
}

export function startsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.startsWith(b);
  }
  return false;
}

export function notStartsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return !a.startsWith(b);
  }
  return true;
}

export function endsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.endsWith(b);
  }
  return false;
}

export function notEndsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return !a.endsWith(b);
  }
  return true;
}