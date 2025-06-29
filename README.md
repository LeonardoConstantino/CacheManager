# 🚀 Cache Manager

Uma biblioteca JavaScript avançada para gerenciamento de cache em memória e persistente, com suporte para TTL (Time To Live), LRU (Least Recently Used) e múltiplas estratégias de persistência.

## ✨ Características Principais

- **Cache em Memória**: Sistema de cache rápido e eficiente com TTL configurável
- **Persistência Flexível**: Suporte para localStorage (browser) e sistema de arquivos (Node.js)
- **Estratégia LRU**: Remoção automática dos itens menos utilizados quando o limite é atingido
- **Auto-Save**: Salvamento automático em intervalos configuráveis
- **Deep Clone**: Clonagem profunda de objetos para evitar mutações indesejadas
- **Logging Avançado**: Sistema de logs com níveis e formatação colorida
- **ReportLogger** Sistema de monitoramento humanizado integrado, mais detalhes na proxima seção
- **TypeScript Ready**: Definições de tipos incluídas
- **Multi-ambiente**: Funciona tanto no browser quanto no Node.js

## 📦 Instalação

Para instalar e rodar o projeto localmente, siga os passos abaixo:

1. Clone o repositório:

```bash
git clone https://github.com/LeonardoConstantino/CacheManager.git
```

2. Navegue até o diretório do projeto:

```bash
cd CacheManager
```

3. Rode a demonstração:

```bash
npm run demo
```

4. Rode os teste:

```bash
npm run test
```
## Tecnologias Utilizadas
- **JavaScript** para lógica.
- **Git** para controle de versão.
- **GitHub** para hospedagem e colaboração.
- **VS Code** para desenvolvimento.
<p>
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=js,git,github,vscode" />
  </a>
</p>
**Sem dependências externas**, apenas JavaScript puro.

## 🚀 Uso Rápido

### Criando um Cache Simples

```javascript
const { createNewCacheManager } = require('./CacheManager/index.js');

// Criar uma nova instância isolada do gerenciador
const cacheManager = createNewCacheManager();

// Criar cache com preset 'balanced' e TTL personalizado
const userCache = cacheManager.createCache('users', 'balanced', {
  defaultTTL: 300000, // 5 minutos em millisegundos
});

// Armazenar dados com TTL automático
userCache.set('user_123', {
  name: 'João',
  email: 'joao@email.com',
  role: 'admin',
});

// Recuperar dados (null se expirado)
const user = userCache.get('user_123');
console.log(user);
// Output: { name: 'João', email: 'joao@email.com', role: 'admin' }

// Verificar se existe antes de usar
if (userCache.has('user_123')) {
  console.log('Usuário encontrado no cache');
}
```

### Usando Singleton Global

```javascript
const { getGlobalCacheManager } = require('./CacheManager/index.js');

// Obter instância global compartilhada
const globalCache = getGlobalCacheManager();

// Criar cache de API com alta performance
const apiCache = globalCache.createCache(
  'api_responses',
  'performance-optimized',
  {
    defaultTTL: 600000, // 10 minutos
    maxSize: 10000, // Override do preset
  }
);

// Cache de configurações que persiste
const configCache = globalCache.createCache('app_config', 'persistent', {
  persistence: {
    storageKey: 'app_settings',
    autoSaveInterval: 30000, // Auto-save a cada 30s
  },
});

// Mesmo cache em qualquer lugar da aplicação
const sameCache = getGlobalCacheManager();
console.log(globalCache === sameCache); // true
```

### Cache Persistente com Auto-Save

```javascript
const { createNewCacheManager } = require('./CacheManager/index.js');

const cacheManager = createNewCacheManager();

// Cache de sessões com persistência automática
const sessionCache = cacheManager.createCache(
  'user_sessions',
  'persistent-performance',
  {
    defaultTTL: 3600000, // 1 hora
    persistence: {
      storageKey: 'active_sessions',
      autoSaveInterval: 15000, // Salva a cada 15s
    },
  }
);

// Dados são automaticamente persistidos
sessionCache.set('session_abc123', {
  userId: 456,
  role: 'user',
  loginTime: Date.now(),
  expires: Date.now() + 3600000,
});

// Força salvamento imediato (ignora debounce)
await sessionCache.save(true);

// Carrega dados salvos na inicialização
await sessionCache.load();
```

### Store Persistente Simples

```javascript
const {
  SimplePersistentStore,
} = require('./src/persistence/SimplePersistentStore.js');

// Store dedicado para configurações da aplicação
const appStore = new SimplePersistentStore('app_preferences');

// Configurações com TTL diferenciados
appStore.set('theme', 'dark', 86400000); // 24 horas
appStore.set('language', 'pt-BR', 604800000); // 7 dias
appStore.set('notifications', true); // Sem TTL (permanente)

// Recuperação com fallbacks
const theme = appStore.get('theme') || 'light';
const lang = appStore.get('language') || 'en-US';
const notifications = appStore.get('notifications') ?? false;

// Verificar se dados existem antes de usar
if (appStore.has('user_preferences')) {
  const prefs = appStore.get('user_preferences');
  console.log('Preferências carregadas:', prefs);
}

// Remover dados específicos
appStore.delete('theme');

// Limpar dados expirados manualmente
appStore.cleanup();
```

## 🔧 Configurações Avançadas

### Presets de Cache Otimizados

```javascript
const { createNewCacheManager } = require('./CacheManager/index.js');
const cacheManager = createNewCacheManager();

// Cache para aplicações móveis (economia de memória)
const mobileCache = cacheManager.createCache(
  'mobile_data',
  'memory-optimized',
  {
    maxSize: 50, // Limite baixo
    defaultTTL: 1800000, // 30 minutos
  }
);

// Cache para APIs de alta frequência
const apiCache = cacheManager.createCache(
  'api_cache',
  'performance-optimized',
  {
    maxSize: 50000, // Alto volume
    defaultTTL: 300000, // 5 minutos
    enableLRU: false, // Máxima performance
  }
);

// Cache balanceado para web apps
const webCache = cacheManager.createCache('web_data', 'balanced', {
  defaultTTL: 900000, // 15 minutos
  maxSize: 2000, // Capacidade média
});

// Cache persistente para dados críticos
const criticalCache = cacheManager.createCache('critical', 'persistent', {
  enableAutoCleanup: false, // So apaga com limpeza manual
  persistence: {
    storageKey: 'critical_app_data',
    autoSaveInterval: 5000, // Salva a cada 5s
  },
});
```

