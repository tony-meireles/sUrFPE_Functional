# Auditoria crítica para publicação

## Veredito executivo

O projeto pode ser publicado imediatamente como site estático de demonstração no GitHub Pages.

O projeto não está pronto para operação real multiusuário online porque autenticação, usuários, treinos, analytics e edições do repositório dependem de `localStorage`.

## Achados críticos

### 1. Persistência local apenas no navegador

Arquivos impactados:

- `auth.js`
- `app.js`
- `dashboard-v2.js`
- `prescription.js`
- `usage-analytics.js`

Impacto:

- cada navegador vira um banco isolado
- usuários aprovados em um dispositivo não existem em outro
- treinos criados em uma máquina não aparecem em outra
- limpar cache apaga operação e histórico

Conclusão:

Publicação online nesse estado entrega uma demo estática, não um sistema centralizado.

### 2. Controle de acesso não é confiável para produção

Achados:

- o bootstrap do Master depende do `localStorage` vazio do navegador
- qualquer visitante em um navegador novo cria seu próprio Master local
- a aprovação de usuários também fica isolada por navegador

Correção aplicada:

- o login de emergência `Master@ / Master@` foi restringido a `localhost` e `file:` para não virar backdoor público no site publicado

Conclusão:

Mesmo com essa contenção, o modelo de autenticação continua inadequado para ambiente real.

### 3. Herança de tentativas anteriores em `prescription.js`

Foram encontradas múltiplas redefinições de exportação:

- `function exportSessionAsPdf()` em várias regiões do arquivo
- `function exportSessionAsJpeg()` em várias regiões do arquivo
- reatribuições posteriores de `exportSessionAsPdf` e `exportSessionAsJpeg`

Impacto:

- comportamento difícil de prever
- alto risco de regressão silenciosa
- manutenção cara

Conclusão:

Antes de evoluir funcionalidade de prescrição, esse arquivo precisa ser consolidado.

### 4. Backend e schema existem só como intenção

Arquivo:

- `db/exercises_schema.sql`

Leitura:

- já existe proposta séria de persistência relacional
- o front atual ainda não consome esse backend

Conclusão:

Há direção técnica definida, mas a migração não foi concluída.

### 5. Documentação operacional insuficiente

Achados:

- `README.md` estava praticamente vazio
- não havia workflow de deploy
- não havia `.gitignore`

Correções aplicadas:

- workflow de GitHub Pages adicionado em `.github/workflows/deploy-pages.yml`
- `.gitignore` adicionado
- README refeito para publicação e operação local

## O que já está pronto para GitHub Pages

- site estático em HTML/CSS/JS puro
- navegação por arquivos relativos
- assets locais versionados
- sem etapa obrigatória de build

## O que ainda impede uso real online

1. banco de dados central
2. autenticação real no backend
3. autorização validada no servidor
4. sincronização canônica do repositório de exercícios
5. persistência compartilhada de treinos e analytics

## Recomendação objetiva

### Opção 1. Publicar agora como demo estática

Recomendação: 85%

Use GitHub Pages para disponibilizar interface, navegação, catálogo base e exportações locais, deixando explícito que o ambiente online é demonstrativo.

### Opção 2. Segurar publicação pública até migrar persistência

Recomendação: 15%

Escolha essa opção apenas se o objetivo for abrir operação real para usuários compartilharem dados entre dispositivos.
