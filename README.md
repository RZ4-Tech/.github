# .github da RZ4-Tech

Arquivos padrão que o GitHub aplica a todos os repos da organização que não
tiverem o seu próprio:

- `ISSUE_TEMPLATE/`: modelos de issue (bug, feature). A issue em branco continua liberada.
- `pull_request_template.md`: modelo de PR.

E os **workflows reaproveitáveis** que todo produto usa (RZ4-Tech/rz4-hq#1):

| Workflow | O que faz | Quando o produto chama |
|---|---|---|
| `.github/workflows/auto-pr.yml` | Abre o PR da branch para a `develop` no primeiro push. Branch `<tipo>/<N>-<slug>` já vem com `Closes #N`. | `push` em qualquer branch exceto `main`, `develop` e `dependabot/**` |
| `.github/workflows/release-closes.yml` | No PR `develop` → `main`, escreve um `Closes #N` por issue que o release leva, para as issues fecharem no merge. | `pull_request` para a `main` vindo da `develop` |
| `.github/workflows/audit.yml` | `npm audit` das pastas indicadas. Só reporta. | Job do `ci.yml` |
| `.github/workflows/semgrep.yml` | Semgrep só do que mudou desde a base, ou varredura completa sem base. Só reporta. | Job do `ci.yml` |

Os scripts ficam em `scripts/` e têm testes (`node --test scripts/*.test.mjs`, rodado por
`testes.yml`). Cada workflow faz checkout deste repo **no mesmo SHA** em que o
produto o fixou (`job.workflow_sha`), então workflow e script nunca ficam em
versões diferentes.

## Como o produto chama

Sempre por **SHA fixado**. O Dependabot do produto (ecossistema
`github-actions`) atualiza o SHA por PR, então mudança aqui não quebra produto
sem revisão.

```yaml
# .github/workflows/auto-pr.yml do produto
name: Auto PR
on:
  push:
    branches-ignore: [main, develop, "dependabot/**"]
jobs:
  pr:
    permissions: { contents: read, pull-requests: write }
    uses: RZ4-Tech/.github/.github/workflows/auto-pr.yml@<sha>
```

```yaml
# .github/workflows/release-closes.yml do produto
name: Release fecha as issues
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]
jobs:
  closes:
    if: github.event.pull_request.head.ref == 'develop'
    permissions: { contents: read, pull-requests: write }
    uses: RZ4-Tech/.github/.github/workflows/release-closes.yml@<sha>
```

```yaml
# jobs dentro do ci.yml do produto
  audit:
    uses: RZ4-Tech/.github/.github/workflows/audit.yml@<sha>
    with: { pastas: "frontend backend e2e" }
  semgrep:
    uses: RZ4-Tech/.github/.github/workflows/semgrep.yml@<sha>
    with: { base: "" }   # vazio = varredura completa; em PR/push, a base do diff
```

Apagar a branch depois do merge não precisa de workflow: é a opção
"Automatically delete head branches" nas configurações do repo.

Este repo é **público** para os repos privados poderem chamar os workflows sem
configuração de acesso. Nada aqui pode ter segredo: o token é sempre o
`GITHUB_TOKEN` do repo que chama.

Convenções, padrões de projeto e docs da empresa ficam no `rz4-hq`, não aqui.