### Gerenciamento Avançado de TTL

```javascript
const cache = cacheManager.createCache('advanced_ttl', 'balanced');

// TTL específico por item
cache.set('short_lived', 'dados temporários', 60000); // 1 minuto
cache.set('medium_lived', 'dados normais', 1800000); // 30 minutos
cache.set('long_lived', 'dados duradouros', 86400000); // 24 horas

// Verificar TTL restante
const remainingTTL = cache.getTTL('medium_lived');
console.log(`Expira em: ${remainingTTL}ms`);

// Atualizar TTL de item existente
cache.updateTTL('short_lived', 300000); // Extende para 5 minutos
```

### Monitoramento e Estatísticas

```javascript
const cache = cacheManager.createCache('monitored', 'balanced');

// Adicionar alguns dados para demonstração
cache.set('item1', 'data1');
cache.set('item2', 'data2');
cache.set('item3', 'data3');

// Estatísticas básicas do cache
const stats = cache.getStats();
console.log('Estatísticas do Cache:', {
  name: stats.name, // Nome do cache
  size: stats.size, // Tamanho atual
  maxSize: stats.maxSize, // Tamanho máximo
  defaultTTL: stats.defaultTTL, // TTL padrão
  hitRate: stats.hitRate, // Taxa de acertos
  hits: stats.hits, // Hits
  misses: stats.misses, // Erros
  sets: stats.sets, // Set
  evictions: stats.evictions, // Remoções
  cleanups: stats.cleanups, // Limpezas
  objectsInCache: stats.objectsInCache, // Objetos no cache
  clonesInCache: stats.clonesInCache, // Clones no cache
});

// Estatísticas de memória
const memStats = cache.getMemoryStats();
console.log('Uso de Memória:', {
  totalSize: memStats.totalSize, // Tamanho total
  totalEntries: memStats.totalEntries, // Entradas totais
  objectEntries: memStats.objectEntries, // Entradas de objetos
  primitiveEntries: memStats.primitiveEntries, // Entradas primitivas
  estimatedSize: memStats.estimatedSize, // Tamanho estimado
  averageEntrySize: memStats.averageEntrySize, // Tamanho médio
});

// Informações gerais
console.log('Tamanho atual:', cache.size());
console.log('Chaves ativas:', cache.keys());
```

### Limpeza e Manutenção

```javascript
const cache = cacheManager.createCache('maintenance', 'balanced');

// Dados de exemplo
cache.set('temp1', 'data', 1000); // Expira em 1s
cache.set('temp2', 'data', 2000); // Expira em 2s
cache.set('perm1', 'data', 3000); // Expira em 3s

// Aguardar expiração
setTimeout(() => {
  console.log('Antes da limpeza:', cache.size()); // 3 itens

  // Limpeza manual de itens expirados
  const removedCount = cache.cleanup();
  console.log(`Removidos: ${removedCount} itens expirados`);
  console.log('Após limpeza:', cache.size()); // 1 item

  // Limpar tudo
  cache.clear();
  console.log('Após clear:', cache.size()); // 0 itens

  // Destruir cache e liberar recursos
  cache.destroy();
}, 3500);
```

### Exemplo Completo: Sistema de Cache Multi-Camada

```javascript
const { getGlobalCacheManager } = require('./src/core/index.js');

class ApplicationCache {
  constructor() {
    this.manager = getGlobalCacheManager();
    this.initializeCaches();
  }

  initializeCaches() {
    // Cache de sessão (temporário)
    this.sessionCache = this.manager.createCache(
      'sessions',
      'memory-optimized',
      {
        defaultTTL: 1800000, // 30 minutos
        maxSize: 1000,
      }
    );

    // Cache de dados de usuário (balanceado)
    this.userCache = this.manager.createCache('users', 'balanced', {
      defaultTTL: 3600000, // 1 hora
    });

    // Cache de configurações (persistente)
    this.configCache = this.manager.createCache('config', 'persistent', {
      defaultTTL: 86400000, // 24 horas
      persistence: {
        storageKey: 'app_configuration',
        autoSaveInterval: 60000, // 1 minuto
      },
    });
  }

  // Métodos de conveniência
  async cacheUserSession(sessionId, userData) {
    this.sessionCache.set(sessionId, userData);
    return userData;
  }

  getUserSession(sessionId) {
    return this.sessionCache.get(sessionId);
  }

  async cacheUserProfile(userId, profile) {
    this.userCache.set(`user_${userId}`, profile);
    return profile;
  }

  getUserProfile(userId) {
    return this.userCache.get(`user_${userId}`);
  }

  async setConfig(key, value, persistent = true) {
    if (persistent) {
      this.configCache.set(key, value);
      await this.configCache.save(true); // Força salvamento
    } else {
      this.sessionCache.set(`config_${key}`, value);
    }
  }

  getConfig(key, defaultValue = null) {
    return (
      this.configCache.get(key) ||
      this.sessionCache.get(`config_${key}`) ||
      defaultValue
    );
  }

  // Estatísticas consolidadas
  getSystemStats() {
    return {
      sessions: this.sessionCache.getStats(),
      users: this.userCache.getStats(),
      config: this.configCache.getStats(),
    };
  }

  // Limpeza geral
  cleanup() {
    const sessionCleaned = this.sessionCache.cleanup();
    const userCleaned = this.userCache.cleanup();
    const configCleaned = this.configCache.cleanup();

    return {
      sessionsRemoved: sessionCleaned,
      usersRemoved: userCleaned,
      configRemoved: configCleaned,
    };
  }
}

// Uso da classe
const appCache = new ApplicationCache();

// Exemplo de uso
appCache.cacheUserSession('sess_123', { userId: 456, role: 'admin' });
appCache.cacheUserProfile(456, { name: 'João', email: 'joao@email.com' });
appCache.setConfig('theme', 'dark', true);

console.log(appCache.getUserSession('sess_123'));
console.log(appCache.getUserProfile(456));
console.log(appCache.getConfig('theme'));
```

