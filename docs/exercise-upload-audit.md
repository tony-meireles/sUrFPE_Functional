# Auditoria do Upload de Exercícios por Planilha

## Estado atual

- A base inicial de exercícios é carregada de `data/exercises.js`.
- As alterações posteriores vivem apenas em `localStorage` no navegador.
- O upload de planilha lê somente a primeira aba do arquivo.
- A importação atual só insere registros novos e ignora colisões por `id` ou `movimento + implemento`.
- A edição manual na UI não preserva todos os campos existentes no modelo importado.

## Problemas críticos encontrados

### 1. Persistência fraca

O repositório real de exercícios não está em banco. Isso produz perda de dados em qualquer cenário de:

- limpeza de cache
- troca de navegador
- troca de máquina
- uso simultâneo por mais de um operador

### 2. Divergência de schema

O modelo atual já possui, na prática, pelo menos três contratos:

1. Seed em `data/exercises.js`
2. Importação via planilha em `app.js`
3. Edição manual pela tela em `app.js`

Campos que existem no seed/importação e são perdidos ou degradados na edição manual:

- `implementsAvailable`
- `randomWeight`
- `source.sheet`
- `source.row`

### 3. Classificação falsa de valência

Quando `sportValences` está ausente, o front aplica `strengthEndurance` por padrão. Isso contamina filtros, tags e leitura analítica sem esse dado existir na origem.

### 4. Falta de rastreabilidade

O seed antigo preserva workbook, aba e linha de origem. O fluxo atual de upload novo não preserva aba real nem número de linha, o que inviabiliza auditoria da carga.

### 5. Importação sem upsert

Hoje a planilha não consegue corrigir registros existentes. Se houver colisão, a linha é descartada. Isso é inadequado para operação contínua.

## Compatibilidade esperada da planilha

O parser atual reconhece, com aliases parciais, os seguintes campos:

- `Id`
- `Movimento`
- `Implemento`
- `Descricao`
- `Execucao`
- `Selecao`
- `Aleatorio`
- `MMSS`
- `MMII`
- `Tronco`
- `Core`
- `Equilibrio`
- `Popup`
- `Remada`
- `Navegacao`
- `Manobras de Borda`
- `Valencia Esportiva`
- `Kettlebell`
- `Halter`
- `Elastic Band`
- `Bola Suica`

## Meta do novo desenho

Substituir o armazenamento local por persistência real com:

- versionamento de importação
- rastreabilidade por arquivo, aba e linha
- upsert controlado
- validação de schema
- preservação integral dos atributos do exercício
- possibilidade de múltiplos implementos e múltiplas valências sem gambiarra no payload

## Schema recomendado

### Tabelas

1. `exercise_import_batches`
2. `exercise_import_rows`
3. `exercises`
4. `exercise_implements`
5. `exercise_valences`

### Decisões de modelagem

- `exercises` guarda o registro canônico.
- `exercise_implements` evita colunas fixas para disponibilidade por implemento.
- `exercise_valences` evita serializar lista em string ou array sem controle.
- `exercise_import_batches` registra cada arquivo carregado.
- `exercise_import_rows` preserva linha bruta, status e erro por linha.

## Regras de importação recomendadas

### 1. Pré-validação

Antes de gravar no banco:

- verificar se o arquivo possui ao menos uma aba válida
- mapear cabeçalhos por aliases
- informar cabeçalhos ausentes
- informar cabeçalhos desconhecidos
- normalizar acentos e espaços
- capturar número da linha original

### 2. Estratégia de matching

Ordem recomendada de identificação do exercício:

1. `external_id` da planilha, se existir
2. `legacy_id` atual
3. `movement_normalized + primary_implement`

`movement + implement` sozinho não deve ser a única chave de negócio no futuro.

### 3. Upsert

Para cada linha válida:

- se não existir exercício correspondente, inserir
- se existir, atualizar somente campos mapeados pela planilha
- registrar a ação como `inserted` ou `updated`

### 4. Tratamento de conflitos

Quando houver colisão ambígua:

- não gravar automaticamente
- marcar a linha como `conflict`
- exigir revisão humana

### 5. Preservação de linhagem

Cada exercício atualizado deve manter referência ao último batch e à última linha de origem.

## Mapeamento planilha -> banco

### Exercício

- `Id` -> `exercises.legacy_id`
- `Movimento` -> `exercises.movement`
- `Descricao` -> `exercises.description`
- `Implemento` -> `exercises.primary_implement`
- `Selecao` -> `exercises.selection_order`
- `Execucao` -> `exercises.image_path`
- `Aleatorio` -> `exercises.random_weight`
- `MMSS` -> `exercises.score_upper_body`
- `MMII` -> `exercises.score_lower_body`
- `Tronco` -> `exercises.score_trunk`
- `Core` -> `exercises.score_core`
- `Equilibrio` -> `exercises.score_balance`
- `Popup` -> `exercises.foundation_popup`
- `Remada` -> `exercises.foundation_rowing`
- `Navegacao` -> `exercises.foundation_navigation`
- `Manobras de Borda` -> `exercises.foundation_rail_maneuvers`

### Implementos disponíveis

- `Kettlebell` -> `exercise_implements.implement_code = kettlebell`
- `Halter` -> `exercise_implements.implement_code = dumbbell`
- `Elastic Band` -> `exercise_implements.implement_code = elastic_band`
- `Bola Suica` -> `exercise_implements.implement_code = swiss_ball`

### Valências

- `Valencia Esportiva` -> múltiplas linhas em `exercise_valences`

## Ajustes necessários no front

### Repositório

- trocar leitura de `localStorage` por leitura do backend
- trocar importação local por envio do arquivo ao backend
- mostrar resumo de importação por status
- permitir revisão de conflitos

### Prescrição e dashboard

- ler a mesma fonte canônica do backend
- não inferir valência padrão para registros legados sem dado
- parar de depender de campos que a UI não preserva

## Estratégia de migração

### Fase 1. Congelar o contrato

- definir schema SQL
- definir tabela de aliases de cabeçalho no backend
- remover defaults falsos de valência na leitura

### Fase 2. Migrar base atual

- converter `data/exercises.js` para carga inicial SQL
- importar os 26 exercícios atuais para `exercises`
- transformar `implementsAvailable` em linhas de `exercise_implements`
- transformar `sportValences` em linhas de `exercise_valences` apenas quando o dado existir de fato

### Fase 3. Backend de importação

- receber arquivo `.xlsx` ou `.csv`
- ler todas as abas relevantes
- validar cabeçalhos
- registrar batch
- registrar linhas
- aplicar upsert
- retornar relatório consolidado

### Fase 4. Substituir o front

- remover `persistState()` baseado em `localStorage`
- trocar seed estática por fetch
- manter `data/exercises.js` apenas como fallback temporário até a virada completa

### Fase 5. Desativar legado

- remover importação diretamente no navegador
- remover reset para seed local
- manter export apenas como relatório, não como fonte de verdade

## Riscos de migração

- dados locais já alterados em navegadores não serão recuperados automaticamente
- a base legada possui indício de encoding incorreto
- cargas antigas podem ter vindo de múltiplas abas, mas o fluxo novo lê só a primeira
- parte das valências atuais pode ser dado inferido e não dado real

## Recomendação executiva

Prioridade alta para migrar o upload de exercícios para backend com banco real antes de ampliar a base. O sistema atual suporta demonstração local, mas não suporta operação confiável nem auditoria de conteúdo.
