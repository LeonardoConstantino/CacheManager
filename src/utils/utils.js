
/**
 * Converte uma string de tempo no formato 'hh:mm:ss'|'mm:ss'|'ss' em milissegundos.
 * @param {string} timeString - A string de tempo no formato 'hh:mm:ss'|'mm:ss'|'ss'.
 * @returns {number} - O número em milissegundos correspondente à string de tempo.
 * @throws {Error} - Lança erro se o formato for inválido.
 */
const timeToMilliseconds = (timeString) => {
  // Validação inicial
  if (typeof timeString !== 'string' || !timeString.trim()) {
    throw new Error('Formato de tempo inválido. Use "hh:mm:ss", "mm:ss" ou "ss".');
  }

  const parts = timeString.trim().split(':');
  
  // Validação do número de partes
  if (parts.length === 0 || parts.length > 3) {
    throw new Error('Formato de tempo inválido. Use "hh:mm:ss", "mm:ss" ou "ss".');
  }

  // Converte para números e valida
  const numbers = parts.map(part => {
    const trimmed = part.trim();
    if (trimmed === '' || !/^\d+$/.test(trimmed)) {
      throw new Error('Formato de tempo inválido. Use apenas números.');
    }
    return parseInt(trimmed, 10);
  });

  // Padroniza para [horas, minutos, segundos]
  const [hours = 0, minutes = 0, seconds = 0] = numbers.length === 1 
    ? [0, 0, numbers[0]]           // formato 'ss'
    : numbers.length === 2 
    ? [0, ...numbers]              // formato 'mm:ss'
    : numbers;                     // formato 'hh:mm:ss'

  // Validação de faixas
  if (minutes >= 60 || seconds >= 60) {
    throw new Error('Minutos e segundos devem ser menores que 60.');
  }

  if (hours < 0 || minutes < 0 || seconds < 0) {
    throw new Error('Valores de tempo não podem ser negativos.');
  }

  // Calcula milissegundos
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
};

// Versão alternativa que retorna null em caso de erro (mais funcional)
const timeToMillisecondsNullable = (timeString) => {
  try {
    return timeToMilliseconds(timeString);
  } catch {
    return null;
  }
};

const randomString = () => {
  const timestamp = Date.now(); // Pega o timestamp atual
  const randomPart = Math.random().toString(36).substring(2, 11); // Gera uma string alfanumérica aleatória
  return `${timestamp}-${randomPart}`;
};

const clamp = (value, min, max, fallback = 0) => {
  if (isNaN(value)) return fallback // Retorna o fallback se o valor não for um número
  return Math.max(min, Math.min(value, max)) // Restringe o valor entre min e max
}

/**
 * Formata duração em milissegundos para formato legível
 * @param {number} ms - Duração em milissegundos
 * @returns {string} - Duração formatada
 */
const formatDuration = (ms) => {
  if (ms < 1) {
    return `${Math.round(ms * 1000)}μs`;
  } else if (ms < 1000) {
    return `${Math.round(ms * 100) / 100}ms`;
  } else if (ms < 60000) {
    return `${Math.round(ms / 10) / 100}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round(((ms % 60000) / 1000) * 100) / 100;
    return `${minutes}m ${seconds}s`;
  }
};

/**
 * Obtém a data e hora atual formatada.
 * @returns {string} Data e hora formatada
 */
const getTimestamp = () =>
  new Intl.DateTimeFormat('pt-BR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).format(new Date());

/**
 * Função auxiliar para formatar objetos de forma consistente
 * @param {any} obj - Objeto a ser formatado
 * @returns {string} - Representação formatada do objeto
 */
const formatObject = (obj) => {
  try {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'string') return `"${obj}"`;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

    if (obj instanceof Error) {
      // Formatação especial para objetos Error
      const errorObj = {
        name: obj.name,
        message: obj.message,
        ...(obj.stack && { stack: obj.stack.split('\n').slice(0, 5) }), // Primeiras 5 linhas do stack
      };
      return JSON.stringify(errorObj, null, 2);
    }

    if (typeof obj === 'function') {
      return `[Function: ${obj.name || 'anonymous'}]`;
    }

    // Para Arrays e Objetos, sempre usar formatação com indentação
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'function') {
          return `[Function: ${value.name || 'anonymous'}]`;
        }
        if (value instanceof Date) {
          return `[Date: ${value.toISOString()}]`;
        }
        if (value instanceof Error) {
          return `[Error: ${value.message}]`;
        }
        // Limita strings muito longas para evitar poluição visual
        if (typeof value === 'string' && value.length > 200) {
          return value.substring(0, 200) + '... [truncated]';
        }
        return value;
      },
      2
    );
  } catch (error) {
    return String(obj);
  }
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = {
  timeToMilliseconds,
  randomString,
  clamp,
  formatDuration,
  getTimestamp,
  formatObject,
  sleep
};