### Pré-configurações disponíveis

| Tipo de Cache                       | Descrição                                                 | Casos de Uso Ideais                                    |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `memory-optimized`                  | Prioriza economia de memória com otimizações inteligentes | Aplicações com recursos limitados, mobile apps         |
| `performance-optimized`             | Máximo desempenho com uso liberado de memória             | Aplicações críticas, servidores com RAM abundante      |
| `balanced`                          | Equilíbrio otimizado entre performance e uso de memória   | Aplicações web gerais, APIs de médio porte             |
| `persistent`                        | Cache persistente com foco em conservação de dados        | Dados críticos que não podem ser perdidos              |
| `persistent-performance`            | Cache persistente otimizado para alta performance         | Sistemas enterprise com dados críticos                 |
| `memory-optimized-with-persistence` | Economia de memória mantendo persistência                 | Aplicações móveis que precisam salvar estado           |
| `minimal-critical-persistence`      | Configuração mínima para dados críticos                   | Sistemas embarcados, IoT, aplicações de baixo overhead |

#### 📊 Comparativo de Performance

| Configuração                        | Uso de Memória | Velocidade | Persistência | Ideal Para                               |
| ----------------------------------- | -------------- | ---------- | ------------ | ---------------------------------------- |
| `memory-optimized`                  | 🟢 Baixo       | 🟡 Médio   | ❌ Não       | Apps móveis, recursos limitados          |
| `performance-optimized`             | 🔴 Alto        | 🟢 Máximo  | ❌ Não       | Servidores, aplicações críticas          |
| `balanced`                          | 🟡 Médio       | 🟡 Médio   | ❌ Não       | Web apps gerais, APIs                    |
| `persistent`                        | 🟢 Baixo       | 🟡 Médio   | ✅ Sim       | Dados importantes, baixo volume          |
| `persistent-performance`            | 🔴 Alto        | 🟢 Alto    | ✅ Sim       | Enterprise, dados críticos + performance |
| `memory-optimized-with-persistence` | 🟢 Baixo       | 🟡 Médio   | ✅ Sim       | Mobile com estado persistente            |
| `minimal-critical-persistence`      | 🟢 Baixo       | 🟢 Alto    | ✅ Manual    | IoT, sistemas embarcados                 |

### Configuração Personalizada

```javascript
const customCache = cacheManager.createCache('custom', {
  defaultTTL: 3600, // TTL padrão de 1 hora
  enableLRU: true, // Ativar LRU (Least Recently Used)
  enableAutoCleanup: true, // Ativar limpeza automática
  enableWeakOptimization: true, // Ativar otimização com WeakMap()
  maxSize: 100, // Tamanho máximo do cache
  cleanupFrequency: 10000, // Intervalo de limpeza automática (em milissegundos)
  freezeOption: freezeOptions.DEEP, // Opção de congelamento (deep | shallow | none)
  persistence: { // Configurações de persistência
    enabled: true, // Ativar persistência
    storageKey: 'cache_data', // Chave de armazenamento
    autoSaveInterval: 10000, // Intervalo de salvamento automático
  },
});
```

## 📊 Estatísticas e Monitoramento

```javascript
// Estatísticas de um cache específico
const stats = userCache.getStats();
console.log(stats);
/*
{
  name: string;
  size: number;
  maxSize: number;
  defaultTTL: number;
  hitRate: string;
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  cleanups: number;
  objectsInCache: number;
  clonesInCache: number;
}
*/

// Uso de memória de um cache específico
const memoryUsage = userCache.getMemoryStats();
console.log(memoryUsage);
/*
{
  totalSize: number;
  totalEntries: number;
  objectEntries: number;
  primitiveEntries: number;
  estimatedSize: string;
  averageEntrySize: number;
}
*/

// Estatísticas globais
const globalStats = cacheManager.getGlobalStats();
console.log(globalStats);
/*
{
  totalCaches: number;
  caches: {
    [cacheName: string]: {
      name: string;
      size: number;
      maxSize: number;
      defaultTTL: number;
      hitRate: string;
      hits: number;
      misses: number;
      sets: number;
      evictions: number;
      cleanups: number;
      objectsInCache: number;
      clonesInCache: number;
    }
  }
}
*/

// Uso de memória consolidado de todos os caches
const globalMemoryUsage = cacheManager.getConsolidateMemoryStats();
console.log(globalMemoryUsage);
/*
{
  totalCaches: number;
  consolidate: {
    totalSize: number;
    totalEntries: number;
    objectEntries: number;
    primitiveEntries: number;
    averageEntrySize: number;
    estimatedSize: string;
  }
}
*/
```

## 📊 ReportLogger

O **ReportLogger** é um sistema de monitoramento humanizado integrado ao CacheManager que gera relatórios automáticos sobre estatísticas do sistema, incluindo cache, memória e filas de tarefas.

### ✨ Funcionalidades

- **Integração Transparente**: Iniciado automaticamente junto com o CacheManager
- **Monitoramento Automático**: Gera relatórios periódicos com estatísticas detalhadas
- **Interface Humanizada**: Apresenta dados de forma clara com emojis e formatação visual
- **Múltiplas Métricas**: Monitora cache, uso de memória e status de filas
- **Configuração Flexível**: Permite personalizar intervalos, módulos monitorados e aparência
- **Gestão de Recursos**: Controle completo do ciclo de vida com métodos `stop()` e `destroy()`

### 🚀 Uso Integrado (Recomendado)

