// Test the new quantity recalculation algorithm
class RecipeParser {
  static parseFraction(str) {
    if (str.includes('/')) {
      const [num, den] = str.split('/');
      return parseFloat(num) / parseFloat(den);
    }
    return parseFloat(str);
  }

  static decimalToFraction(decimal) {
    const commonFractions = [
      [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.666, '⅔'], [0.75, '¾']
    ];
    
    for (const [value, symbol] of commonFractions) {
      if (Math.abs(decimal - value) < 0.05) {
        return symbol;
      }
    }
    
    if (decimal < 0.1) return '';
    return decimal.toFixed(2);
  }

  static findBestCombination(totalAmount, measurements, availableCups) {
    const available = measurements.filter(m => 
      availableCups.includes(m.name) || m.name.includes('lb') || m.name.includes('oz')
    );
    
    if (available.length === 0) {
      return `${totalAmount.toFixed(2)}${measurements[measurements.length - 1].name.replace(/^[\d\/\.]+/, '')}`;
    }
    
    for (const measure of available) {
      if (Math.abs(totalAmount - measure.value) < 0.001) {
        return measure.display;
      }
    }
    
    let remaining = totalAmount;
    const result = [];
    
    let primaryUnit = null;
    let secondaryUnit = null;
    
    for (let i = 0; i < available.length; i++) {
      if (remaining >= available[i].value - 0.001) {
        primaryUnit = available[i];
        // Find the next smaller unit for fractional part
        for (let j = i + 1; j < available.length; j++) {
          secondaryUnit = available[j];
          break;
        }
        break;
      }
    }
    
    if (!primaryUnit) {
      const smallestUnit = available[available.length - 1];
      const fraction = this.decimalToFraction(totalAmount / smallestUnit.value);
      const unitName = smallestUnit.name.replace(/^[\d\/\.]+/, '');
      return `${fraction}${unitName}`;
    }
    
    const primaryCount = Math.floor(remaining / primaryUnit.value + 0.001);
    remaining -= primaryCount * primaryUnit.value;
    
    if (primaryCount === 1) {
      result.push(primaryUnit.display);
    } else {
      result.push(`${primaryCount} ${primaryUnit.display}`);
    }
    
    if (remaining > 0.001 && secondaryUnit) {
      const secondaryAmount = remaining / secondaryUnit.value;
      const fraction = this.decimalToFraction(secondaryAmount);
      const unitName = secondaryUnit.name.replace(/^[\d\/\.]+/, '');
      
      if (fraction !== '0' && fraction !== '') {
        result.push(`${fraction}${unitName}`);
      }
    }
    
    return result.join(' + ') || `${totalAmount}${measurements[measurements.length - 1].name.replace(/^[\d\/\.]+/, '')}`;
  }

  static optimizeMeasurement(amount, unit, availableCups) {
    const conversions = {
      'tsp': 1, 'tbsp': 3, 'cup': 48,
      'oz': 1, 'lb': 16
    };
    
    const volumeMeasurements = [
      { name: '1cup', value: 48, display: '1cup' },
      { name: '1/2cup', value: 24, display: '½cup' },
      { name: '1/3cup', value: 16, display: '⅓cup' },
      { name: '1/4cup', value: 12, display: '¼cup' },
      { name: '1/8cup', value: 6, display: '⅛cup' },
      { name: '1.5tbsp', value: 4.5, display: '1½tbsp' },
      { name: '1tbsp', value: 3, display: '1tbsp' },
      { name: '1tsp', value: 1, display: '1tsp' },
      { name: '1/2tsp', value: 0.5, display: '½tsp' },
      { name: '1/4tsp', value: 0.25, display: '¼tsp' }
    ];
    
    const weightMeasurements = [
      { name: '1lb', value: 16, display: '1lb' },
      { name: '1oz', value: 1, display: '1oz' }
    ];
    
    const isVolume = ['tsp', 'tbsp', 'cup'].includes(unit);
    const isWeight = ['oz', 'lb'].includes(unit);
    
    if (isVolume) {
      const totalTsp = amount * (conversions[unit] || 1);
      return this.findBestCombination(totalTsp, volumeMeasurements, availableCups);
    } else if (isWeight) {
      const totalOz = amount * (conversions[unit] || 1);
      return this.findBestCombination(totalOz, weightMeasurements, availableCups);
    } else {
      return `${amount}${unit}`;
    }
  }
}

// Test cases to verify conversions
console.log('Conversion check:');
console.log('1 cup = 48 tsp, 1 tbsp = 3 tsp, 1 lb = 16 oz');
console.log('5.75 cups = ', 5.75 * 48, 'tsp');
console.log('Expected: 5 cups (240 tsp) + remaining 36 tsp = remaining ½ cup (24 tsp) + 12 tsp = ¼ cup');

console.log('\nTesting new algorithm (top 2 units: integer + fractional):');
console.log('5.75 cups:', RecipeParser.optimizeMeasurement(5.75, 'cup', ['1cup', '1/2cup', '1/4cup']));
console.log('2.33 tbsp:', RecipeParser.optimizeMeasurement(2.33, 'tbsp', ['1tbsp', '1tsp']));
console.log('1.5 lb:', RecipeParser.optimizeMeasurement(1.5, 'lb', ['1lb', '1oz']));
console.log('0.75 tsp:', RecipeParser.optimizeMeasurement(0.75, 'tsp', ['1tsp', '1/2tsp', '1/4tsp']));
console.log('10.25 cups:', RecipeParser.optimizeMeasurement(10.25, 'cup', ['1cup', '1/2cup', '1/4cup']));
console.log('3.66 tbsp:', RecipeParser.optimizeMeasurement(3.66, 'tbsp', ['1tbsp', '1tsp']));

// Debug 5.75 cups step by step
console.log('\nDebugging 5.75 cups:');
const totalTsp = 5.75 * 48; // 276 tsp
console.log('Total tsp:', totalTsp);
const cupCount = Math.floor(totalTsp / 48); // 5 cups
const remainingTsp = totalTsp - (cupCount * 48); // 36 tsp
console.log('Cup count:', cupCount, 'Remaining tsp:', remainingTsp);
console.log('Remaining in half cups:', remainingTsp / 24); // Should be 1.5 = 1 half cup + 12 tsp
console.log('12 tsp in quarter cups:', 12 / 12); // Should be 1 quarter cup