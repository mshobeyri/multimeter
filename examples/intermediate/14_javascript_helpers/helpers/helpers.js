// helpers.js — plain top-level functions (auto-exported on import)
/**
 * Generate a greeting message
 */
function greet(name) {
  return `Hello, ${name}!`;
}

/**
 * Calculate the sum of an array of numbers
 */
function sum(numbers) {
  return numbers.reduce((acc, n) => acc + n, 0);
}

/**
 * Format a timestamp as ISO date string
 */
function formatDate(epoch) {
  return new Date(epoch).toISOString();
}