```javascript
const { getGlobalCacheManager, createNewCacheManager, TIME_INTERVALS } = require('./CacheManager');

// CacheManager global com relatórios automáticos
const cacheManager = getGlobalCacheManager({
  report: true,                           // Habilita relatórios
  interval: TIME_INTERVALS.THIRTY_MINUTES, // A cada 30 minutos
  enableCache: true,                      // Monitorar cache
  enableMemory: true,                     // Monitorar memória
  enableQueue: true,                      // Monitorar filas
  useColors: true,                        // Usar cores na saída
  loggerModule: 'MY_APP_CACHE'           // Nome personalizado
});

// Instância isolada com monitoramento
const isolatedCache = createNewCacheManager({
  report: true,
  interval: TIME_INTERVALS.FIFTEEN_MINUTES,
  saveLogs: true                          // Salvar logs em arquivo
});

// Uso normal - relatórios são automáticos
const userCache = cacheManager.createCache('users', 300000);
userCache.set('user:123', userData);
```

```javascript
// Constantes de tempo disponíveis
const { TIME_INTERVALS } = require('./CacheManager');
// TIME_INTERVALS.ONE_HOUR = 3600000
// TIME_INTERVALS.THIRTY_MINUTES = 1800000
// TIME_INTERVALS.FIFTEEN_MINUTES = 900000

// Configuração personalizada
const cacheManager = getGlobalCacheManager({
  report: true,
  interval: TIME_INTERVALS.FIFTEEN_MINUTES,
  enableMemory: false,              // Desabilitar relatório de memória
  loggerModule: 'MY_CUSTOM_CACHE',  // Nome personalizado
  saveLogs: true                    // Salvar em arquivo
});
```

### 🎯 Integração Automática

O ReportLogger é automaticamente gerenciado pelo CacheManager:

- **Global**: Um reporter é criado com prefixo `GLOBAL_` para a instância singleton
- **Isolado**: Cada instância isolada recebe um reporter com prefixo `ISOLATED_`
- **Lifecycle**: O reporter é destruído automaticamente quando o CacheManager é destruído
- **TaskQueue**: Utiliza a fila global de tarefas para agendamento eficiente


```javascript
// Desabilitar relatórios (não cria reporter)
const silentCache = getGlobalCacheManager({ report: false });
```

## 🛠️ API Completa

### CacheManager

| Método                                             | Descrição                                   | retorno                  |
| -------------------------------------------------- | ------------------------------------------- | ------------------------ |
| `createCache(name, options \| Preset, overrides?)` | Cria um novo cache                          | `Cache`                  |
| `removeCache(name)`                                | Remove um cache                             | `void`                   |
| `getCache(name)`                                   | Retorna um cache                            | `Cache \| null`          |
| `listCaches()`                                     | Lista todos os caches                       | `string[]`               |
| `getStats()`                                       | Retorna estatísticas globais                | `CacheStats`             |
| `cleanupAll()`                                     | Limpa todos os caches                       | `void`                   |
| `setCleanupFrequency()`                            | Define a frequência de limpeza              | `void`                   |
| `startAutoCleanup()`                               | Inicia a limpeza automática                 | `void`                   |
| `stopAutoCleanup()`                                | Para a limpeza automática                   | `void`                   |
| `getConsolidateMemoryStats()`                      | Retorna estatísticas de memória consolidada | `ConsolidateMemoryStats` |
| `destroy()`                                        | Destrói o gerenciador de cache              | `void`                   |

### MyCache

| Método                  | Descrição                         | Retorno            |
| ----------------------- | --------------------------------- | ------------------ |
| `set(key, value, ttl?)` | Armazena um item no cache         | `void`             |
| `get(key)`              | Recupera um item do cache         | `any \| undefined` |
| `has(key)`              | Verifica se uma chave existe      | `boolean`          |
| `delete(key)`           | Remove um item do cache           | `boolean`          |
| `cleanup()`             | Remove itens expirados            | `number`           |
| `clear()`               | Limpa todo o cache                | `void`             |
| `size()`                | Retorna o tamanho atual do cache  | `number`           |
| `keys()`                | Retorna todas as chaves válidas   | `string[]`         |
| `getTTL(key)`           | Retorna o TTL restante de um item | `number \| null`   |
| `updateTTL(key, ttl)`   | Atualiza o TTL de um item         | `boolean`          |
| `getStats()`            | Retorna estatísticas do cache     | `CacheStats`       |
| `getMemoryStats()`      | Retorna estatísticas de memória   | `MemoryStats`      |
| `destroy()`             | Destrói o cache e libera recursos | `void`             |

### PersistentCache

> **Herda todos os métodos de `MyCache`** + métodos específicos:

| Método                  | Descrição                                                                     | Retorno            |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------ |
| `save(ignoreDebounce?)` | Salva o cache manualmente. Se `ignoreDebounce` for `true`, força o salvamento | `Promise<void>`    |
| `load()`                | Carrega dados previamente salvos                                              | `Promise<void>`    |
| `clearPersistence()`    | Remove dados persistidos do storage                                           | `Promise<void>`    |
| `hasPersistentData()`   | Verifica se existem dados salvos                                              | `Promise<boolean>` |

## 🎯 Casos de Uso

### 1. Cache de API

```javascript
const apiCache = cacheManager.createCache(
  'api_responses',
  'persistent-performance'
);

async function fetchUserData(userId) {
  const cacheKey = `user_${userId}`;

  // Tentar buscar no cache primeiro
  let userData = apiCache.get(cacheKey);

  if (!userData) {
    // Se não estiver no cache, buscar da API
    userData = await fetch(`/api/users/${userId}`).then((r) => r.json());

    // Armazenar no cache por 10 minutos
    apiCache.set(cacheKey, userData, 600000);
  }

  return userData;
}
```

### 2. Gerenciamento de Sessões

```javascript
const sessionCache = cacheManager.createCache('user_sessions', 'persistent');

function createSession(userId) {
  const sessionId = Math.random().toString(36);
  const sessionData = {
    userId,
    createdAt: Date.now(),
    lastAccess: Date.now(),
  };

  // Sessão expira em 2 horas
  sessionCache.set(sessionId, sessionData, 7200000);
  return sessionId;
}

function validateSession(sessionId) {
  const session = sessionCache.get(sessionId);
  if (session) {
    // Atualizar último acesso
    session.lastAccess = Date.now();
    sessionCache.set(sessionId, session, 7200000);
    return session;
  }
  return null;
}
```

