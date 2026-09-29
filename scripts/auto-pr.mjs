#!/usr/bin/env node
// Abre o PR da branch de trabalho para a `develop` no primeiro push (padrão da
// org; chamado por .github/workflows/auto-pr.yml).
//
// Branch de issue segue `<tipo>/<N>-<slug>` (ex.: fix/412-cadastro-abre-wizard):
// o corpo já nasce com `Closes #N`. É dessa linha que o release-closes monta a
// lista do PR develop → main — PR sem ela aparece como aviso no release.
//
// Uso: node scripts/auto-pr.mjs <branch>
// Ambiente: GITHUB_TOKEN, GITHUB_REPOSITORY, BASE (padrão develop).

/** Número da issue no nome da branch (`fix/412-...` → 412), ou null. */
export function issueDaBranch(branch) {
  const m = /^[a-z]+\/(\d+)-/.exec(branch);
  return m ? Number(m[1]) : null;
}

export function tituloDoPr(branch, base) {
  return `[Auto] ${branch} → ${base}`;
}

export function corpoDoPr(branch) {
  const issue = issueDaBranch(branch);
  return [
    "## 📋 Descrição",
    "<!-- O que foi feito? Por que essa mudança foi necessária? -->",
    "",
    issue
      ? `Closes #${issue}`
      : "<!-- Se resolve uma issue: `Closes #N` (em inglês, uma linha por issue). -->",
    "",
    "## 🔖 Tipo de mudança",
    "<!-- Marque com [x] o que se aplica -->",
    "- [ ] ✨ Nova funcionalidade",
    "- [ ] 🐛 Correção de bug",
    "- [ ] 🔥 Hotfix (urgente)",
    "- [ ] ♻️ Refatoração (sem mudança de comportamento)",
    "- [ ] 🎨 Ajuste de UI/UX",
    "- [ ] 📦 Atualização de dependências",
    "- [ ] 🔧 Configuração / infraestrutura",
    "",
    "## 🧪 Como testar",
    "<!-- Passo a passo para testar a mudança -->",
    "1.",
    "2.",
    "3.",
    "",
    "## 📸 Screenshots",
    "<!-- Se houver mudança visual, adicione prints antes/depois -->",
    "| Antes | Depois |",
    "|-------|--------|",
    "|       |        |",
    "",
    "## ✅ Checklist",
    "- [ ] Testei localmente e está funcionando",
    "- [ ] Não deixei `console.log` no código",
    "- [ ] Não há dados sensíveis expostos (chaves, senhas, tokens)",
    "- [ ] As migrações do banco estão corretas (se aplicável)",
    "- [ ] Revisei o código antes de abrir o PR",
    "",
    "---",
    `> _PR criado automaticamente a partir da branch \`${branch}\`_`,
  ].join("\n");
}

async function gh(caminho, init = {}) {
  const res = await fetch(`https://api.github.com${caminho}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${caminho}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const branch = process.argv[2];
  const repo = process.env.GITHUB_REPOSITORY;
  const base = process.env.BASE || "develop";
  if (!branch || !repo || !process.env.GITHUB_TOKEN) {
    throw new Error("uso: GITHUB_TOKEN=… GITHUB_REPOSITORY=dono/repo node scripts/auto-pr.mjs <branch>");
  }
  const [dono] = repo.split("/");
  const abertos = await gh(
    `/repos/${repo}/pulls?state=open&base=${encodeURIComponent(base)}&head=${encodeURIComponent(`${dono}:${branch}`)}`,
  );
  if (abertos.length) {
    console.log(`PR já existe: ${abertos[0].html_url}`);
    return;
  }
  const pr = await gh(`/repos/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: tituloDoPr(branch, base), head: branch, base, body: corpoDoPr(branch) }),
  });
  console.log(`PR criado: ${pr.html_url}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
