export function isFalsyOrWhitespace(str: string | undefined): boolean {
	if (!str || typeof str !== 'string') {
		return true;
	}
	return str.trim().length === 0;
}

export function escapeRegExpCharacters(value: string): string {
	return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\[\]\(\)\#]/g, '\\$&');
}

export function regExpFlags(regexp: RegExp): string {
	return (regexp.global ? 'g' : '')
		+ (regexp.ignoreCase ? 'i' : '')
		+ (regexp.multiline ? 'm' : '')
		+ ((regexp as any).unicode ? 'u' : '');
}

export function format(fmt: string, ...args: any) {
  var argIndex = 0
    , i = 0
    , n = fmt.length
    , result = ''
    , c
    , escaped = false
    , arg
    , tmp
    , leadingZero = false
    , precision
    , nextArg = function() { return args[argIndex++]; }
    , slurpNumber = function() {
        var digits = '';
        while (/\d/.test(fmt[i])) {
          digits += fmt[i++];
          c = fmt[i];
        }
        return digits.length > 0 ? parseInt(digits) : null;
      }
    ;
  for (; i < n; ++i) {
    c = fmt[i];
    if (escaped) {
      escaped = false;
      if (c == '.') {
        leadingZero = false;
        c = fmt[++i];
      }
      else if (c == '0' && fmt[i + 1] == '.') {
        leadingZero = true;
        i += 2;
        c = fmt[i];
      }
      else {
        leadingZero = true;
      }
      precision = slurpNumber();
      switch (c) {
      case 'b': // number in binary
        result += parseInt(nextArg(), 10).toString(2);
        break;
      case 'c': // character
        arg = nextArg();
        if (typeof arg === 'string' || arg instanceof String)
          result += arg;
        else
          result += String.fromCharCode(parseInt(arg, 10));
        break;
      case 'd': // number in decimal
        result += parseInt(nextArg(), 10);
        break;
      case 'f': // floating point number
        tmp = String(parseFloat(nextArg()).toFixed(precision || 6));
        result += leadingZero ? tmp : tmp.replace(/^0/, '');
        break;
      case 'j': // JSON
        result += JSON.stringify(nextArg());
        break;
      case 'o': // number in octal
        result += '0' + parseInt(nextArg(), 10).toString(8);
        break;
      case 's': // string
        result += nextArg();
        break;
      case 'x': // lowercase hexadecimal
        result += '0x' + parseInt(nextArg(), 10).toString(16);
        break;
      case 'X': // uppercase hexadecimal
        result += '0x' + parseInt(nextArg(), 10).toString(16).toUpperCase();
        break;
      default:
        result += c;
        break;
      }
    } else if (c === '%') {
      escaped = true;
    } else {
      result += c;
    }
  }
  return result;
}