### 3. Configurações da Aplicação

```javascript
const configStore = new SimplePersistentStore('app_config');

// Configurações que não expiram
configStore.set('app_version', '1.2.3');
configStore.set('api_endpoint', 'https://api.example.com');

// Configurações temporárias
configStore.set('maintenance_mode', true, 3600000); // 1 hora
```

## 🔍 Sistema de Logging

```javascript
import { log, LogLevel, setLogLevel, logTimer } from './logger.js';

// Configurar nível de log
setLogLevel(LogLevel.DEBUG);

// Logs básicos
log(LogLevel.INFO, 'Cache inicializado com sucesso');
log(LogLevel.ERROR, 'Erro ao conectar com storage', error);

// Medir performance de funções
const result = await logTimer(
  () => cache.cleanup(),
  'Cache Cleanup',
  LogLevel.INFO
);
```

## ⚙️ Utilitários

```javascript
import { timeToMilliseconds, randomString, clamp } from './utils.js';

// Converter tempo para milissegundos
const ttl = timeToMilliseconds('1:30:00'); // 1 hora e 30 minutos

// Gerar string aleatória
const cacheKey = randomString(); // "1703123456789_abc123def"

// Limitar valores
const size = clamp(userInput, 1, 10000, 100); // Entre 1 e 10000, padrão 100
```

## 🏗️ Arquitetura

<details>
<summary><h3>Visão Geral do Sistema</h3></summary>

```
                    ┌─────────────────────────┐
                    │     CacheManager        │
                    │ ┌─────────────────────┐ │
                    │ │  Multi-Cache Pool   │ │
                    │ │  Global Settings    │ │
                    │ │  Instance Manager   │ │
                    │ └─────────────────────┘ │
                    └────────┬────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐    ┌────────▼────────┐    ┌─────▼─────────┐
│   MyCache    │    │ PersistentCache │    │ Custom Cache  │
│              │    │                 │    │   Types       │
│ • TTL/LRU    │◄───┤ • Auto-save     │    │               │
│ • Deep clone │    │ • Load/Save     │    │ • Extensible  │
│ • Stats      │    │ • Storage API   │    │ • Pluggable   │
└──────────────┘    └─────────────────┘    └───────────────┘
        │                    │
        └──────┬─────────────┘
               │
    ┌──────────▼───────────┐
    │    Core Engine       │
    └──────────┬───────────┘
               │
    ┌──────────▼───────────┐
    │   Storage Layer      │
    │ ┌─────────────────┐  │
    │ │   TTL Heap      │  │
    │ │ ┌─────────────┐ │  │
    │ │ │ MinHeap     │ │  │
    │ │ │ Priority Q  │ │  │
    │ │ └─────────────┘ │  │
    │ └─────────────────┘  │
    │ ┌─────────────────┐  │
    │ │   LRU Policy    │  │
    │ │ ┌─────────────┐ │  │
    │ │ │ DoublyLinked│ │  │
    │ │ │ List        │ │  │
    │ │ └─────────────┘ │  │
    │ └─────────────────┘  │
    └──────────────────────┘
```

### Fluxo de Dados

<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" type="text/css"?>

