/**
 * @typedef {import('../types/cache.types.js').CacheInterface} CacheForPersistence
 */

/**
 * Módulo de persistência mínima para cache e armazenamento de dados.
 * 
 * Oferece três padrões de persistência:
 * 1. `MinimalPersistence`: Persistência básica de objetos completos
 * 2. `SimplePersistentStore`: Armazenamento chave-valor com expiração
 * 3. `PersistentCache`: Sistema de cache com persistência automática
 * 
 * @example
 * // Exemplo 1: Cache Persistente
 * const persistentCache = createPersistentCache(baseCache, 'user_data', 30000);
 * persistentCache.set('user_123', { name: 'João' });
 * 
 * // Exemplo 2: Armazenamento Chave-Valor
 * const store = new SimplePersistentStore('app_settings');
 * store.set('theme', 'dark', 86400000); // Expira em 24h
 * 
 * // Exemplo 3: Persistência Básica
 * const persistence = new MinimalPersistence('my_data');
 * persistence.save({ config: true });
 * 
 * @module PersistenceSystem
 * @see MinimalPersistence
 * @see SimplePersistentStore
 * @see PersistentCache
 */

const MinimalPersistence = require('./MinimalPersistence.js');
const PersistentCache = require('./PersistentCache.js');
const SimplePersistentStore = require('./SimplePersistentStore.js');

/**
 * Factory para criar instâncias de PersistentCache.
 * 
 * @function
 * @param {CacheForPersistence} cache - Instância de cache base compatível
 * @param {string} storageKey - Chave única para armazenamento persistente
 * @param {number|null} [autoSaveInterval=null] - Intervalo de auto-salvamento em ms
 * @returns {PersistentCache} Instância configurada de cache persistente
 * 
 * @example
 * const baseCache = new MapCache(); // Implementa interface: get, set, delete, clear, keys
 * const userCache = createPersistentCache(baseCache, 'users', 60000);
 * 
 * @throws {TypeError} Se o cache base não implementar a interface necessária
 * @throws {Error} Se storageKey não for string válida
 */
function createPersistentCache(cache, storageKey, autoSaveInterval = null) {
  // Validação de interface do cache
  const requiredMethods = ['get', 'set', 'delete', 'clear', 'keys'];
  if (!requiredMethods.every(method => typeof cache[method] === 'function')) {
    throw new TypeError('Cache base deve implementar: get, set, delete, clear, keys');
  }
  
  // Validação da chave de armazenamento
  if (typeof storageKey !== 'string' || storageKey.trim() === '') {
    throw new Error('storageKey deve ser uma string não vazia');
  }
  
  return new PersistentCache(cache, storageKey, autoSaveInterval);
}

// Exportações
module.exports = {
  MinimalPersistence,
  SimplePersistentStore,
  createPersistentCache,
};