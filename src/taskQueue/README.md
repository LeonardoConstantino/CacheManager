# Optimized Task Queue System

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![MinHeap](https://img.shields.io/badge/Data%20Structure-MinHeap-blue.svg)](https://en.wikipedia.org/wiki/Heap_(data_structure))

Um sistema de gerenciamento de filas de tarefas de alta performance com padrões singleton e instâncias isoladas, usando MinHeap para execução eficiente, priorização, debounce e controle de concorrência.

## ✨ Recursos Principais

- **Dual Access Pattern**:
  - Singleton global para estado compartilhado
  - Instâncias isoladas para contextos independentes
- **Agendamento eficiente** com MinHeap (O(1) para próxima tarefa)
- **Sistema de priorização** (maior valor = maior prioridade)
- **Debounce integrado** para controle de frequência
- **Limite de concorrência** para execução paralela
- **Timer adaptativo** que ajusta automaticamente
- **Estatísticas detalhadas** de desempenho
- **Controle dinâmico** de tarefas em tempo real

## 📦 Instalação

```bash
npm install optimized-task-queue
```

Ou inclua diretamente em seu projeto:

```javascript
// Importe o gerenciador de filas
const { getGlobalTaskQueue, createNewTaskQueue } = require('optimized-task-queue');
```

## 🚀 Uso Básico

### Padrão Singleton (Estado Compartilhado)
```javascript
const { getGlobalTaskQueue } = require('optimized-task-queue');

// Obtém ou cria a instância singleton
const globalQueue = getGlobalTaskQueue({
  minTickInterval: 50,
  maxConcurrent: 4
});

// Adiciona tarefa à fila global
globalQueue.addTask('global-task', () => {
  console.log('Tarefa global executada');
}, 2000);
```

### Instância Isolada (Contexto Independente)
```javascript
const { createNewTaskQueue } = require('optimized-task-queue');

// Cria nova instância isolada
const isolatedQueue = createNewTaskQueue({
  minTickInterval: 20,
  maxConcurrent: 1
});

// Adiciona tarefa crítica à fila isolada
isolatedQueue.addTask('critical-task', async () => {
  await processCriticalOperation();
}, 5000, {
  priority: 100
});
```

## 📚 Documentação da API

### Gerenciador de Filas (`TaskQueueManager`)
```javascript
/**
 * @module TaskQueueManager
 * @description Gerencia instâncias de filas com padrão singleton e instâncias isoladas
 */
```

#### `getGlobalTaskQueue(options)`
- **Descrição**: Retorna instância singleton global
- **Parâmetros**:
  - `options` (Object): Configurações da fila:
    - `minTickInterval` (Number): Intervalo mínimo entre verificações (default: 100ms)
    - `maxConcurrent` (Number): Máximo de tarefas simultâneas (default: 1)
    - `logger` (Object): Objeto para logging (default: console)
- **Retorna**: `TaskQueue` - Instância singleton

#### `createNewTaskQueue(options)`
- **Descrição**: Cria nova instância isolada
- **Parâmetros**: Mesmo que `getGlobalTaskQueue`
- **Retorna**: `TaskQueue` - Nova instância independente

### Classe `TaskQueue`

## 🧩 Exemplos Avançados

### Sistema Híbrido com Múltiplas Filas
```javascript
const { getGlobalTaskQueue, createNewTaskQueue } = require('optimized-task-queue');

// Fila global para operações comuns
const globalQueue = getGlobalTaskQueue();

// Filas especializadas para domínios específicos
const paymentQueue = createNewTaskQueue({
  minTickInterval: 10,
  maxConcurrent: 2
});

const notificationQueue = createNewTaskQueue({
  minTickInterval: 30,
  maxConcurrent: 3
});

// Adiciona tarefas às filas especializadas
paymentQueue.addTask('process-payment', processPayment, 3000, {
  priority: 90,
  onError: handlePaymentError
});

notificationQueue.addTask('send-email', sendEmailNotification, 5000, {
  debounce: 1000
});

// Monitoramento centralizado
function monitorQueues() {
  console.log('🔄 Status das Filas:');
  console.log('Global:', globalQueue.getStatus().stats);
  console.log('Pagamentos:', paymentQueue.getStatus().stats);
  console.log('Notificações:', notificationQueue.getStatus().stats);
}

setInterval(monitorQueues, 10000);
```

### Controle de Vida Útil de Instâncias
```javascript
// Cria fila temporária para processamento em lote
const batchQueue = createNewTaskQueue();

// Adiciona 1000 tarefas de processamento
for (let i = 0; i < 1000; i++) {
  batchQueue.addTask(`item-${i}`, processItem, 100, {
    priority: Math.floor(Math.random() * 100)
  });
}

// Destrói a fila quando completar
batchQueue.addTask('cleanup', () => {
  console.log('Processamento em lote completo!');
  batchQueue.destroy(); // Libera recursos
}, null, { maxExecutions: 1 });
```

## 🏗️ Arquitetura do Sistema

```
├── TaskQueueManager
│   ├── Singleton Global (getGlobalTaskQueue)
│   └── Fábrica de Instâncias (createNewTaskQueue)
│
├── TaskQueue
│   ├── MinHeap (Ordenação eficiente)
│   ├── Mapa de Tarefas (Acesso O(1))
│   └── Sistema de Execução
│       ├── Timer Adaptativo
│       ├── Controle de Concorrência
│       └── Coletor de Estatísticas
│
└── ScheduledTask
    ├── Lógica de Agendamento
    ├── Sistema de Prioridades
    └── Mecanismo de Debounce
```

## ⚠️ Limitações Conhecidas

- Instâncias isoladas consomem recursos independentes
- O singleton global mantém estado entre chamadas de módulo
- Destruição explícita necessária para instâncias temporárias

## 🤝 Contribuição

```bash
1. Fork do repositório
2. Crie sua feature branch (git checkout -b feature/nova-feature)
3. Commit suas mudanças (git commit -am 'Adiciona nova funcionalidade')
4. Push para a branch (git push origin feature/nova-feature)
5. Abra um Pull Request
```

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.