<svg aria-roledescription="flowchart-v2" role="graphics-document document" viewBox="0 0 835.3125 908.75" style="max-width: 100%; max-height: 100%; background: transparent;" class="flowchart" xmlns="http://www.w3.org/2000/svg" width="100%" id="mermaid-image-editor"><style>#mermaid-image-editor{font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:16px;fill:#333;}#mermaid-image-editor .error-icon{fill:#552222;}#mermaid-image-editor .error-text{fill:#552222;stroke:#552222;}#mermaid-image-editor .edge-thickness-normal{stroke-width:1px;}#mermaid-image-editor .edge-thickness-thick{stroke-width:3.5px;}#mermaid-image-editor .edge-pattern-solid{stroke-dasharray:0;}#mermaid-image-editor .edge-thickness-invisible{stroke-width:0;fill:none;}#mermaid-image-editor .edge-pattern-dashed{stroke-dasharray:3;}#mermaid-image-editor .edge-pattern-dotted{stroke-dasharray:2;}#mermaid-image-editor .marker{fill:#333333;stroke:#333333;}#mermaid-image-editor .marker.cross{stroke:#333333;}#mermaid-image-editor svg{font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:16px;}#mermaid-image-editor p{margin:0;}#mermaid-image-editor .label{font-family:"trebuchet ms",verdana,arial,sans-serif;color:#333;}#mermaid-image-editor .cluster-label text{fill:#333;}#mermaid-image-editor .cluster-label span{color:#333;}#mermaid-image-editor .cluster-label span p{background-color:transparent;}#mermaid-image-editor .label text,#mermaid-image-editor span{fill:#333;color:#333;}#mermaid-image-editor .node rect,#mermaid-image-editor .node circle,#mermaid-image-editor .node ellipse,#mermaid-image-editor .node polygon,#mermaid-image-editor .node path{fill:#ECECFF;stroke:#9370DB;stroke-width:1px;}#mermaid-image-editor .rough-node .label text,#mermaid-image-editor .node .label text,#mermaid-image-editor .image-shape .label,#mermaid-image-editor .icon-shape .label{text-anchor:middle;}#mermaid-image-editor .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#mermaid-image-editor .rough-node .label,#mermaid-image-editor .node .label,#mermaid-image-editor .image-shape .label,#mermaid-image-editor .icon-shape .label{text-align:center;}#mermaid-image-editor .node.clickable{cursor:pointer;}#mermaid-image-editor .root .anchor path{fill:#333333!important;stroke-width:0;stroke:#333333;}#mermaid-image-editor .arrowheadPath{fill:#333333;}#mermaid-image-editor .edgePath .path{stroke:#333333;stroke-width:2.0px;}#mermaid-image-editor .flowchart-link{stroke:#333333;fill:none;}#mermaid-image-editor .edgeLabel{background-color:rgba(232,232,232, 0.8);text-align:center;}#mermaid-image-editor .edgeLabel p{background-color:rgba(232,232,232, 0.8);}#mermaid-image-editor .edgeLabel rect{opacity:0.5;background-color:rgba(232,232,232, 0.8);fill:rgba(232,232,232, 0.8);}#mermaid-image-editor .labelBkg{background-color:rgba(232, 232, 232, 0.5);}#mermaid-image-editor .cluster rect{fill:#ffffde;stroke:#aaaa33;stroke-width:1px;}#mermaid-image-editor .cluster text{fill:#333;}#mermaid-image-editor .cluster span{color:#333;}#mermaid-image-editor div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:12px;background:hsl(80, 100%, 96.2745098039%);border:1px solid #aaaa33;border-radius:2px;pointer-events:none;z-index:100;}#mermaid-image-editor .flowchartTitleText{text-anchor:middle;font-size:18px;fill:#333;}#mermaid-image-editor rect.text{fill:none;stroke-width:0;}#mermaid-image-editor .icon-shape,#mermaid-image-editor .image-shape{background-color:rgba(232,232,232, 0.8);text-align:center;}#mermaid-image-editor .icon-shape p,#mermaid-image-editor .image-shape p{background-color:rgba(232,232,232, 0.8);padding:2px;}#mermaid-image-editor .icon-shape rect,#mermaid-image-editor .image-shape rect{opacity:0.5;background-color:rgba(232,232,232, 0.8);fill:rgba(232,232,232, 0.8);}#mermaid-image-editor :root{--mermaid-font-family:"trebuchet ms",verdana,arial,sans-serif;}</style><g><marker orient="auto" markerHeight="8" markerWidth="8" markerUnits="userSpaceOnUse" refY="5" refX="5" viewBox="0 0 10 10" class="marker flowchart-v2" id="mermaid-image-editor_flowchart-v2-pointEnd"><path style="stroke-width: 1; stroke-dasharray: 1, 0;" class="arrowMarkerPath" d="M 0 0 L 10 5 L 0 10 z"></path></marker><marker orient="auto" markerHeight="8" markerWidth="8" markerUnits="userSpaceOnUse" refY="5" refX="4.5" viewBox="0 0 10 10" class="marker flowchart-v2" id="mermaid-image-editor_flowchart-v2-pointStart"><path style="stroke-width: 1; stroke-dasharray: 1, 0;" class="arrowMarkerPath" d="M 0 5 L 10 10 L 10 0 z"></path></marker><marker orient="auto" markerHeight="11" markerWidth="11" markerUnits="userSpaceOnUse" refY="5" refX="11" viewBox="0 0 10 10" class="marker flowchart-v2" id="mermaid-image-editor_flowchart-v2-circleEnd"><circle style="stroke-width: 1; stroke-dasharray: 1, 0;" class="arrowMarkerPath" r="5" cy="5" cx="5"></circle></marker><marker orient="auto" markerHeight="11" markerWidth="11" markerUnits="userSpaceOnUse" refY="5" refX="-1" viewBox="0 0 10 10" class="marker flowchart-v2" id="mermaid-image-editor_flowchart-v2-circleStart"><circle style="stroke-width: 1; stroke-dasharray: 1, 0;" class="arrowMarkerPath" r="5" cy="5" cx="5"></circle></marker><marker orient="auto" markerHeight="11" markerWidth="11" markerUnits="userSpaceOnUse" refY="5.2" refX="12" viewBox="0 0 11 11" class="marker cross flowchart-v2" id="mermaid-image-editor_flowchart-v2-crossEnd"><path style="stroke-width: 2; stroke-dasharray: 1, 0;" class="arrowMarkerPath" d="M 1,1 l 9,9 M 10,1 l -9,9"></path></marker><marker orient="auto" markerHeight="11" markerWidth="11" markerUnits="userSpaceOnUse" refY="5.2" refX="-1" viewBox="0 0 11 11" class="marker cross flowchart-v2" id="mermaid-image-editor_flowchart-v2-crossStart"><path style="stroke-width: 2; stroke-dasharray: 1, 0;" class="arrowMarkerPath" d="M 1,1 l 9,9 M 10,1 l -9,9"></path></marker><g class="root"><g class="clusters"></g><g class="edgePaths"><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_A_B_0" d="M524.609,62L524.609,66.167C524.609,70.333,524.609,78.667,524.609,86.333C524.609,94,524.609,101,524.609,104.5L524.609,108"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_B_C_1" d="M524.609,166L524.609,170.167C524.609,174.333,524.609,182.667,524.68,190.417C524.75,198.167,524.89,205.334,524.961,208.917L525.031,212.501"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_C_D_2" d="M477.812,309.952L448.933,323.918C420.054,337.885,362.297,365.817,333.418,390.45C304.539,415.083,304.539,436.417,304.539,455.75C304.539,475.083,304.539,492.417,305.214,504.595C305.89,516.774,307.241,523.798,307.916,527.31L308.591,530.822"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_C_E_3" d="M570.906,311.453L596.535,325.17C622.164,338.886,673.422,366.318,699.051,385.534C724.68,404.75,724.68,415.75,724.68,421.25L724.68,426.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_D_F_4" d="M253.234,576.529L227.501,582.732C201.768,588.936,150.302,601.343,124.569,611.046C98.836,620.75,98.836,627.75,98.836,631.25L98.836,634.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_D_G_5" d="M314.539,588.75L314.539,592.917C314.539,597.083,314.539,605.417,314.539,613.083C314.539,620.75,314.539,627.75,314.539,631.25L314.539,634.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_D_H_6" d="M375.844,576.765L401.012,582.929C426.18,589.093,476.516,601.422,501.684,611.086C526.852,620.75,526.852,627.75,526.852,631.25L526.852,634.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_E_I_7" d="M729.872,484.75L730.673,488.917C731.475,493.083,733.077,501.417,733.878,509.083C734.68,516.75,734.68,523.75,734.68,527.25L734.68,530.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_E_D_8" d="M670.724,484.75L662.398,488.917C654.071,493.083,637.419,501.417,588.929,512.403C540.44,523.39,460.113,537.03,419.95,543.85L379.787,550.67"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_F_J_9" d="M98.836,692.75L98.836,696.917C98.836,701.083,98.836,709.417,98.836,717.083C98.836,724.75,98.836,731.75,98.836,735.25L98.836,738.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_G_K_10" d="M314.539,692.75L314.539,696.917C314.539,701.083,314.539,709.417,314.539,717.083C314.539,724.75,314.539,731.75,314.539,735.25L314.539,738.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_I_L_11" d="M734.68,588.75L734.68,592.917C734.68,597.083,734.68,605.417,734.68,613.083C734.68,620.75,734.68,627.75,734.68,631.25L734.68,634.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_J_M_12" d="M98.836,796.75L98.836,800.917C98.836,805.083,98.836,813.417,98.836,821.083C98.836,828.75,98.836,835.75,98.836,839.25L98.836,842.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_K_N_13" d="M314.539,796.75L314.539,800.917C314.539,805.083,314.539,813.417,314.539,821.083C314.539,828.75,314.539,835.75,314.539,839.25L314.539,842.75"></path><path marker-end="url(#mermaid-image-editor_flowchart-v2-pointEnd)" style="" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" id="L_L_O_14" d="M734.68,692.75L734.68,696.917C734.68,701.083,734.68,709.417,734.68,717.083C734.68,724.75,734.68,731.75,734.68,735.25L734.68,738.75"></path></g><g class="edgeLabels"><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g transform="translate(304.5390625, 457.75)" class="edgeLabel"><g transform="translate(-46.5078125, -12)" class="label"><foreignObject height="24" width="93.015625"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>Memory Only</p></span></div></foreignObject></g></g><g transform="translate(724.6796875, 393.75)" class="edgeLabel"><g transform="translate(-59.4921875, -12)" class="label"><foreignObject height="24" width="118.984375"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>With Persistence</p></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div class="labelBkg" xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g></g><g class="nodes"><g transform="translate(524.609375, 35)" id="flowchart-A-207" class="node default"><rect height="54" width="141.109375" y="-27" x="-70.5546875" style="" class="basic label-container"></rect><g transform="translate(-40.5546875, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="81.109375"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Application</p></span></div></foreignObject></g></g><g transform="translate(524.609375, 139)" id="flowchart-B-208" class="node default"><rect height="54" width="163.25" y="-27" x="-81.625" style="" class="basic label-container"></rect><g transform="translate(-51.625, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="103.25"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>CacheManager</p></span></div></foreignObject></g></g><g transform="translate(524.609375, 286.375)" id="flowchart-C-210" class="node default"><polygon transform="translate(-70.375,70.375)" class="label-container" points="70.375,0 140.75,-70.375 70.375,-140.75 0,-70.375"></polygon><g transform="translate(-43.375, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="86.75"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Cache Type?</p></span></div></foreignObject></g></g><g transform="translate(314.5390625, 561.75)" id="flowchart-D-212" class="node default"><rect height="54" width="122.609375" y="-27" x="-61.3046875" style="" class="basic label-container"></rect><g transform="translate(-31.3046875, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="62.609375"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>MyCache</p></span></div></foreignObject></g></g><g transform="translate(724.6796875, 457.75)" id="flowchart-E-214" class="node default"><rect height="54" width="174.15625" y="-27" x="-87.078125" style="" class="basic label-container"></rect><g transform="translate(-57.078125, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="114.15625"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>PersistentCache</p></span></div></foreignObject></g></g><g transform="translate(98.8359375, 665.75)" id="flowchart-F-216" class="node default"><rect height="54" width="181.671875" y="-27" x="-90.8359375" style="" class="basic label-container"></rect><g transform="translate(-60.8359375, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="121.671875"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>TTL Management</p></span></div></foreignObject></g></g><g transform="translate(314.5390625, 665.75)" id="flowchart-G-218" class="node default"><rect height="54" width="149.734375" y="-27" x="-74.8671875" style="" class="basic label-container"></rect><g transform="translate(-44.8671875, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="89.734375"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>LRU Eviction</p></span></div></foreignObject></g></g><g transform="translate(526.8515625, 665.75)" id="flowchart-H-220" class="node default"><rect height="54" width="174.890625" y="-27" x="-87.4453125" style="" class="basic label-container"></rect><g transform="translate(-57.4453125, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="114.890625"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Memory Storage</p></span></div></foreignObject></g></g><g transform="translate(734.6796875, 561.75)" id="flowchart-I-222" class="node default"><rect height="54" width="185.265625" y="-27" x="-92.6328125" style="" class="basic label-container"></rect><g transform="translate(-62.6328125, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="125.265625"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Persistence Layer</p></span></div></foreignObject></g></g><g transform="translate(98.8359375, 769.75)" id="flowchart-J-226" class="node default"><rect height="54" width="127.421875" y="-27" x="-63.7109375" style="" class="basic label-container"></rect><g transform="translate(-33.7109375, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="67.421875"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>TTL Heap</p></span></div></foreignObject></g></g><g transform="translate(314.5390625, 769.75)" id="flowchart-K-228" class="node default"><rect height="54" width="190.90625" y="-27" x="-95.453125" style="" class="basic label-container"></rect><g transform="translate(-65.453125, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="130.90625"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Doubly Linked List</p></span></div></foreignObject></g></g><g transform="translate(734.6796875, 665.75)" id="flowchart-L-230" class="node default"><rect height="54" width="140.765625" y="-27" x="-70.3828125" style="" class="basic label-container"></rect><g transform="translate(-40.3828125, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="80.765625"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Storage API</p></span></div></foreignObject></g></g><g transform="translate(98.8359375, 873.75)" id="flowchart-M-232" class="node default"><rect height="54" width="155.75" y="-27" x="-77.875" style="" class="basic label-container"></rect><g transform="translate(-47.875, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="95.75"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Auto Cleanup</p></span></div></foreignObject></g></g><g transform="translate(314.5390625, 873.75)" id="flowchart-N-234" class="node default"><rect height="54" width="155.0625" y="-27" x="-77.53125" style="" class="basic label-container"></rect><g transform="translate(-47.53125, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="95.0625"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Auto Eviction</p></span></div></foreignObject></g></g><g transform="translate(734.6796875, 769.75)" id="flowchart-O-236" class="node default"><rect height="54" width="173" y="-27" x="-86.5" style="" class="basic label-container"></rect><g transform="translate(-56.5, -12)" style="" class="label"><rect></rect><foreignObject height="24" width="113"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Auto Save/Load</p></span></div></foreignObject></g></g></g></g></g></svg>

