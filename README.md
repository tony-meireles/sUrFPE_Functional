# sUrFPE Functional

Aplicação front-end estática para catálogo de exercícios, prescrição de treinos, analytics local e gestão local de usuários do projeto sUrFPE.

## Status de publicação

O repositório está preparado para deploy automático no GitHub Pages como demonstração estática.

Limitação estrutural importante:

- autenticação, usuários, treinos, analytics e alterações do repositório ainda usam `localStorage`
- isso significa que cada navegador mantém seus próprios dados
- o ambiente online publicado não funciona como sistema multiusuário centralizado

Leia a auditoria em `docs/publication-readiness-audit.md`.

## Estrutura

- `index.html`: dashboard de treinos criados
- `prescricao.html`: montagem e exportação de treinos
- `repositorio.html`: catálogo e edição local de exercícios
- `analytics.html`: indicadores de uso local
- `users.html`: gestão local de usuários
- `data/exercises.js`: seed estático da base de exercícios
- `db/exercises_schema.sql`: proposta de schema para persistência real

## Execução local

Como o projeto é estático, basta servir a pasta por HTTP.

Exemplo com Python:

```powershell
python -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080/login.html
```

## Deploy no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` publica automaticamente a raiz do projeto quando houver push na branch `main`.

Para ativar:

1. No GitHub, abra `Settings > Pages`.
2. Em `Source`, selecione `GitHub Actions`.
3. Faça push para `main`.

## Risco atual

Se o objetivo for demonstração, GitHub Pages resolve.

Se o objetivo for operação real, o próximo passo correto é migrar autenticação e persistência para backend, aproveitando a direção já descrita em `db/exercises_schema.sql` e `docs/exercise-upload-audit.md`.
