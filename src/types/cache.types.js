/**
 * @module Types
 * @description Este arquivo centraliza todas as definições de tipo JSDoc para o sistema de cache.
 */

/**
 * @description Define a interface pública e interna completa para uma instância de PersistentCache.
 * Esta é a única fonte de verdade para a estrutura de um objeto de PersistentCache.
 * @typedef {Object} CacheInterface
 * @property {(key: string, value: *, ttl?: number|null) => void | boolean} set - Adiciona ou atualiza um item. O retorno pode variar.
 * @property {(key: string) => * | null} get - Obtém um item.
 * @property {(key: string) => boolean} has - Verifica se um item existe e é válido.
 * @property {(key: string) => boolean} delete - Remove um item.
 * @property {() => void} clear - Limpa todo o cache.
 * @property {() => number} size - Retorna o número de itens.
 * @property {() => string[]} keys - Retorna um iterador de chaves.
 * @property {(key: string) => number | null} getTTL - Retorna o tempo de vida restante
 * @property {(key: string, ttl: number) => boolean} updateTTL - Atualiza o tempo de vida de um item.
 * @property {() => MyCacheStats | object} getStats - Retorna estatísticas do cache.
 * @property {() => MyCacheMemoryStats | object} getMemoryStats - Retorna estatísticas de memória.
 * @property {() => number} cleanup - (Opcional) Remove itens expirados.
 * @property {() => void} destroy - (Opcional) Libera todos os recursos.
 * @property {() => Map<string, {value: *, expiresAt: number, createdAt: number}>} entries - (Opcional) Acesso interno aos dados para serialização.
 */

/**
 * @typedef {CacheInterface} PersistentCache
 *
 * @description Representa uma interface para um sistema de cache persistente, estendendo a interface base `PersistentCache`.
 */

/**
 * Opções de congelamento para objetos
 * @typedef {'deep' | 'shallow' | 'none'} FreezeOption
 */

/**
 * @typedef {Object} CacheConfigOptions
 * @property {number} [defaultTTL] - Tempo de vida padrão para os itens do cache em milissegundos.
 * @property {number} [maxSize] - Tamanho máximo de itens que o cache pode armazenar.
 * @property {boolean} [enableLRU] - Indica se o cache deve usar a estratégia de LRU.
 * @property {boolean} [enableWeakOptimization] - Indica se o cache deve usar a otimização de memória fraca.
 * @property {boolean} [enableAutoCleanup] - Indica se o cache deve limpar automaticamente os itens expirados.
 * @property {number} [cleanupFrequency] - Frequência em milissegundos para limpeza automática.
 * @property {boolean} [debugMode] - Indica se o cache deve emitir logs de depuração.
 * @property {FreezeOption} [freezeOption=FreezeOption.DEEP] - Configurações de congelamento para o cache.
 * @property {Object} [persistence] - Configurações de persistência para o cache.
 * @property {boolean} [persistence.enabled=false] - Indica se a persistência está habilitada para este cache.
 * @property {string|null} [persistence.storageKey] - Chave de armazenamento a ser usada para persistir os dados do cache.
 * @property {number|null} [persistence.autoSaveInterval=null] - Intervalo em milissegundos para salvar automaticamente o cache. Se `null`, salva apenas manualmente.
 */

/**
 * @typedef {Object} HeapItem
 * @property {number} expiresAt - O timestamp Unix (em ms) em que o item expira.
 * @property {string} key - A chave associada ao item do cache.
 */

/**
 * @typedef {Object} LRUCacheItem
 * @property {string} key - A chave única do item no cache LRU.
 * @property {*} value - O valor associado à chave.
 */

/**
 * Representa um nó em uma lista duplamente encadeada para uso em caches LRU.
 * @class LRUNode
 * @typedef {Object} LRUNodeType
 * @property {string} key - Identificador único do item no cache
 * @property {*} value - Valor armazenado no nó
 * @property {LRUNodeType|null} prev - Referência ao nó anterior na lista
 * @property {LRUNodeType|null} next - Referência ao próximo nó na lista
 */

/**
 * @typedef {Object} MyCacheStats
 * @property {string} name - O nome do cache.
 * @property {number} size - O número atual de itens no cache.
 * @property {number} maxSize - O tamanho máximo configurado para o cache.
 * @property {number} defaultTTL - O TTL padrão do cache em milissegunsdos.
 * @property {string} hitRate - A taxa de acertos do cache formatada como porcentagem (ex: "85.23%").
 * @property {number} hits - O número total de acertos.
 * @property {number} misses - O número total de falhas.
 * @property {number} sets - O número total de operações de escrita.
 * @property {number} evictions - O número total de itens removidos por LRU.
 * @property {number} cleanups - O número total de limpezas executadas.
 * @property {number} objectsInCache - O número de objetos complexos no cache.
 * @property {number} clonesInCache - O número de clones de objetos no cache de otimização.
 * @property {number} missesExpired - Número de itens expirados
 * @property {number} missesCold - Número de itens não encontrados
 * @property {number} evictionsTTL - Número de itens removidos por TTL
 * @property {number} totalSetLatencyMS - Soma de todas as Latências para armazenar itens
 * @property {Object} maxSetLatencyMS - Objeto com a maior latência de armazenamento
 * @property {string} maxSetLatencyMS.key - Chave do item com a maior latência
 * @property {number} maxSetLatencyMS.latencyMS - Maior latência em milissegundos
 * @property {number} avgSetLatencyMS - Latência média de armazenamento em milissegundos
 * @property {string} lastSetKey - Chave do último item armazenado
 */

/**
 * @typedef {Object} MyCacheMemoryStats
 * @property {number} totalSize - O tamanho estimado baseada em JSON.stringify.
 * @property {number} totalEntries - O número total de entradas no cache.
 * @property {number} objectEntries - O número de entradas que armazenam objetos.
 * @property {number} primitiveEntries - O número de entradas que armazenam valores primitivos.
 * @property {string} estimatedSize - O tamanho estimado do cache em Kilobytes (KB).
 * @property {number} averageEntrySize - O tamanho médio estimado de cada entrada em bytes.
 */

/**
 * @description Estatísticas consolidadas de memória para todos os caches
 * @typedef {Object} ConsolidatedMemoryStats
 * @property {number} totalSize - Tamanho total dos dados em todos os caches
 * @property {number} totalEntries - Número total de entradas em todos os caches
 * @property {number} objectEntries - Número de entradas de objetos em todos os caches
 * @property {number} primitiveEntries - Número de entradas de tipos primitivos em todos os caches
 * @property {number} averageEntrySize - Tamanho médio das entradas calculado
 * @property {string} estimatedSize - Tamanho estimado total formatado em KB
 */

/**
 * @description Resultado completo das estatísticas de memória consolidadas
 * @typedef {Object} MemoryStatsResult
 * @property {number} totalCaches - Número total de caches gerenciados
 * @property {ConsolidatedMemoryStats} consolidate - Objeto com métricas detalhadas de memória
 */

/**
 * @typedef {Object.<string, CacheConfigOptions>} CacheProfiles
 * @description Um objeto que mapeia nomes de perfis de cache para suas respectivas configurações de `CacheConfigOptions`.
 */

// Exporta um objeto vazio apenas para satisfazer o sistema de módulos do Node.js
// e permitir que o JSDoc encontre e processe este arquivo.
module.exports = {};