### Módulos e Responsabilidades

#### 🎯 **Core (Núcleo)**

| Módulo                  | Responsabilidade                      | Dependências       |
| ----------------------- | ------------------------------------- | ------------------ |
| `Cache.js`              | Implementação base do cache, TTL, LRU | TTLHeap, LRUPolicy |
| `CacheManager.js`       | Gerenciamento de múltiplas instâncias | Cache, Utils       |
| `CacheConfiguration.js` | Presets e configurações padrão        | Types              |

#### 🔄 **Eviction (Despejo)**

| Módulo         | Responsabilidade             | Algoritmo               |
| -------------- | ---------------------------- | ----------------------- |
| `LRUPolicy.js` | Política Least Recently Used | Doubly Linked List O(1) |

#### ⏰ **Expiration (Expiração)**

| Módulo       | Responsabilidade                | Estrutura        |
| ------------ | ------------------------------- | ---------------- |
| `TTLHeap.js` | Gerenciamento de TTL automático | MinHeap O(log n) |

#### 💾 **Persistence (Persistência)**

| Módulo                     | Responsabilidade                  | Storage Type                                                              |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `PersistentCache.js`       | Cache com persistência automática | No NodeJS, salva em um arquivo JSON. No navegador, salva no localStorage. |
| `SimplePersistentStore.js` | Abstração de storage              | Storage API                                                               |
| `MinimalPersistence.js`    | Persistência básica               | Key-Value                                                                 |

