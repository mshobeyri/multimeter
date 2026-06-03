// helpers.js — CommonJS module for use in mmt test steps
module.exports = {
  /**
   * Generate a greeting message
   */
  greet(name) {
    return `Hello, ${name}!`;
  },

  /**
   * Calculate the sum of an array of numbers
   */
  sum(numbers) {
    return numbers.reduce((acc, n) => acc + n, 0);
  },

  /**
   * Format a timestamp as ISO date string
   */
  formatDate(epoch) {
    return new Date(epoch).toISOString();
  }
};