#### 📋 **Task Queue (Fila de Tarefas)**

| Módulo             | Responsabilidade            | Pattern           |
| ------------------ | --------------------------- | ----------------- |
| `TaskQueue.js`     | Fila de tarefas assíncronas | Producer-Consumer |
| `ScheduledTask.js` | Tarefas agendadas           | Cron-like         |

#### 🛠️ **Utils (Utilitários)**

| Módulo        | Responsabilidade        | Função                 |
| ------------- | ----------------------- | ---------------------- |
| `debounce.js` | Controle de frequência  | Rate Limiting          |
| `Timers.js`   | Gerenciamento de timers | Cleanup Automation     |
| `utils.js`    | Funções auxiliares      | Deep Clone, Validation |

### Características Técnicas

#### ⚡ **Performance**

- **Acesso**: O(1) para get/set básicos
- **TTL**: O(log n) para gerenciamento de expiração
- **LRU**: O(1) para atualização de uso
- **Cleanup**: O(k) onde k = itens expirados

#### 🧠 **Memory Management**

- **Deep Cloning**: Previne vazamentos de referência
- **Weak References**: Otimização automática de memória
- **Auto Cleanup**: Remoção proativa de itens expirados
- **Size Limits**: Controle de crescimento ilimitado

#### 🔒 **Data Integrity**

- **Immutability**: Objetos congelados opcionalmente
- **Validation**: Verificação de tipos e limites
- **Atomic Operations**: Operações transacionais
- **Error Recovery**: Fallbacks para falhas de storage

</details>

### Estrutura de Arquivos

```
📦 CacheManager/
├── 📂 src/
│   ├── 📂 core/               # Classes principais
│   │   ├── Cache.js           # Implementação base
│   │   ├── CacheManager.js    # Gerenciador principal
│   │   └── CacheConfiguration.js # Presets e configs
│   │
│   ├── 📂 eviction/           # Políticas de despejo
│   │   └── LRUPolicy.js       # Least Recently Used
│   │
│   ├── 📂 expiration/         # Gerenciamento de TTL
│   │   └── TTLHeap.js         # Heap para expiração
│   │
│   ├── 📂 persistence/        # Camada de persistência
│   │   ├── PersistentCache.js      # Cache persistente
│   │   ├── SimplePersistentStore.js # Storage abstrato
│   │   └── MinimalPersistence.js   # Persistência básica
│   │
│   ├── 📂 taskQueue/          # Sistema de tarefas
│   │   ├── TaskQueue.js       # Fila principal
│   │   └── ScheduledTask.js   # Tarefas agendadas
│   │
│   ├── 📂 types/              # Definições de tipos
│   │   ├── cache.types.js     # Tipos do cache
│   │   ├── log.types.js       # Tipos de logging
│   │   └── taskQueue.types.js # Tipos da fila
│   │
│   └── 📂 utils/              # Utilitários
│       ├── debounce.js        # Rate limiting
│       ├── Timers.js          # Gerenciamento de timers
│       └── utils.js           # Funções auxiliares
│
├── 📂 tests/                  # Testes automatizados
├── 📂 examples/               # Exemplos de uso
├── 📜 index.js                # Entry point
└── 📜 README.md               # Documentação
```

## 🤝 Contribuição

1. Fork este repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está licenciado under a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🚧 Roadmap

- [ ] Suporte para Redis como backend
- [ ] Compressão automática de dados grandes
- [ ] Métricas avançadas e dashboard
- [ ] Suporte para cache distribuído
- [ ] Plugin system para extensibilidade

## ❓ FAQ

**P: O cache funciona em ambientes sem localStorage?**
R: Sim, o sistema detecta automaticamente o ambiente e usa a estratégia de persistência adequada.

**P: Como posso migrar dados entre versões?**
R: O sistema mantém compatibilidade com versões anteriores através de versionamento interno dos dados salvos.

**P: Qual é o overhead de performance?**
R: O sistema é otimizado para alta performance, com operações O(1) para get/set e O(log n) para limpeza de TTL.

---

<p align="center">Desenvolvido com ❤️ para a comunidade JavaScript.</p>
